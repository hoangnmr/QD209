import express from "express";
import path from "path";
import cors from "cors";
import { initDB } from "./db.js";
import { ensureSeeded } from "./seed.js";
import { PORT } from "./config.js";
import authRouter from "./routes/auth.js";
import crudRouter from "./routes/crud.js";
import syncRouter from "./routes/sync.js";
import { cronSync } from "./scrapers/petrolimex.js";

const app = express();
app.use(cors());
app.use(express.json());

const FRONTEND_DIR = path.join(import.meta.dirname, "..", "frontend");

// Serve legacy bao-gia static app
const quotationAppPath = path.join(FRONTEND_DIR, "public", "bao-gia");
app.use("/bao-gia", express.static(quotationAppPath));

// Mount routers
app.use("/api/auth",  authRouter);
app.use("/api",       crudRouter);
app.use("/api",       syncRouter);

// ─── Daily 6:00 AM Scheduler ─────────────────────────────────────────────────
function startDailyScheduler() {
  const SYNC_HOUR = 6;
  const SYNC_MINUTE = 0;

  function scheduleNext() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(SYNC_HOUR, SYNC_MINUTE, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    const delay = next.getTime() - Date.now();
    const nextStr = next.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    console.log(`[Scheduler] ⏰ Đồng bộ giá tiếp theo lúc ${nextStr} (sau ${Math.round(delay / 60000)} phút)`);

    setTimeout(async () => {
      await cronSync();
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function bootstrap() {
  // 1. Init PostgreSQL schema
  await initDB();

  // 2. Seed default data
  await ensureSeeded();

  // 3. Start daily price sync scheduler
  startDailyScheduler();

  // 3. Dev or production mode
  if (process.env.NODE_ENV !== "production") {
    const viteModule = await import("vite");
    const vite = await viteModule.createServer({
      root: FRONTEND_DIR,
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[DEV] Server running on http://localhost:${PORT}`);
    });
  } else {
    const distPath = path.join(FRONTEND_DIR, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) return;
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[PRODUCTION] Server running on http://localhost:${PORT}`);
    });
  }
}

bootstrap().catch((err) => {
  console.error("[FATAL] Server failed to start:", err);
  process.exit(1);
});
