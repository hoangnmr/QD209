// ═══════════════════════════════════════════════════════════════════════════════
// 🔀 CÔNG TẮC CHẾ ĐỘ DATABASE
// ── GIÁ DẦU (fuel_prices) + raw SQL: LUÔN LUÔN dùng PostgreSQL ──
// ── Các bảng khác: có thể toggle memory/postgres bên dưới      ──
// ═══════════════════════════════════════════════════════════════════════════════

// ── LUÔN dùng PostgreSQL cho giá dầu & raw SQL (không bao giờ mất khi restart) ──
export {
  query,
  queryOne,
  execute,
  withTransaction,
  pool,
  getAllPrices,
  replacePrices,
} from "./db-postgres.js";

// ── Các bảng còn lại: toggle memory/postgres ─────────────────────────────────
// Muốn test local  → import từ "./db-memory.js"
// Muốn production  → import từ "./db-postgres.js"
export {
  getAllTiers,
  replaceTiers,
  getAllBulkTiers,
  replaceBulkTiers,
  getAllCustomers,
  replaceCustomers,
  getAllServices,
  replaceServices,
  getAllQuotations,
  replaceQuotations,
  getAllReconLogs,
  replaceReconLogs,
  getAllRegistrationServices,
  replaceRegistrationServices,
  getAllRegistrations,
  replaceRegistrations,
  getAllAuditLogs,
  insertAuditLog,
  getConfig,
  setConfig,
  findUserByUsername,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  initDB,
  TABLE_GETTERS,
  TABLE_SETTERS,
//} from "./db-memory.js";   // ← BẬT DÒNG NÀY ĐỂ TEST LOCAL (không cần PostgreSQL)
} from "./db-postgres.js";   // ← PRODUCTION: dùng PostgreSQL để dữ liệu không mất khi restart
