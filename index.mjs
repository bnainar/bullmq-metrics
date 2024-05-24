import Redis from "ioredis";
import fastify from "fastify";
import { Queue, MetricsTime } from "bullmq";
import Prometheus from "prom-client";
import config from "config";

const register = new Prometheus.Registry();
// Prometheus.collectDefaultMetrics({ prefix: "node_", timeout: 5000, register });
// register.setDefaultLabels({
//   app: "app-v1",
// });

const jobGauge = {};
const bullJobStates = [
  "active",
  "completed",
  "delayed",
  "failed",
  "paused",
  "prioritized",
  "waiting",
];
bullJobStates.forEach((state) => {
  const newGauge = new Prometheus.Gauge({
    name: `${config.get("redis.bullmq.prefix")}_${state}_total`,
    help: `Number of jobs in ${state} state`,
    labelNames: ["queue"],
  });
  jobGauge[state] = newGauge;
  register.registerMetric(newGauge);
});
console.log(JSON.parse(process.env.REDIS_NODES))
const connection = new Redis.Cluster(
  JSON.parse(process.env.REDIS_NODES) ?? config.get("redis.bullmq.nodes"),
  config.get("redis.bullmq.options")
);
const bullmqWorkerOptions = {
  connection,
  prefix: process.env.BULLMQ_PREFIX ?? config.get("redis.bullmq.prefix"),
  metrics: {
    maxDataPoints: MetricsTime.ONE_WEEK * 2,
  },
  lockDuration: config.get("bullmq.lockDuration"),
  stalledInterval: config.get("bullmq.stalledInterval"),
};

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT ?? 3000);

const app = fastify({ logger: true });
const queueNames = process.env.QUEUE_NAMES.split(",") ?? config.get("queueNames");

app.get("/metrics", async (_, res) => {
  queueNames.forEach(async (queue) => {
    const q = new Queue(`{${queue}}`, bullmqWorkerOptions);
    const j = await q.getJobCounts();
    delete j["waiting-children"];
    for (const [state, count] of Object.entries(j)) {
      jobGauge[state].set({ queue }, count);
    }
  });
  const m = await register.metrics();
  res.send(m);
});

app.get("/status", (_, res) => {
  res.send("Alive");
});

app.get("/ready", (_, res) => {
  connection.status === "ready" ? res.code(200).send() : res.code(500).send();
});

await app.listen({ host: HOST, port: PORT });
