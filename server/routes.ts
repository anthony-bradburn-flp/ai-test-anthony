import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.userId) return next();
  res.status(401).json({ message: "Authentication required" });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // prefix all routes with /api

  // --- Auth ---

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await storage.getUserByUsername(username);
    if (!user || user.password !== password) {
      res.status(401).json({ message: "Invalid username or password" });
      return;
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ username: user.username });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {});
    res.json({ ok: true });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.session.userId) {
      res.json({ username: req.session.username });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // --- AI Settings ---

  app.get("/api/admin/ai-settings", requireAuth, async (_req, res) => {
    const settings = await storage.getAiSettings();
    // Never expose the API key in GET responses
    const { apiKey: _key, ...safeSettings } = settings;
    res.json({ ...safeSettings, hasApiKey: !!_key });
  });

  app.post("/api/admin/ai-settings", requireAuth, async (req, res) => {
    const { provider, apiKey, orgId, systemPrompt, companyName } = req.body;
    const updated = await storage.updateAiSettings({
      ...(provider && { provider }),
      ...(apiKey && { apiKey }),
      ...(orgId !== undefined && { orgId }),
      ...(systemPrompt !== undefined && { systemPrompt }),
      ...(companyName !== undefined && { companyName }),
    });
    const { apiKey: _key, ...safeSettings } = updated;
    res.json({ ...safeSettings, hasApiKey: !!_key });
  });

  // --- Training Document ---

  app.post("/api/admin/ai-settings/training-doc", requireAuth, async (req, res) => {
    const { content, filename, size } = req.body;

    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "content is required" });
      return;
    }
    if (!filename || typeof filename !== "string") {
      res.status(400).json({ error: "filename is required" });
      return;
    }

    const updated = await storage.updateAiSettings({
      trainingDocContent: content,
      trainingDocFilename: filename,
      trainingDocUploadedAt: new Date().toISOString(),
      trainingDocSize: typeof size === "number" ? size : content.length,
    });

    res.json({
      trainingDocFilename: updated.trainingDocFilename,
      trainingDocUploadedAt: updated.trainingDocUploadedAt,
      trainingDocSize: updated.trainingDocSize,
    });
  });

  app.delete("/api/admin/ai-settings/training-doc", requireAuth, async (_req, res) => {
    await storage.updateAiSettings({
      trainingDocContent: null,
      trainingDocFilename: null,
      trainingDocUploadedAt: null,
      trainingDocSize: null,
    });
    res.json({ ok: true });
  });

  // --- Document Generation ---
  // Builds and returns the prompt context that would be sent to the AI provider.
  // Actual AI API calls are wired up once API keys are configured.

  app.post("/api/generate", async (req, res) => {
    const settings = await storage.getAiSettings();
    const projectData = req.body;

    const systemPrompt = buildSystemPrompt(settings.systemPrompt, settings.companyName, settings.trainingDocContent);

    // Return the assembled prompt for now; replace with AI SDK call once provider is wired.
    res.json({
      systemPrompt,
      projectData,
      trainingDocAttached: !!settings.trainingDocContent,
      provider: settings.provider,
    });
  });

  return httpServer;
}

function buildSystemPrompt(
  basePrompt: string,
  companyName: string,
  trainingDocContent: string | null
): string {
  let prompt = basePrompt.replace(/Flipside Group/g, companyName);

  if (trainingDocContent) {
    prompt += `\n\n---\n## TEMPLATE STANDARDS & EXAMPLES\n\nThe following document defines how ${companyName} expects governance documents to be structured and completed. Apply these standards to all generated documents:\n\n${trainingDocContent}\n---`;
  }

  return prompt;
}
