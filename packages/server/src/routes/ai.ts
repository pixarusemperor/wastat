import type { FastifyPluginAsync } from "fastify";

/**
 * AI Sales Co-Pilot & Sales Learning Flywheel Routes (TASK-04)
 */
export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/ai/health", async () => {
    return { status: "ready", model: "llama-3.3-70b-versatile" };
  });

  app.get("/api/playbooks", async (req, reply) => {
    // Returns active knowledge playbooks distilled from golden dialogues
    return [];
  });

  app.post("/api/ai/suggest-reply", async (req, reply) => {
    // Generates human-guided Co-Pilot suggested answer
    return { suggestedText: "", confidence: 0, sources: [] };
  });

  app.post("/api/ai/distill", async (req, reply) => {
    // Background flywheel distillation endpoint
    return { distilledCount: 0 };
  });
};
