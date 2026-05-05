import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { NodeSSH } from "node-ssh";

// Initialize Redis connection
// Assuming default local Redis port 6379. Update if needed.
const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Sanitize input for shell commands - escape special characters
function sanitizeShellInput(input: string | undefined): string {
  if (!input) return "";
  // Remove or escape potentially dangerous characters
  return input.replace(/[;`$|&\n\r]/g, "").trim();
}

// Validate domain name format
function isValidDomainName(domain: string): boolean {
  const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}

// Validate IP address or hostname
function isValidHost(input: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // Hostname regex (simplified)
  const hostnameRegex = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/;
  return ipv4Regex.test(input) || hostnameRegex.test(input);
}

export const serverSetupQueue = new Queue("server-setup", { connection });

export async function addServerSetupJob(
  domainId: string,
  ipAddress: string,
  sshUser: string,
  sshPassword?: string | null,
  domainName?: string,
) {
  // Validate inputs before queuing
  if (!isValidHost(ipAddress)) {
    throw new Error("Invalid IP address or hostname");
  }
  if (sshUser && !/^[a-zA-Z0-9_-]+$/.test(sshUser)) {
    throw new Error("Invalid SSH username");
  }
  if (domainName && !isValidDomainName(domainName)) {
    throw new Error("Invalid domain name");
  }

  return await serverSetupQueue.add("setup", {
    domainId,
    ipAddress: sanitizeShellInput(ipAddress),
    sshUser: sanitizeShellInput(sshUser),
    sshPassword,
    domainName: sanitizeShellInput(domainName),
  });
}

// Ensure the worker is only created once if this file is hot-reloaded
const globalForWorker = global as unknown as { worker: Worker | undefined };

if (!globalForWorker.worker) {
  globalForWorker.worker = new Worker(
    "server-setup",
    async (job: Job) => {
      const { domainId, ipAddress, sshUser, sshPassword, domainName } = job.data;
      const ssh = new NodeSSH();
      const channel = `server-log:${domainId}`;
      const pub = connection.duplicate();

      const log = (msg: string, status?: string) => {
        const payload = JSON.stringify({ msg, status });
        pub.publish(channel, payload);
      };

      try {
        log(`Connecting to ${ipAddress}...`, "Connecting");
        await ssh.connect({
          host: ipAddress,
          username: sshUser,
          password: sshPassword || undefined,
          readyTimeout: 20000,
        });

        log("Connected successfully. Requesting PTY shell...", "Updating System");

        const shell = await ssh.requestShell({ term: "vt100" });

        return new Promise<void>((resolve, reject) => {
          let outputBuffer = "";
          let currentStep = 0;
          let mailcowApiFetched = false;

          const steps = [
            {
              cmd: "sudo apt update && sudo apt upgrade -y",
              status: "Updating System",
              expect: /root@.*:/,
            }, // This is an approximation
            {
              cmd: "curl -sSL https://get.docker.com/ | CHANNEL=stable sh",
              status: "Installing Docker",
              expect: /root@.*:/,
            },
            {
              cmd: "systemctl enable --now docker",
              status: "Installing Docker",
              expect: /root@.*:/,
            },
            { cmd: "su", status: "Configuring", expect: /root@.*:/ },
            { cmd: "umask 022", status: "Configuring", expect: /root@.*:/ },
            { cmd: "cd /opt", status: "Cloning Mailcow", expect: /root@.*:/ },
            {
              cmd: "git clone https://github.com/mailcow/mailcow-dockerized || true",
              status: "Cloning Mailcow",
              expect: /root@.*:/,
            },
            { cmd: "cd mailcow-dockerized", status: "Configuring", expect: /root@.*:/ },
            {
              cmd: "./generate_config.sh",
              status: "Configuring",
              expect: /Mailcow hostname/i,
              isInteractive: true,
            },
            { cmd: "docker compose pull", status: "Pulling Images", expect: /root@.*:/ },
            { cmd: "docker compose up -d", status: "Starting Containers", expect: /root@.*:/ },
          ];

          // We'll use a delimiter trick to reliably detect command completion in the shell.
          // Since we might be `su` and the prompt changes, printing a unique token is best.
          const runNext = () => {
            if (currentStep >= steps.length) {
              log("All shell commands executed.", "Starting Containers");
              // Wait for Mailcow UI
              checkMailcowUi();
              return;
            }

            const step = steps[currentStep];
            log(`Running: ${step.cmd}`, step.status);

            if (step.isInteractive) {
              shell.write(`${step.cmd}\n`);
            } else {
              // Add a completion token to easily detect when the command finishes
              shell.write(`${step.cmd} && echo "__CMD_DONE__" || echo "__CMD_FAIL__"\n`);
            }
          };

          const checkMailcowUi = async () => {
            log("Waiting for Mailcow UI on port 443...", "Starting Containers");
            let retries = 60; // 10 mins max
            const poll = setInterval(async () => {
              if (retries <= 0) {
                clearInterval(poll);
                log("Mailcow UI did not come up in time.", "Failed");
                reject(new Error("Timeout waiting for Mailcow"));
                return;
              }
              try {
                // A basic fetch to see if it responds (ignoring cert errors)
                const res = await fetch(`https://${ipAddress}/api/v1/get/domain/all`, {
                  headers: { "X-API-Key": "dummy" }, // Just testing connection, expecting 401
                });
                if (res.status === 401 || res.ok) {
                  clearInterval(poll);
                  log("Mailcow web UI responded.", "Ready");

                  // Use a safer approach - don't cat sensitive files to logs
                  log("Mailcow installation completed successfully.", "Ready");

                  setTimeout(() => {
                    shell.close();
                    resolve();
                  }, 2000);
                }
              } catch (e) {
                // Expected to fail until nginx is up
              }
              retries--;
            }, 10000);
          };

          shell.on("data", (data: Buffer) => {
            const str = data.toString();
            outputBuffer += str;
            // stream output to frontend - limit chunk size for safety
            const chunk = str.length > 10000 ? str.substring(0, 10000) + "... (truncated)" : str;
            pub.publish(channel, JSON.stringify({ chunk }));

            // Check for completion tokens
            if (outputBuffer.includes("__CMD_DONE__")) {
              outputBuffer = outputBuffer.replace("__CMD_DONE__", "");
              currentStep++;
              runNext();
            } else if (outputBuffer.includes("__CMD_FAIL__")) {
              log(`Command failed at step ${currentStep}: ${steps[currentStep].cmd}`, "Failed");
              shell.close();
              reject(new Error("Command execution failed"));
            }

            // Handle interactive prompt
            if (currentStep < steps.length && steps[currentStep].isInteractive) {
              if (
                outputBuffer.toLowerCase().includes("mailcow hostname") ||
                outputBuffer.includes("FQDN")
              ) {
                // Validate domainName before using it
                if (!domainName || !isValidDomainName(domainName)) {
                  log(`Invalid domain name: ${domainName}`, "Failed");
                  shell.close();
                  reject(new Error("Invalid domain name for Mailcow configuration"));
                  return;
                }
                const mailcowHostname = `mail.${domainName}`;
                log(`Answering prompt with: ${mailcowHostname}`, "Configuring");
                shell.write(`${mailcowHostname}\n`);
                // The script finishes after this, wait for the prompt to return
                steps[currentStep].isInteractive = false; // Prevent re-triggering
                // We must manually trigger next step when prompt returns. Let's just wait a bit or look for prompt.
                // generate_config.sh outputs "Generating RSA keys..." etc, then exits.
                // We will write a token immediately after.
                shell.write(`echo "__CMD_DONE__"\n`);
              }
            }
          });

          shell.on("close", () => {
            pub.disconnect();
          });

          // Start
          runNext();
        });
      } catch (err: any) {
        log(`SSH Error: ${err.message}`, "Failed");
        pub.disconnect();
        throw err;
      } finally {
        ssh.dispose();
      }
    },
    { connection, concurrency: 5 },
  );
}
