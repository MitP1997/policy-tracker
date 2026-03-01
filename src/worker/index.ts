import type { Env } from "./env";
import {
  runReminderGeneration,
  runMaterializedExpiry
} from "../lib/reminders";

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/") {
      return json({
        ok: true,
        service: "policy-tracker",
        phase: 0,
        hasBindings: {
          d1: Boolean(env.DB),
          r2: Boolean(env.BUCKET)
        }
      });
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    return json({ ok: false, error: "not_found" }, { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    console.log("scheduled trigger fired", {
      cron: event.cron,
      scheduledTime: event.scheduledTime
    });

    try {
      const summary = await runReminderGeneration(env.DB);
      console.log("reminder generation", summary);
      await runMaterializedExpiry(env.DB);
      console.log("materialized expiry complete");
    } catch (err) {
      console.error("cron reminder/expiry failed", err);
    }
  }
};

export default worker;

