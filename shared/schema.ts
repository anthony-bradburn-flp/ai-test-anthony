import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// --- Generate request schema (mirrors client formSchema) ---

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
  summary:              z.string().min(1).max(5000),
  billingMilestones:    z.array(billingMilestoneSchema).min(1).max(20),
  flipsideStakeholders: z.array(stakeholderSchema).min(1).max(20),
  clientStakeholders:   z.array(stakeholderSchema).min(1).max(20),
  sponsorIndex:         z.number().int().min(0).max(19),
  docsRequired:         z.array(z.string().min(1).max(100)).min(1).max(10),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
