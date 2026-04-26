import { pgTable, text, integer, timestamp, uuid, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSecrets = pgTable("user_secrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  cfApiToken: text("cf_api_token"),
  cfAccountId: text("cf_account_id"),
  subdomainPrefixes: text("subdomain_prefixes").array(),
  personNames: text("person_names").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const servers = pgTable("servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  label: text("label").notNull(),
  hostname: text("hostname").notNull(),
  ipAddress: text("ip_address").notNull(),
  sshUser: text("ssh_user").notNull().default("root"),
  sshPassword: text("ssh_password"),
  status: text("status").notNull().default("configuring"),
  setupSteps: text("setup_steps"), // JSON stored as text
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobTemplates = pgTable("job_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  subdomainPrefixes: text("subdomain_prefixes").array(),
  personNames: text("person_names").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const domainBatches = pgTable("domain_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  templateId: uuid("template_id").references(() => jobTemplates.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  batchId: uuid("batch_id").references(() => domainBatches.id),
  serverId: uuid("server_id").references(() => servers.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  ipAddress: text("ip_address"),
  sshUser: text("ssh_user"),
  cfZoneId: text("cf_zone_id"),
  cfAccountId: text("cf_account_id"),
  mailcowHostname: text("mailcow_hostname"),
  mailcowApiKey: text("mailcow_api_key"),
  plannedInboxCount: integer("planned_inbox_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dnsRecords = pgTable("dns_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => domains.id),
  type: text("type").notNull(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  ttl: integer("ttl").notNull().default(1),
  priority: integer("priority"),
  proxied: boolean("proxied").notNull().default(false),
  status: text("status").notNull().default("pending"),
  cfRecordId: text("cf_record_id"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const domainPlans = pgTable("domain_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => domains.id),
  totalInboxes: integer("total_inboxes").notNull(),
  subdomainCount: integer("subdomain_count").notNull(),
  status: text("status").notNull().default("planned"),
  prefixesSnapshot: text("prefixes_snapshot").array(),
  namesSnapshot: text("names_snapshot").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plannedInboxes = pgTable("planned_inboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => domains.id),
  planId: uuid("plan_id")
    .notNull()
    .references(() => domainPlans.id),
  subdomainPrefix: text("subdomain_prefix").notNull(),
  subdomainFqdn: text("subdomain_fqdn").notNull(),
  localPart: text("local_part").notNull(),
  email: text("email").notNull(),
  personName: text("person_name"),
  format: text("format"),
  status: text("status").notNull().default("planned"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cloudflareZones = pgTable("cloudflare_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  zoneId: text("zone_id").notNull(),
  name: text("name").notNull(),
  status: text("status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  domains: many(domains),
  secrets: many(userSecrets),
  zones: many(cloudflareZones),
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
