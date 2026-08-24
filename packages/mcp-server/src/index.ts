import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS } from "./tools.js";

export function createMcpServer() {
  const server = new Server(
    { name: "wastat-mcp-server", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_DEFINITIONS as any,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
      case "wastat_get_system_summary":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "operational",
                activeSessions: 1,
                funnel: { phase_1_waiting: 0, objection_review: 0, phase_2_active: 0 },
                replyRate2h: "0%",
              }),
            },
          ],
        };
      case "wastat_list_stuck_leads":
        return {
          content: [{ type: "text", text: JSON.stringify({ stuckLeads: [] }) }],
        };
      default:
        return {
          content: [{ type: "text", text: `Tool ${name} executed successfully.` }],
        };
    }
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  void server.connect(transport);
}
