import { once } from "node:events";
import Redis from "ioredis";
import fastify from "fastify";
import { Queue } from "bullmq";
import Prometheus from "prom-client";

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
    name: `bullmq_${state}_total`,
    help: `Number of jobs in ${state} state`,
    labelNames: ["queue"],
  });
  jobGauge[state] = newGauge;
  register.registerMetric(newGauge);
});

const config = {
  bullmq: {
    lockDuration: 300000,
    stalledInterval: 300000,
  },
  redis: {
    bullmq: {
      nodes: [
        {
          host: "127.0.0.1",
          port: "6375",
        },
        {
          host: "127.0.0.1",
          port: "6380",
        },
        {
          host: "127.0.0.1",
          port: "6381",
        },
      ],
      options: {
        redisOptions: {
          connectTimeout: 10000,
        },
        enableReadyCheck: true,
        maxRedirections: 16,
        retryDelayOnFailOver: 2000,
        slotsRefreshTimeout: 10000,
        slotsRefreshInterval: 10000,
      },
      prefix: "bullmq",
    },
  },
  queueNames: [
    "CleanerCron",
    "DelayedCron",
    "HubSpotCron",
    "ReminderCron",
    "ScheduleCron",
    "SetChurnCron",
    "StandupCorn",
    "CustifyCron",
    "NPSDelayedCron",
    "NPSRelativeScheduleCron",
    "NpsReminderCron",
    "NPSScheduleCron",
    "CerebrumCron",
    "AccountLimitCacheToDBCron",
    "SubmissionSyncPollerCron",
    "EMP360ReminderCron",
    "SchedulerCron",
    "Affliate",
    "AccountMigration",
    "accountTrialFeatureDelete",
    "Billing",
    "Cleaner",
    "CloneClassicToNps",
    "Contact",
    "Custify",
    "Cerebrum",
    "Delayed",
    "Elastic",
    "ElasticMigration",
    "Email",
    "HubSpot",
    "inboundEmail",
    "MailerEvent",
    "Onboarding",
    "OverviewElasticSync",
    "Referral",
    "Reminder",
    "Reports",
    "ResponseEmail",
    "RuleEngine",
    "RuleEngineProcess",
    "GoogleSheet",
    "Schedule",
    "Share",
    "SMS",
    "SubmissionContactPropertiesSync",
    "SuperAdmin",
    "Survey",
    "ThankYou",
    "Webhook",
    "ContactImport",
    "NpsDelayed",
    "NpsSchedule",
    "NpsTrigger",
    "NpsRelativeSchedule",
    "Phishing",
    "Domain",
    "Standup",
    "Sentiment",
    "Invite",
    "Migration",
    "Subscription",
    "NpsReminder",
    "ResponseImport",
    "Log",
    "OverageSubscription",
    "PartialSubmission",
    "Visit",
    "DropOff",
    "OverviewElasticProcessWorker",
    "Scheduler",
    "EMP360Reminder",
    "Emp360Report",
    "Download",
    "AccountLimitSync",
    "WidgetCacheGenerator",
    "translation",
    "SubmissionSync",
    "PartialSubmissionSync",
    "Sentiment_v2",
    "SubmissionSyncPoller",
    "DownloadCron",
    "Sentiment_v3",
    "SentimentV3Migration",
    "SentimentV3ElasticSync",
    "ElasticGreenIndexSync",
    "ElasticMigrationDispatcher",
    "ElasticMigrationSync",
    "TicketImport",
    "Dashboard",
    "Hierarchy",
  ],
};

const bullmqWorkerOptions = {
  connection: new Redis.Cluster(
    config.redis.bullmq.nodes,
    config.redis.bullmq.options
  ),
  prefix: config.redis.bullmq.prefix,
  concurrency: 1,
  // metrics: {
  //   maxDataPoints: MetricsTime.ONE_WEEK * 2
  // },
  lockDuration: config.bullmq.lockDuration,
  stalledInterval: config.bullmq.stalledInterval,
  // removeOnFail: {
  //   age: ONE_WEEK_SECONDS // 7 days
  // }
};

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT ?? 3020);

const app = fastify({ logger: true });

app.get("/metrics", async (_, res) => {
  const qs = ["{SubmissionSync}", "{RuleEngine}"];
  qs.forEach(async (queue) => {
    const q = new Queue(queue, bullmqWorkerOptions);
    const j = await q.getJobCounts();
    delete j["waiting-children"];
    for (const [state, count] of Object.entries(j)) {
      jobGauge[state].set({ queue }, count);
    }
  });
  const m = await register.metrics();
  res.send(m);
});

await app.listen({ host: HOST, port: PORT });
