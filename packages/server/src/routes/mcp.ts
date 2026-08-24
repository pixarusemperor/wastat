import type { FastifyPluginAsync } from "fastify";

/**
 * Model Context Protocol (MCP) SSE Transport & Tools Endpoint (TASK-03)
 */
export const mcpRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/mcp/sse", async (req, reply) => {
    reply.header("Content-Type", "text/event-stream");
    reply.header("Cache-Control", "no-cache");
    reply.header("Connection", "keep-alive");
    reply.raw.write(`event: endpoint\ndata: /api/mcp/message\n\n`);
  });

  app.post("/api/mcp/message", async (req, reply) => {
    return { jsonrpc: "2.0", result: { status: "received" }, id: 1 };
  });
};
