import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

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
    "You are an expert project manager at Flipside Group. Draft comprehensive project governance documents based on the provided intake form details. Maintain a professional, consulting-grade tone.",
  companyName: "Flipside Group",
  trainingDocContent: null,
  trainingDocFilename: null,
  trainingDocUploadedAt: null,
  trainingDocSize: null,
};

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAiSettings(): Promise<AiSettings>;
  updateAiSettings(settings: Partial<AiSettings>): Promise<AiSettings>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private aiSettings: AiSettings;

  constructor() {
    this.users = new Map();
    this.aiSettings = { ...DEFAULT_AI_SETTINGS };
    // Seed initial admin user
    this.createUser({ username: "admin", password: "governance-admin" });
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
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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
