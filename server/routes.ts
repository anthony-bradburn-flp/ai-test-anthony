import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // prefix all routes with /api

  // --- AI Settings ---

  app.get("/api/admin/ai-settings", async (_req, res) => {
    const settings = await storage.getAiSettings();
    // Never expose the API key in GET responses
    const { apiKey: _key, ...safeSettings } = settings;
    res.json({ ...safeSettings, hasApiKey: !!_key });
  });

  app.post("/api/admin/ai-settings", async (req, res) => {
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

  app.post("/api/admin/ai-settings/training-doc", async (req, res) => {
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

  app.delete("/api/admin/ai-settings/training-doc", async (_req, res) => {
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
