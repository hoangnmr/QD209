import { Router } from "express";
import { pool } from "../db.js";
import { getFallbackConfig, saveFallbackConfig, logAudit } from "../config.js";
import { FallbackSchema, validateBody } from "../schemas.js";
import { internalSyncLogic, syncAndSave, clearCache } from "../scrapers/petrolimex.js";
import { verifyToken } from "./auth.js";

const router = Router();

// ─── Health ───────────────────────────────────────────────────────────────────
router.get("/health", async (_req, res) => {
  try {
    if (pool) {
      await pool.query("SELECT 1");
      res.json({ status: "UP", storage: "POSTGRESQL", timestamp: new Date().toISOString() });
    } else {
      res.json({ status: "UP", storage: "MEMORY", timestamp: new Date().toISOString() });
    }
  } catch (e: any) {
    res.status(500).json({ status: "DOWN", error: e.message });
  }
});

// ─── Fallback config ──────────────────────────────────────────────────────────
router.get("/fallback", async (_req, res) => {
  const cfg = await getFallbackConfig();
  res.json({ success: true, data: cfg });
});

router.post("/fallback", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!verifyToken(token)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const body = validateBody(FallbackSchema, req.body, res);
  if (!body) return;
  const { price, date } = body;
  const saved = await saveFallbackConfig(price, date);
  if (saved) {
    await logAudit("UPDATE_FALLBACK", `Đổi giá dự phòng thành ${price} ngày ${date}`);
    res.json({ success: true, message: "Cập nhật fallback thành công." });
  } else {
    res.status(500).json({ success: false, message: "Lỗi ghi dữ liệu." });
  }
});

// ─── Petrolimex scraper (read-only, does not save) ────────────────────────────
router.get("/petrolimex-sync", async (req, res) => {
  const force = req.query.force === "true";
  const result = await internalSyncLogic(force);
  res.json(result);
});

// ─── Petrolimex sync + save to database ───────────────────────────────────────
router.post("/petrolimex-sync", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!verifyToken(token)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const result = await syncAndSave(true);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/petrolimex-sync/clear-cache", (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!verifyToken(token)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  clearCache();
  console.log("[Petrolimex Scraper] Cache đã bị xóa thủ công.");
  res.json({ success: true, message: "Cache đã xóa." });
});

export default router;
