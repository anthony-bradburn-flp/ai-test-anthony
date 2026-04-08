import { eq, and, desc, asc, max } from "drizzle-orm";
import { type User, type InsertUser, type Client, type Project, type StoredDocument, type Draft } from "@shared/schema";
import { users, templatesTable, packagesTable, aiSettingsTable, clientsTable, projectsTable, storedDocumentsTable, draftsTable } from "@shared/schema";
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
  smartsheetWorkspaceId: string | null;
};

const DEFAULT_SYSTEM_PROMPT = `You are an expert project management consultant and delivery governance specialist embedded in a PM Governance Tool. Your role is to generate professional, accurate, and contextually relevant project documents based on intake form data, supporting materials provided by the project team, and your knowledge of best practices from similar project types.

YOUR CONTEXT
You will receive:

Intake form data — project name, client, stakeholders, key values, a project summary, and project type
Supporting documents — uploaded materials such as statements of work, decks, briefs, or technical specs
Template structures — document templates with either placeholder content to replace or structural guidelines to follow
Document selection — a list of specific documents the user has requested you generate
Project type — which determines the governance pack composition and influences tone, risk appetite, and stakeholder expectations

DOCUMENT MODES
Documents in the governance pack are handled in one of three ways:

AI Generated — you produce the full document content. Any document explicitly assigned to AI mode in the admin panel will appear in your request.
Template Filled — a template is pre-populated with structured data generated separately (RACI Matrix, RAID Log, Risk Register, Communications Plan, Executive Summary). You do not generate these here.
Passthrough — included in the pack unchanged. No action required from you.

Focus your output on AI Generated documents only. If no AI Generated documents are in the current request, return an empty documents array.

YOUR BEHAVIOUR
Use all available context
Draw on the intake form, supporting documents, and templates together. Where the intake data is sparse, infer sensibly from the supporting documents and project type. Never invent client names, monetary values, or hard deadlines unless they are stated in the source material.

Apply knowledge of similar projects
Use your knowledge of comparable projects — by industry, type, scale, and delivery method — to populate realistic content. Flag any assumptions you make.

Follow template structure exactly
When a template is provided:

If it contains placeholders, replace them with the correct values from the intake and supporting documents
If it contains structural guidelines, use them as a framework — do not reproduce the instructions verbatim
Do not reorder or rename sections unless a section is genuinely inapplicable, in which case note why

Maintain professional tone
Match the register to the project type and client context. Enterprise/regulated environments warrant formal language; agency/creative projects may use a more accessible tone. Default to clear, confident, and concise.

Be explicit about gaps
If critical information is missing and cannot be reasonably inferred, insert a clearly marked placeholder: [TBC — {description of what is needed}]. Do not silently omit content.

EXECUTIVE SUMMARY
When generating an Executive Summary, synthesise content from both the intake form and any uploaded supporting documents (SOW, brief, deck, spec, etc.) to produce a well-rounded project overview. The summary should cover:

Project purpose and background — why this project exists and what problem it solves
Scope and deliverables — what is being built or delivered and what is explicitly out of scope
Key stakeholders — client sponsor, key client contacts, and the Flipside team leads
Timeline and milestones — start date, end date, and any critical delivery dates or phases
Commercial summary — project value and billing milestone structure
Key risks and assumptions — the top 2–3 risks and any critical assumptions underpinning delivery

Write in clear, concise prose suitable for a senior client stakeholder. Avoid internal jargon. Where supporting documents contain richer detail than the intake form, use that detail to enrich the summary — do not just restate the form fields verbatim.

OUTPUT FORMAT
Generate each requested AI Generated document as a clearly separated, titled section
Label any inferred or assumed content with a brief inline note: (assumed — confirm with project team)
If a document cannot be meaningfully generated due to insufficient information, explain what is missing rather than producing a low-quality output

QUALITY BAR
Before finalising any document, check:

Are all named stakeholders from the intake reflected appropriately?
Is the content specific to this project — or could it have been written for any project?
Does it follow the provided template structure?
Are gaps and assumptions clearly flagged?
Is the tone appropriate for the client and project type?`;

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
  updateUser(id: string, fields: { username?: string; email?: string | null; role?: string; mustChangePassword?: boolean }): Promise<SafeUser | undefined>;
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
  createProject(data: Omit<Project, "id" | "createdAt" | "lastGeneratedAt" | "smartsheetId" | "smartsheetUrl" | "timelineGeneratedAt" | "timelineVersion"> & { lastGeneratedAt?: string | null; smartsheetId?: string | null; smartsheetUrl?: string | null; timelineGeneratedAt?: string | null; timelineVersion?: number }): Promise<Project>;
  updateProject(id: string, fields: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;
  // Stored Documents
  listDocuments(projectId: string): Promise<StoredDocument[]>;
  getDocument(id: string): Promise<StoredDocument | undefined>;
  createDocument(data: Omit<StoredDocument, "id">): Promise<StoredDocument>;
  deleteDocument(id: string): Promise<StoredDocument | undefined>;
  deleteDocumentsByProject(projectId: string): Promise<void>;
  markDocumentsNotLatest(projectId: string): Promise<void>;
  // Drafts
  listDrafts(userId: string): Promise<Draft[]>;
  getDraft(id: string): Promise<Draft | undefined>;
  createDraft(data: { userId: string; clientName: string; projectName: string; formData: Record<string, unknown> }): Promise<Draft>;
  updateDraft(id: string, data: { clientName?: string; projectName?: string; formData?: Record<string, unknown> }): Promise<Draft | undefined>;
  deleteDraft(id: string): Promise<void>;
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

    // Ensure admin user exists and password matches ADMIN_PASSWORD env var
    const adminPassword = process.env.ADMIN_PASSWORD || "governance-admin";
    if (!process.env.ADMIN_PASSWORD) {
      console.warn("[WARN] ADMIN_PASSWORD env var not set — using default. Change this in production.");
    }
    const hash = await hashPassword(adminPassword);
    const existingAdmin = await db.select().from(users).where(eq(users.username, "admin"));
    if (existingAdmin.length === 0) {
      await db.insert(users).values({ id: randomUUID(), username: "admin", password: hash, role: "admin", email: null });
    } else {
      await db.update(users).set({ password: hash }).where(eq(users.username, "admin"));
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
    const user = { id, username: insertUser.username, password: insertUser.password, email: insertUser.email ?? null, role: insertUser.role ?? "user", mustChangePassword: insertUser.mustChangePassword ?? false };
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
      smartsheetWorkspaceId: row?.smartsheetWorkspaceId ?? null,
    };
  }

  async updateAiSettings(settings: Partial<AiSettings>): Promise<AiSettings> {
    const current = await this.getAiSettings();
    const merged = { ...current, ...settings };
    const dbFields = {
      id: 1,
      systemPrompt: merged.systemPrompt,
      companyName: merged.companyName,
      trainingDocContent: merged.trainingDocContent,
      trainingDocFilename: merged.trainingDocFilename,
      trainingDocUploadedAt: merged.trainingDocUploadedAt,
      trainingDocSize: merged.trainingDocSize,
      smartsheetWorkspaceId: merged.smartsheetWorkspaceId,
    };
    await db.insert(aiSettingsTable).values(dbFields).onConflictDoUpdate({ target: aiSettingsTable.id, set: dbFields });
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

  async createProject(data: Parameters<IStorage["createProject"]>[0]): Promise<Project> {
    const row = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      lastGeneratedAt: data.lastGeneratedAt ?? null,
      smartsheetId: data.smartsheetId ?? null,
      smartsheetUrl: data.smartsheetUrl ?? null,
      timelineGeneratedAt: data.timelineGeneratedAt ?? null,
      timelineVersion: data.timelineVersion ?? 0,
    };
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

  // ---- Drafts ----
  async listDrafts(userId: string): Promise<Draft[]> {
    return db.select().from(draftsTable)
      .where(eq(draftsTable.userId, userId))
      .orderBy(desc(draftsTable.updatedAt));
  }

  async getDraft(id: string): Promise<Draft | undefined> {
    const rows = await db.select().from(draftsTable).where(eq(draftsTable.id, id));
    return rows[0];
  }

  async createDraft(data: { userId: string; clientName: string; projectName: string; formData: Record<string, unknown> }): Promise<Draft> {
    const row = { ...data, id: randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await db.insert(draftsTable).values(row);
    return row;
  }

  async updateDraft(id: string, data: { clientName?: string; projectName?: string; formData?: Record<string, unknown> }): Promise<Draft | undefined> {
    const rows = await db.update(draftsTable)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(draftsTable.id, id))
      .returning();
    return rows[0];
  }

  async deleteDraft(id: string): Promise<void> {
    await db.delete(draftsTable).where(eq(draftsTable.id, id));
  }
}

export const storage = new DbStorage();
