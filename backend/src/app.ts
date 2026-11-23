import { Hono } from "hono";
import { cors } from "hono/cors";

import { HttpError, type AppEnv } from "./http";
import { loadSessionUser } from "./lib/session";
import { authRoutes } from "./routes/auth";
import { calendarRoutes } from "./routes/calendar";
import { eventRoutes } from "./routes/events";
import { memberRoutes } from "./routes/members";
import { seriesRoutes } from "./routes/series";
import { taskRoutes } from "./routes/tasks";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function allowedOrigins(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("/api/*", async (c, next) => {
    const origins = allowedOrigins(c.env.ALLOWED_ORIGINS);
    return cors({
      origin: (origin) => (origins.includes(origin) ? origin : null),
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Accept"],
      maxAge: 600,
    })(c, next);
  });

  // Cross-site request protection: changes are only accepted from the
  // frontend's own origins (browsers always send Origin on such requests).
  app.use("/api/*", async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method)) {
      const origin = c.req.header("Origin");
      const self = new URL(c.req.url).origin;
      if (origin && origin !== self && !allowedOrigins(c.env.ALLOWED_ORIGINS).includes(origin)) {
        return c.json({ error: "This origin is not allowed." }, 403);
      }
    }
    c.set("user", await loadSessionUser(c));
    await next();
  });

  app.route("/api", calendarRoutes);
  app.route("/api", authRoutes);
  app.route("/api", memberRoutes);
  app.route("/api", eventRoutes);
  app.route("/api", seriesRoutes);
  app.route("/api", taskRoutes);

  app.get("/", (c) => c.json({ name: "ESN Frankfurt API", ok: true }));
  app.notFound((c) => c.json({ error: "Not found." }, 404));
  app.onError((error, c) => {
    if (error instanceof HttpError) {
      return c.json({ error: error.message, details: error.details }, error.status);
    }
    console.error(error);
    return c.json({ error: "Something went wrong on our side." }, 500);
  });

  return app;
}
