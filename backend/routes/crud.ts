import { Router } from "express";
import { TABLE_GETTERS, TABLE_SETTERS, execute, query } from "../db.js";
import { logAudit } from "../config.js";
import { CrudArraySchema, validateBody } from "../schemas.js";
import { verifyToken } from "./auth.js";

const router = Router();

// ─── Single price upsert (1 date = 1 price) ─────────────────────────────────
router.post("/prices/upsert", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!verifyToken(token)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { date, fuelType, priceV1 } = req.body || {};
  if (!date || !priceV1) {
    return res.status(400).json({ success: false, message: "Thiếu ngày hoặc giá." });
  }

  try {
    const result = await query(
      `INSERT INTO fuel_prices (date, fuel_type, price_v1) VALUES ($1, $2, $3)
       ON CONFLICT (date) DO UPDATE SET fuel_type = EXCLUDED.fuel_type, price_v1 = EXCLUDED.price_v1
       RETURNING id, (xmax = 0) AS inserted`,
      [date, fuelType || "Dầu DO 0,05S-II", Number(priceV1)],
    );

    const row = result[0] as any;
    const rowId = row.id;
    const wasInserted = row.inserted ?? true;

    const action = wasInserted ? "Thêm" : "Cập nhật";
    await logAudit("ADMIN_PRICE", `${action} giá: ${Number(priceV1).toLocaleString()}đ ngày ${date}`);
    res.json({
      success: true,
      id: rowId,
      message: `✅ ${action} giá ${Number(priceV1).toLocaleString()}đ cho ngày ${date}.`,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── Edit fuel price (only price, date stays) ────────────────────────────────
router.put("/prices/:id", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!verifyToken(token)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const id = Number(req.params.id);
  const { priceV1 } = req.body || {};
  if (!priceV1 || isNaN(id)) {
    return res.status(400).json({ success: false, message: "Thiếu giá hoặc ID không hợp lệ." });
  }
  try {
    await execute(
      `UPDATE fuel_prices SET price_v1 = $1 WHERE id = $2`,
      [Number(priceV1), id],
    );
    await logAudit("ADMIN_PRICE", `Sửa giá ID ${id} → ${Number(priceV1).toLocaleString()}đ`);
    res.json({ success: true, message: `✅ Đã cập nhật giá thành ${Number(priceV1).toLocaleString()}đ.` });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── Publish / pin a fuel price ───────────────────────────────────────────────
router.put("/prices/:id/publish", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!verifyToken(token)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: "ID không hợp lệ." });
  }
  try {
    // Unpin all, then pin the selected one
    await execute(`UPDATE fuel_prices SET is_published = FALSE`);
    await execute(`UPDATE fuel_prices SET is_published = TRUE WHERE id = $1`, [id]);
    await logAudit("ADMIN_PRICE", `Ghim giá ID ${id} lên Trang chủ`);
    res.json({ success: true, message: `✅ Đã ghim giá lên Trang Chủ.` });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── Unpin (revert to latest = default) ───────────────────────────────────────
router.delete("/prices/publish", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!verifyToken(token)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    await execute(`UPDATE fuel_prices SET is_published = FALSE`);
    await logAudit("ADMIN_PRICE", `Bỏ ghim giá — dùng giá mới nhất`);
    res.json({ success: true, message: `✅ Đã bỏ ghim. Trang chủ sẽ hiển thị giá mới nhất.` });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

const protectedRoutes = [
  "prices", "tiers", "bulk_tiers", "customers", "services",
  "quotations", "audit", "reconciliation_logs", "registration_services", "registrations"
] as const;

const sensitiveKeys = new Set(["customers", "quotations", "registrations", "audit", "reconciliation_logs"]);

protectedRoutes.forEach(key => {
  const urlSegment = key.replace(/_/g, "-");
  const getter = TABLE_GETTERS[key];
  const setter = TABLE_SETTERS[key];

  router.get(`/${urlSegment}`, async (req, res) => {
    if (sensitiveKeys.has(key)) {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      if (!verifyToken(token)) {
        return res.status(401).json({ success: false, message: "Unauthorized. Vui lòng đăng nhập quyền Admin." });
      }
    }
    try {
      const data = getter ? await getter() : [];
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  if (setter) {
    router.post(`/${urlSegment}`, async (req, res) => {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      if (!verifyToken(token)) {
        return res.status(401).json({ success: false });
      }
      const data = validateBody(CrudArraySchema, req.body, res);
      if (!data) return;
      try {
        await setter(data);
        if (["prices", "tiers", "bulk_tiers"].includes(key)) {
          await logAudit(`SYNC_${key.toUpperCase()}`, `Đồng bộ dữ liệu ${key} từ Admin`);
        }
        res.json({ success: true });
      } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
      }
    });
  }
});

export default router;
