import { eq, and, desc, asc, max } from "drizzle-orm";
import { type User, type InsertUser, type Client, type Project, type StoredDocument } from "@shared/schema";
import { users, templatesTable, packagesTable, aiSettingsTable, clientsTable, projectsTable, storedDocumentsTable } from "@shared/schema";
import { db } from "./db";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";

export const DATA_DIR = join(process.cwd(), "data");
export const DOCUMENTS_DIR = join(DATA_DIR, "documents");

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type Template = typeof templatesTable.$inferSelect;
export type Package = typeof packagesTable.$inferSelect;

export type AiSettings = {
  provider: "openai" | "anthropic";
  orgId: string;
  systemPrompt: string;
  companyName: string;
  trainingDocContent: string | null;
  trainingDocFilename: string | null;
  trainingDocUploadedAt: string | null;
  trainingDocSize: number | null;
};

const DEFAULT_SYSTEM_PROMPT = `Persona: Act as a Principal Project Consultant at Flipside Group, an expert in project delivery with a meticulous eye for detail. Your task is to flawlessly execute the creation of client-ready governance documentation according to the company's established best practices.
Core Objective: You will populate a suite of project governance documents. Your actions are governed by three sources of truth, in this order of priority:
1. The Training Document: This is your master guide. It contains the methodology, rules, and instructions for how to interpret information and what "good" looks like.
2. The Provided Templates: These define the exact structure, headings, and boilerplate text for each document. You must not deviate from this structure.
3. The Intake Form Fields: This contains the raw data and project specifics that you will use to populate the templates.
Execution Process:
1. Internalize the Methodology: First, thoroughly review the entire training document to understand the principles of how project governance is structured at Flipside Group.
2. Identify Required Documents: Review the specific input field that lists the exact document types to be generated for this project.
3. Iterate and Generate: For each document identified in the list from the previous step, you will perform the following sub-process:
   * A. Locate the Correct Template: Find the corresponding template file that matches the document type you are currently generating.
   * B. Populate the Template: Fill in the template using the data from the intake form fields. You must apply the rules, tone, and elaboration instructions found in the training document to expand on the raw data.
   * C. Synthesize, Do Not Copy: Do not simply paste data. Synthesize the information to create professional, comprehensive narratives within the template's structure. For example, if the training document says to detail risks, you will use the project description from the form to identify and articulate those risks.
4. Apply Strict File Naming Convention: As you generate each document, assign it a filename that must strictly follow the format: [sheet_Ref]_[Client_name]_[Document_type].docx
   * Source the [sheet_Ref] and [Client_name] directly from the corresponding intake form fields.
   * Use the specific [Document_type] name from the list you are iterating over (e.g., "Project_Charter", "Timeline").
5. Final Quality Assurance: Before finalizing the output, perform a final review. Ensure every instruction from the training document has been followed, every template has been correctly populated, and the filenames are perfect. The entire package must be client-ready and reflect the highest standards.`;

const DEFAULT_PACKAGES: Omit<Package, "id">[] = [
  { type: "Web", description: "Standard pack for web build projects", documents: ["RACI", "RAID Log", "Communications Plan", "Risk Register", "Go Live Checklist - Website", "Kick Off Checklist - Website"] },
  { type: "App", description: "Mobile app development docs", documents: ["RACI", "RAID Log", "Risk Register", "Communications Plan", "Kick Off Checklist - App", "Go Live Checklist - App"] },
  { type: "Strategy", description: "Lightweight pack for consulting", documents: ["RACI", "Communications Plan"] },
  { type: "Design", description: "Design-only project governance", documents: ["RACI", "RAID Log"] },
  { type: "Content", description: "Content and copywriting", documents: ["Communications Plan", "RAID Log"] },
  { type: "XR/AR", description: "Experimental & XR projects", documents: ["RACI", "RAID Log", "Risk Register", "Communications Plan"] },
];

const DEFAULT_TEMPLATES: Omit<Template, "id">[] = [
  { name: "RACI Matrix Template", type: "Excel (.xlsx)", lastUpdated: "2024-02-15", generateMode: "ai", filePath: null, originalFilename: null, fileSize: null, documentAlias: null },
  { name: "RAID Log Master", type: "Excel (.xlsx)", lastUpdated: "2024-01-10", generateMode: "ai", filePath: null, originalFilename: null, fileSize: null, documentAlias: null },
  { name: "Communications Plan", type: "Word (.docx)", lastUpdated: "2024-03-01", generateMode: "ai", filePath: null, originalFilename: null, fileSize: null, documentAlias: null },
  { name: "Risk Register Standard", type: "Excel (.xlsx)", lastUpdated: "2023-11-20", generateMode: "ai", filePath: null, originalFilename: null, fileSize: null, documentAlias: null },
  { name: "Project Kickoff Deck", type: "PowerPoint (.pptx)", lastUpdated: "2024-03-05", generateMode: "passthrough", filePath: null, originalFilename: null, fileSize: null, documentAlias: null },
];

export type SafeUser = Omit<User, "password">;

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<SafeUser[]>;
  deleteUser(id: string): Promise<void>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  updateUser(id: string, fields: { username?: string; email?: string | null; role?: string }): Promise<SafeUser | undefined>;
  listTemplates(): Promise<Template[]>;
  createTemplate(name: string, type: string): Promise<Template>;
  updateTemplate(id: string, fields: { name?: string; type?: string; generateMode?: "ai" | "passthrough" | "placeholder"; documentAlias?: string }): Promise<Template | undefined>;
  updateTemplateFile(id: string, filePath: string, originalFilename: string, fileSize: number): Promise<Template | undefined>;
  getTemplate(id: string): Promise<Template | undefined>;
  deleteTemplate(id: string): Promise<void>;
  listPackages(): Promise<Package[]>;
  createPackage(type: string, description: string, documents: string[]): Promise<Package>;
  updatePackage(id: string, fields: { type?: string; description?: string; documents?: string[] }): Promise<Package | undefined>;
  deletePackage(id: string): Promise<void>;
  getAiSettings(): Promise<AiSettings>;
  updateAiSettings(settings: Partial<AiSettings>): Promise<AiSettings>;
  // Clients
  listClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(name: string, createdBy: string): Promise<Client>;
  updateClient(id: string, name: string): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;
  // Projects
  listProjects(clientId?: string, createdBy?: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(data: Omit<Project, "id" | "createdAt">): Promise<Project>;
  updateProject(id: string, fields: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;
  // Stored Documents
  listDocuments(projectId: string): Promise<StoredDocument[]>;
  getDocument(id: string): Promise<StoredDocument | undefined>;
  createDocument(data: Omit<StoredDocument, "id">): Promise<StoredDocument>;
  deleteDocument(id: string): Promise<StoredDocument | undefined>;
  deleteDocumentsByProject(projectId: string): Promise<void>;
  markDocumentsNotLatest(projectId: string): Promise<void>;
}

class DbStorage implements IStorage {
  constructor() {
    // Ensure documents directory exists
    if (!existsSync(DOCUMENTS_DIR)) mkdirSync(DOCUMENTS_DIR, { recursive: true });
    // Seed defaults and ensure admin exists (fire-and-forget, idempotent)
    this.init().catch((e) => console.error("[storage] Init error:", e));
  }

  private async init() {
    // Seed AI settings singleton
    const existingSettings = await db.select().from(aiSettingsTable).where(eq(aiSettingsTable.id, 1));
    if (existingSettings.length === 0) {
      await db.insert(aiSettingsTable).values({
        id: 1,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        companyName: "Flipside Group",
        trainingDocContent: null,
        trainingDocFilename: null,
        trainingDocUploadedAt: null,
        trainingDocSize: null,
      });
    }

    // Seed default templates if none exist
    const existingTemplates = await db.select().from(templatesTable);
    if (existingTemplates.length === 0) {
      for (const t of DEFAULT_TEMPLATES) {
        await db.insert(templatesTable).values({ id: randomUUID(), ...t });
      }
    }

    // Seed default packages if none exist
    const existingPackages = await db.select().from(packagesTable);
    if (existingPackages.length === 0) {
      for (const p of DEFAULT_PACKAGES) {
        await db.insert(packagesTable).values({ id: randomUUID(), ...p });
      }
    }

    // Ensure admin user exists
    const adminPassword = process.env.ADMIN_PASSWORD || "governance-admin";
    if (!process.env.ADMIN_PASSWORD) {
      console.warn("[WARN] ADMIN_PASSWORD env var not set — using default. Change this in production.");
    }
    const existingAdmin = await db.select().from(users).where(eq(users.username, "admin"));
    if (existingAdmin.length === 0) {
      const hash = await hashPassword(adminPassword);
      await db.insert(users).values({ id: randomUUID(), username: "admin", password: hash, role: "admin", email: null });
    }
  }

  // ---- Users ----
  async getUser(id: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const lower = username.toLowerCase();
    const rows = await db.select().from(users);
    return rows.find((u) => u.username.toLowerCase() === lower);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user = { id, username: insertUser.username, password: insertUser.password, email: insertUser.email ?? null, role: insertUser.role ?? "user" };
    await db.insert(users).values(user);
    return user;
  }

  async listUsers(): Promise<SafeUser[]> {
    const rows = await db.select().from(users);
    return rows.map(({ password: _, ...rest }) => rest);
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  }

  async updateUser(id: string, fields: { username?: string; email?: string | null; role?: string }): Promise<SafeUser | undefined> {
    const rows = await db.update(users).set(fields).where(eq(users.id, id)).returning();
    if (!rows[0]) return undefined;
    const { password: _, ...safe } = rows[0];
    return safe;
  }

  // ---- Templates ----
  async listTemplates(): Promise<Template[]> {
    return db.select().from(templatesTable);
  }

  async createTemplate(name: string, type: string): Promise<Template> {
    const row = { id: randomUUID(), name, type, lastUpdated: new Date().toISOString().slice(0, 10), filePath: null, originalFilename: null, fileSize: null, generateMode: null as "ai" | "passthrough" | "placeholder" | null, documentAlias: null };
    await db.insert(templatesTable).values(row);
    return row;
  }

  async updateTemplate(id: string, fields: { name?: string; type?: string; generateMode?: "ai" | "passthrough" | "placeholder"; documentAlias?: string }): Promise<Template | undefined> {
    const rows = await db.update(templatesTable)
      .set({ ...fields, lastUpdated: new Date().toISOString().slice(0, 10) })
      .where(eq(templatesTable.id, id))
      .returning();
    return rows[0];
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const rows = await db.select().from(templatesTable).where(eq(templatesTable.id, id));
    return rows[0];
  }

  async updateTemplateFile(id: string, filePath: string, originalFilename: string, fileSize: number): Promise<Template | undefined> {
    const rows = await db.update(templatesTable)
      .set({ filePath, originalFilename, fileSize, lastUpdated: new Date().toISOString().slice(0, 10) })
      .where(eq(templatesTable.id, id))
      .returning();
    return rows[0];
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(templatesTable).where(eq(templatesTable.id, id));
  }

  // ---- Packages ----
  async listPackages(): Promise<Package[]> {
    return db.select().from(packagesTable);
  }

  async createPackage(type: string, description: string, documents: string[]): Promise<Package> {
    const row = { id: randomUUID(), type, description, documents };
    await db.insert(packagesTable).values(row);
    return row;
  }

  async updatePackage(id: string, fields: { type?: string; description?: string; documents?: string[] }): Promise<Package | undefined> {
    const rows = await db.update(packagesTable).set(fields).where(eq(packagesTable.id, id)).returning();
    return rows[0];
  }

  async deletePackage(id: string): Promise<void> {
    await db.delete(packagesTable).where(eq(packagesTable.id, id));
  }

  // ---- AI Settings ----
  async getAiSettings(): Promise<AiSettings> {
    const rows = await db.select().from(aiSettingsTable).where(eq(aiSettingsTable.id, 1));
    const row = rows[0];
    return {
      provider: "openai",
      orgId: "",
      systemPrompt: row?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      companyName: row?.companyName ?? "Flipside Group",
      trainingDocContent: row?.trainingDocContent ?? null,
      trainingDocFilename: row?.trainingDocFilename ?? null,
      trainingDocUploadedAt: row?.trainingDocUploadedAt ?? null,
      trainingDocSize: row?.trainingDocSize ?? null,
    };
  }

  async updateAiSettings(settings: Partial<AiSettings>): Promise<AiSettings> {
    const current = await this.getAiSettings();
    const merged = { ...current, ...settings };
    await db.insert(aiSettingsTable)
      .values({ id: 1, systemPrompt: merged.systemPrompt, companyName: merged.companyName, trainingDocContent: merged.trainingDocContent, trainingDocFilename: merged.trainingDocFilename, trainingDocUploadedAt: merged.trainingDocUploadedAt, trainingDocSize: merged.trainingDocSize })
      .onConflictDoUpdate({ target: aiSettingsTable.id, set: { systemPrompt: merged.systemPrompt, companyName: merged.companyName, trainingDocContent: merged.trainingDocContent, trainingDocFilename: merged.trainingDocFilename, trainingDocUploadedAt: merged.trainingDocUploadedAt, trainingDocSize: merged.trainingDocSize } });
    return merged;
  }

  // ---- Clients ----
  async listClients(): Promise<Client[]> {
    return db.select().from(clientsTable).orderBy(asc(clientsTable.name));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const rows = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    return rows[0];
  }

  async createClient(name: string, createdBy: string): Promise<Client> {
    const row = { id: randomUUID(), name, createdAt: new Date().toISOString(), createdBy };
    await db.insert(clientsTable).values(row);
    return row;
  }

  async updateClient(id: string, name: string): Promise<Client | undefined> {
    const rows = await db.update(clientsTable).set({ name }).where(eq(clientsTable.id, id)).returning();
    return rows[0];
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
  }

  // ---- Projects ----
  async listProjects(clientId?: string, createdBy?: string): Promise<Project[]> {
    const conditions = [];
    if (clientId) conditions.push(eq(projectsTable.clientId, clientId));
    if (createdBy) conditions.push(eq(projectsTable.createdBy, createdBy));
    const query = conditions.length > 0
      ? db.select().from(projectsTable).where(and(...conditions))
      : db.select().from(projectsTable);
    const rows = await query;
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const rows = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    return rows[0];
  }

  async createProject(data: Omit<Project, "id" | "createdAt">): Promise<Project> {
    const row = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    await db.insert(projectsTable).values(row);
    return row;
  }

  async updateProject(id: string, fields: Partial<Project>): Promise<Project | undefined> {
    if (Object.keys(fields).length === 0) {
      return this.getProject(id);
    }
    const rows = await db.update(projectsTable).set(fields).where(eq(projectsTable.id, id)).returning();
    return rows[0];
  }

  async deleteProject(id: string): Promise<void> {
    await this.deleteDocumentsByProject(id);
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
  }

  // ---- Stored Documents ----
  async listDocuments(projectId: string): Promise<StoredDocument[]> {
    return db.select().from(storedDocumentsTable)
      .where(eq(storedDocumentsTable.projectId, projectId))
      .orderBy(asc(storedDocumentsTable.version), asc(storedDocumentsTable.name));
  }

  async getDocument(id: string): Promise<StoredDocument | undefined> {
    const rows = await db.select().from(storedDocumentsTable).where(eq(storedDocumentsTable.id, id));
    return rows[0];
  }

  async createDocument(data: Omit<StoredDocument, "id">): Promise<StoredDocument> {
    const row = { ...data, id: randomUUID() };
    await db.insert(storedDocumentsTable).values(row);
    return row;
  }

  async deleteDocument(id: string): Promise<StoredDocument | undefined> {
    const rows = await db.delete(storedDocumentsTable).where(eq(storedDocumentsTable.id, id)).returning();
    const doc = rows[0];
    if (doc) {
      const fullPath = join(DATA_DIR, doc.storagePath);
      try { if (existsSync(fullPath)) unlinkSync(fullPath); } catch { /* ignore */ }
    }
    return doc;
  }

  async deleteDocumentsByProject(projectId: string): Promise<void> {
    const docs = await this.listDocuments(projectId);
    for (const doc of docs) {
      const fullPath = join(DATA_DIR, doc.storagePath);
      try { if (existsSync(fullPath)) unlinkSync(fullPath); } catch { /* ignore */ }
    }
    await db.delete(storedDocumentsTable).where(eq(storedDocumentsTable.projectId, projectId));
  }

  async markDocumentsNotLatest(projectId: string): Promise<void> {
    await db.update(storedDocumentsTable)
      .set({ isLatest: false })
      .where(eq(storedDocumentsTable.projectId, projectId));
  }
}

export const storage = new DbStorage();
