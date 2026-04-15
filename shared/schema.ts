import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---- Users ----
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  role: text("role").notNull().default("manager"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
});

export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one capital letter")
  .regex(/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/, "Password must contain at least one number or special character");

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
}).extend({
  password: passwordSchema,
  email: z.string().email("Please enter a valid email").optional(),
  role: z.enum(["admin", "manager", "user"]).default("user"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ---- Templates ----
export const templatesTable = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  lastUpdated: text("last_updated").notNull(),
  filePath: text("file_path"),
  originalFilename: text("original_filename"),
  fileSize: integer("file_size"),
  generateMode: text("generate_mode").$type<"ai" | "passthrough" | "placeholder">(),
  documentAlias: text("document_alias"),
});

// ---- Packages ----
export const packagesTable = pgTable("packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  description: text("description").notNull(),
  documents: json("documents").$type<string[]>().notNull(),
});

// ---- AI Settings (singleton row, id always = 1) ----
export const aiSettingsTable = pgTable("ai_settings", {
  id: integer("id").primaryKey(),
  systemPrompt: text("system_prompt").notNull(),
  companyName: text("company_name").notNull(),
  trainingDocContent: text("training_doc_content"),
  trainingDocFilename: text("training_doc_filename"),
  trainingDocUploadedAt: text("training_doc_uploaded_at"),
  trainingDocSize: integer("training_doc_size"),
  smartsheetWorkspaceId: text("smartsheet_workspace_id"),
});

// ---- Clients ----
export const clientsTable = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
});

// ---- Projects ----
export const projectsTable = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clientsTable.id),
  clientName: text("client_name").notNull(),
  sheetRef: text("sheet_ref").notNull(),
  projectName: text("project_name").notNull(),
  projectType: text("project_type").notNull(),
  projectSize: text("project_size").notNull(),
  value: text("value").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  summary: text("summary").notNull(),
  sponsorName: text("sponsor_name").notNull(),
  sponsorRole: text("sponsor_role").notNull(),
  billingMilestones: json("billing_milestones").$type<{ stage: string; percentage: number; date: string }[]>().notNull(),
  flipsideStakeholders: json("flipside_stakeholders").$type<{ name: string; role: string }[]>().notNull(),
  clientStakeholders: json("client_stakeholders").$type<{ name: string; role: string }[]>().notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
  lastGeneratedAt: text("last_generated_at"),
  smartsheetId: text("smartsheet_id"),
  smartsheetUrl: text("smartsheet_url"),
  timelineGeneratedAt: text("timeline_generated_at"),
  timelineVersion: integer("timeline_version").notNull().default(0),
});

// ---- Stored Documents ----
export const storedDocumentsTable = pgTable("stored_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projectsTable.id),
  name: text("name").notNull(),
  filename: text("filename").notNull(),
  format: text("format").notNull(),
  storagePath: text("storage_path").notNull(),
  fileSize: integer("file_size").notNull(),
  generatedAt: text("generated_at").notNull(),
  generatedBy: text("generated_by").notNull(),
  runId: text("run_id").notNull(),
  version: integer("version").notNull(),
  versionLabel: text("version_label").notNull(),
  isLatest: boolean("is_latest").notNull().default(false),
});

// ---- Supporting Documents ----
export const supportingDocumentsTable = pgTable("supporting_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projectsTable.id),
  name: text("name").notNull(),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
});

// ---- Drafts ----
export const draftsTable = pgTable("drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  clientName: text("client_name").notNull(),
  projectName: text("project_name").notNull(),
  formData: json("form_data").$type<Record<string, unknown>>().notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Derived types
export type AiSettings = typeof aiSettingsTable.$inferSelect;
export type Client = typeof clientsTable.$inferSelect;
export type Project = typeof projectsTable.$inferSelect;
export type StoredDocument = typeof storedDocumentsTable.$inferSelect;
export type SupportingDocument = typeof supportingDocumentsTable.$inferSelect;
export type Draft = typeof draftsTable.$inferSelect;

// ---- Generate request schema ----
const stakeholderSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
});

const billingMilestoneSchema = z.object({
  stage: z.string().min(1).max(200),
  percentage: z.number().min(0).max(100),
  date: z.string().min(1).max(20),
});

export const generateRequestSchema = z.object({
  client:               z.string().min(1).max(200),
  sheetRef:             z.string().min(1).max(20).regex(/^[A-Za-z]{2,3}\d{3}$/),
  projectName:          z.string().min(1).max(200),
  projectType:          z.string().min(1).max(100),
  projectSize:          z.string().min(1).max(50),
  value:                z.string().min(1).max(50),
  startDate:            z.string().min(1).max(20),
  endDate:              z.string().min(1).max(20),
  summary:              z.string().min(1).max(20000),
  billingMilestones:    z.array(billingMilestoneSchema).min(1).max(20),
  flipsideStakeholders: z.array(stakeholderSchema).min(1).max(20),
  clientStakeholders:   z.array(stakeholderSchema).min(1).max(20),
  sponsorIndex:         z.number().int().min(0).max(19),
  docsRequired:         z.array(z.string().min(1).max(100)).min(1).max(10),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
