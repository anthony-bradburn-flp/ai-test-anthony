import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// modify the interface with any CRUD methods
// you might need

export type AiSettings = {
  provider: "openai" | "anthropic";
  apiKey: string;
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
  apiKey: "",
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
  getAiSettings(): Promise<AiSettings>;
  updateAiSettings(settings: Partial<AiSettings>): Promise<AiSettings>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private aiSettings: AiSettings;

  constructor() {
    this.users = new Map();
    this.aiSettings = { ...DEFAULT_AI_SETTINGS };
    // Seed initial admin user with hashed password
    const adminPassword = process.env.ADMIN_PASSWORD || "governance-admin";
    if (!process.env.ADMIN_PASSWORD) {
      console.warn("[WARN] ADMIN_PASSWORD env var not set — using default. Change this in production.");
    }
    hashPassword(adminPassword).then((hash) => {
      this.createUser({ username: "admin", password: hash, role: "admin" });
    });
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
      role: insertUser.role ?? "manager",
    };
    this.users.set(id, user);
    return user;
  }

  async listUsers(): Promise<SafeUser[]> {
    return Array.from(this.users.values()).map(({ password: _, ...rest }) => rest);
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, password: hashedPassword });
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
