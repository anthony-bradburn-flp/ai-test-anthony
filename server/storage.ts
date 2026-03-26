import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "store.json");

function loadPersistedData(): { users: User[]; templates: Template[]; packages: Package[] } {
  try {
    if (existsSync(DATA_FILE)) {
      return JSON.parse(readFileSync(DATA_FILE, "utf8"));
    }
  } catch (e) {
    console.warn("[storage] Failed to read persist file, starting fresh:", e);
  }
  return { users: [], templates: [], packages: [] };
}

function savePersistedData(users: User[], templates: Template[], packages: Package[]) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify({ users, templates, packages }, null, 2));
  } catch (e) {
    console.error("[storage] Failed to persist data:", e);
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// modify the interface with any CRUD methods
// you might need

export type Template = {
  id: string;
  name: string;
  type: string;
  lastUpdated: string;
  filePath?: string;
  originalFilename?: string;
  fileSize?: number;
};

export type Package = {
  id: string;
  type: string;
  description: string;
  documents: string[];
};

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

const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "openai",
  orgId: "",
  systemPrompt:
    `Persona: Act as a Principal Project Consultant at Flipside Group, an expert in project delivery with a meticulous eye for detail. Your task is to flawlessly execute the creation of client-ready governance documentation according to the company's established best practices.
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
5. Final Quality Assurance: Before finalizing the output, perform a final review. Ensure every instruction from the training document has been followed, every template has been correctly populated, and the filenames are perfect. The entire package must be client-ready and reflect the highest standards.`,
  companyName: "Flipside Group",
  trainingDocContent: null,
  trainingDocFilename: null,
  trainingDocUploadedAt: null,
  trainingDocSize: null,
};

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
  updateTemplate(id: string, fields: { name?: string; type?: string }): Promise<Template | undefined>;
  updateTemplateFile(id: string, filePath: string, originalFilename: string, fileSize: number): Promise<Template | undefined>;
  getTemplate(id: string): Promise<Template | undefined>;
  deleteTemplate(id: string): Promise<void>;
  listPackages(): Promise<Package[]>;
  createPackage(type: string, description: string, documents: string[]): Promise<Package>;
  updatePackage(id: string, fields: { type?: string; description?: string; documents?: string[] }): Promise<Package | undefined>;
  deletePackage(id: string): Promise<void>;
  getAiSettings(): Promise<AiSettings>;
  updateAiSettings(settings: Partial<AiSettings>): Promise<AiSettings>;
}

const DEFAULT_PACKAGES: Package[] = [
  { id: "p1", type: "Web", description: "Standard pack for web build projects", documents: ["RACI Matrix Template", "RAID Log Master", "Communications Plan", "Project Kickoff Deck"] },
  { id: "p2", type: "App", description: "Mobile app development docs", documents: ["RACI Matrix Template", "Risk Register Standard", "Communications Plan", "Project Kickoff Deck"] },
  { id: "p3", type: "Strategy", description: "Lightweight pack for consulting", documents: ["RACI Matrix Template", "Communications Plan"] },
  { id: "p4", type: "Design", description: "Design-only project governance", documents: ["RACI Matrix Template", "RAID Log Master", "Project Kickoff Deck"] },
  { id: "p5", type: "Content", description: "Content and copywriting", documents: ["Communications Plan", "RAID Log Master"] },
  { id: "p6", type: "XR/AR", description: "Experimental & XR projects", documents: ["RACI Matrix Template", "RAID Log Master", "Risk Register Standard", "Communications Plan", "Project Kickoff Deck"] },
];

const DEFAULT_TEMPLATES: Template[] = [
  { id: "t1", name: "RACI Matrix Template", type: "Excel (.xlsx)", lastUpdated: "2024-02-15" },
  { id: "t2", name: "RAID Log Master", type: "Excel (.xlsx)", lastUpdated: "2024-01-10" },
  { id: "t3", name: "Communications Plan", type: "Word (.docx)", lastUpdated: "2024-03-01" },
  { id: "t4", name: "Risk Register Standard", type: "Excel (.xlsx)", lastUpdated: "2023-11-20" },
  { id: "t5", name: "Project Kickoff Deck", type: "PowerPoint (.pptx)", lastUpdated: "2024-03-05" },
];

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private aiSettings: AiSettings;
  private templates: Map<string, Template>;
  private packages: Map<string, Package>;

  constructor() {
    const persisted = loadPersistedData();
    this.aiSettings = { ...DEFAULT_AI_SETTINGS };
    // Restore persisted data, falling back to defaults for templates/packages
    this.users = new Map(persisted.users.map((u) => [u.id, u]));
    this.templates = persisted.templates.length
      ? new Map(persisted.templates.map((t) => [t.id, t]))
      : new Map(DEFAULT_TEMPLATES.map((t) => [t.id, t]));
    this.packages = persisted.packages.length
      ? new Map(persisted.packages.map((p) => [p.id, p]))
      : new Map(DEFAULT_PACKAGES.map((p) => [p.id, p]));
    // Ensure admin user always exists (re-seed if missing or password changed)
    const adminPassword = process.env.ADMIN_PASSWORD || "governance-admin";
    if (!process.env.ADMIN_PASSWORD) {
      console.warn("[WARN] ADMIN_PASSWORD env var not set — using default. Change this in production.");
    }
    const existingAdmin = persisted.users.find((u) => u.username === "admin");
    if (!existingAdmin) {
      hashPassword(adminPassword).then((hash) => {
        this.createUser({ username: "admin", password: hash, role: "admin" });
      });
    }
  }

  private persist() {
    savePersistedData(
      Array.from(this.users.values()),
      Array.from(this.templates.values()),
      Array.from(this.packages.values()),
    );
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      email: insertUser.email ?? null,
      role: insertUser.role ?? "user",
    };
    this.users.set(id, user);
    this.persist();
    return user;
  }

  async listUsers(): Promise<SafeUser[]> {
    return Array.from(this.users.values()).map(({ password: _, ...rest }) => rest);
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
    this.persist();
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    const user = this.users.get(id);
    if (user) { this.users.set(id, { ...user, password: hashedPassword }); this.persist(); }
  }

  async updateUser(id: string, fields: { username?: string; email?: string | null; role?: string }): Promise<SafeUser | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...fields };
    this.users.set(id, updated);
    this.persist();
    const { password: _, ...safe } = updated;
    return safe;
  }

  async listTemplates(): Promise<Template[]> {
    return Array.from(this.templates.values());
  }

  async createTemplate(name: string, type: string): Promise<Template> {
    const id = randomUUID();
    const t: Template = { id, name, type, lastUpdated: new Date().toISOString().slice(0, 10) };
    this.templates.set(id, t);
    this.persist();
    return t;
  }

  async updateTemplate(id: string, fields: { name?: string; type?: string }): Promise<Template | undefined> {
    const t = this.templates.get(id);
    if (!t) return undefined;
    const updated = { ...t, ...fields, lastUpdated: new Date().toISOString().slice(0, 10) };
    this.templates.set(id, updated);
    this.persist();
    return updated;
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    return this.templates.get(id);
  }

  async updateTemplateFile(id: string, filePath: string, originalFilename: string, fileSize: number): Promise<Template | undefined> {
    const t = this.templates.get(id);
    if (!t) return undefined;
    const updated = { ...t, filePath, originalFilename, fileSize, lastUpdated: new Date().toISOString().slice(0, 10) };
    this.templates.set(id, updated);
    this.persist();
    return updated;
  }

  async deleteTemplate(id: string): Promise<void> {
    this.templates.delete(id);
    this.persist();
  }

  async listPackages(): Promise<Package[]> {
    return Array.from(this.packages.values());
  }

  async createPackage(type: string, description: string, documents: string[]): Promise<Package> {
    const id = randomUUID();
    const p: Package = { id, type, description, documents };
    this.packages.set(id, p);
    this.persist();
    return p;
  }

  async updatePackage(id: string, fields: { type?: string; description?: string; documents?: string[] }): Promise<Package | undefined> {
    const p = this.packages.get(id);
    if (!p) return undefined;
    const updated = { ...p, ...fields };
    this.packages.set(id, updated);
    this.persist();
    return updated;
  }

  async deletePackage(id: string): Promise<void> {
    this.packages.delete(id);
    this.persist();
  }

  async getAiSettings(): Promise<AiSettings> {
    return { ...this.aiSettings };
  }

  async updateAiSettings(settings: Partial<AiSettings>): Promise<AiSettings> {
    this.aiSettings = { ...this.aiSettings, ...settings };
    return { ...this.aiSettings };
  }
}

export const storage = new MemStorage();
