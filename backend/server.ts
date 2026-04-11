import express from "express";
import path from "path";
import cors from "cors";
import { initDB } from "./db.js";
import { PORT } from "./config.js";
import authRouter from "./routes/auth.js";
import crudRouter from "./routes/crud.js";
import syncRouter from "./routes/sync.js";
import publicRouter from "./routes/public.js";
import { startCronJobs } from "./cron.js";

const app = express();
app.use(cors());
app.use(express.json());

const FRONTEND_DIR = path.join(import.meta.dirname, "..", "frontend");

// Serve legacy bao-gia static app
const quotationAppPath = path.join(FRONTEND_DIR, "public", "bao-gia");
app.use("/bao-gia", express.static(quotationAppPath));

// Mount routers
app.use("/api/auth",   authRouter);
app.use("/api/public", publicRouter);
app.use("/api",        crudRouter);
app.use("/api",        syncRouter);

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function bootstrap() {
  // 1. Init database (PostgreSQL hoặc In-Memory tùy công tắc trong db.ts)
  await initDB();

  // 2. Seed default data (chỉ chạy khi dùng PostgreSQL — memory mode đã seed sẵn)
  try {
    const { ensureSeeded } = await import("./seed.js");
    await ensureSeeded();
  } catch (e: any) {
    console.log("[DB] ⚙️ Bỏ qua seed (đang dùng in-memory mode):", e.message?.slice(0, 80));
  }

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

  // Khởi động cron job cào giá Petrolimex hằng ngày lúc 6:00 AM (VN)
  startCronJobs();
}

bootstrap().catch((err) => {
  console.error("[FATAL] Server failed to start:", err);
  process.exit(1);
});
