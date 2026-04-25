import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const userSecrets = sqliteTable("user_secrets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  cfApiToken: text("cf_api_token"),
  cfAccountId: text("cf_account_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const servers = sqliteTable("servers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  label: text("label").notNull(),
  hostname: text("hostname").notNull(),
  ipAddress: text("ip_address").notNull(),
  sshUser: text("ssh_user").notNull().default("root"),
  status: text("status").notNull().default("configuring"),
  setupSteps: text("setup_steps"), // JSON
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const jobTemplates = sqliteTable("job_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  subdomainPrefixes: text("subdomain_prefixes"), // JSON array
  personNames: text("person_names"), // JSON array
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const domainBatches = sqliteTable("domain_batches", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  templateId: text("template_id").references(() => jobTemplates.id),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const domains = sqliteTable("domains", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  batchId: text("batch_id").references(() => domainBatches.id),
  serverId: text("server_id").references(() => servers.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  cfZoneId: text("cf_zone_id"),
  cfAccountId: text("cf_account_id"),
  mailcowHostname: text("mailcow_hostname"),
  mailcowApiKey: text("mailcow_api_key"),
  plannedInboxCount: integer("planned_inbox_count"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const dnsRecords = sqliteTable("dns_records", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  domainId: text("domain_id").notNull().references(() => domains.id),
  type: text("type").notNull(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  ttl: integer("ttl").notNull().default(1),
  priority: integer("priority"),
  proxied: integer("proxied", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("pending"),
  cfRecordId: text("cf_record_id"),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const domainPlans = sqliteTable("domain_plans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  domainId: text("domain_id").notNull().references(() => domains.id),
  totalInboxes: integer("total_inboxes").notNull(),
  subdomainCount: integer("subdomain_count").notNull(),
  status: text("status").notNull().default("planned"),
  prefixesSnapshot: text("prefixes_snapshot"), // JSON array
  namesSnapshot: text("names_snapshot"), // JSON array
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const plannedInboxes = sqliteTable("planned_inboxes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  domainId: text("domain_id").notNull().references(() => domains.id),
  planId: text("plan_id").notNull().references(() => domainPlans.id),
  subdomainPrefix: text("subdomain_prefix").notNull(),
  subdomainFqdn: text("subdomain_fqdn").notNull(),
  localPart: text("local_part").notNull(),
  email: text("email").notNull(),
  personName: text("person_name"),
  format: text("format"),
  status: text("status").notNull().default("planned"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  domains: many(domains),
  secrets: many(userSecrets),
}));

export const domainRelations = relations(domains, ({ one, many }) => ({
  user: one(users, { fields: [domains.userId], references: [users.id] }),
  batch: one(domainBatches, { fields: [domains.batchId], references: [domainBatches.id] }),
  server: one(servers, { fields: [domains.serverId], references: [servers.id] }),
  dnsRecords: many(dnsRecords),
  plan: one(domainPlans, { fields: [domains.id], references: [domainPlans.domainId] }),
}));

export const domainBatchRelations = relations(domainBatches, ({ many }) => ({
  domains: many(domains),
}));

export const serverRelations = relations(servers, ({ many }) => ({
  domains: many(domains),
}));
