import Fastify from "fastify";
import cors from "@fastify/cors";
import { WASTAT_VERSION } from "@wastat/shared";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({
  status: "ok",
  version: WASTAT_VERSION,
  time: new Date().toISOString(),
}));

const port = Number(process.env.PORT ?? 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
