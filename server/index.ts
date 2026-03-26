import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { initSecrets } from "./secrets";
import session from "express-session";
import MemoryStore from "memorystore";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    username?: string;
    role?: string;
  }
}

if (!process.env.SESSION_SECRET) {
  console.warn("[WARN] SESSION_SECRET env var not set — using insecure default. Set this in production.");
}

const app = express();
const httpServer = createServer(app);

app.use(helmet({
  contentSecurityPolicy: false,
  hsts: false, // Server runs HTTP only — HSTS would force HTTPS and break access
}));

const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || "pm-governance";
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || "flipside-pm";

app.use((req: Request, res: Response, next: NextFunction) => {
  // API routes are protected by session auth — skip basic auth for them
  // to prevent the browser showing a credentials dialog on fetch() calls
  if (req.path.startsWith("/api/")) return next();

  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const [user, pass] = decoded.split(":");
    if (user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASS) {
      return next();
    }
  }
  res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
  res.status(401).send("Unauthorized");
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const SessionStore = MemoryStore(session);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "admin-session-secret",
    resave: false,
    saveUninitialized: false,
    store: new SessionStore({ checkPeriod: 86400000 }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.HTTPS === "true",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  }),
);

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "50mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const safe = { ...capturedJsonResponse };
        // Strip large/sensitive fields from logs
        for (const key of ["systemPrompt", "userPrompt", "trainingDocContent", "apiKey"]) {
          if (key in safe) safe[key] = "[redacted]";
        }
        logLine += ` :: ${JSON.stringify(safe)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await initSecrets();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
