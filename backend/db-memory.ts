// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY DATABASE — Dùng để test local khi không có PostgreSQL
// Bật/tắt bằng biến USE_MEMORY_DB trong server.ts
// ═══════════════════════════════════════════════════════════════════════════════
import bcrypt from "bcryptjs";

// ─── In-memory stores ────────────────────────────────────────────────────────
let store: Record<string, any[]> = {
  fuel_prices: [
    // Lịch sử biến động giả định từ tháng 3 đến đầu tháng 4/2026 để test
    { id: 1, date: '2026-03-26', effectiveAt: '2026-03-26T08:00:00+07:00', fuelType: 'Dầu DO 0,05S-II', priceV1: 35440, isPublished: false },
    { id: 2, date: '2026-04-01', effectiveAt: '2026-04-01T08:00:00+07:00', fuelType: 'Dầu DO 0,05S-II', priceV1: 35440, isPublished: false },
    { id: 3, date: '2026-04-02', effectiveAt: '2026-04-02T08:00:00+07:00', fuelType: 'Dầu DO 0,05S-II', priceV1: 35440, isPublished: false },
    // Dữ liệu điều chỉnh 3/4
    { id: 4, date: '2026-04-03', effectiveAt: '2026-04-03T08:00:00+07:00', fuelType: 'Dầu DO 0,05S-II', priceV1: 40820, isPublished: false },
    // Dữ liệu mới nhất hiện hành (44.780đ)
    { id: 5, date: '2026-04-04', effectiveAt: '2026-04-04T08:00:00+07:00', fuelType: 'Dầu DO 0,05S-II', priceV1: 44780, isPublished: false },
  ],
  tiers: [
    { id: 1, minPrice: 0,     maxPrice: 23000, surcharge20F: 0,      surcharge40F: 0,      surcharge20E: 0,      surcharge40E: 0      },
    { id: 2, minPrice: 23001, maxPrice: 26000, surcharge20F: 50000,  surcharge40F: 60000,  surcharge20E: 35000,  surcharge40E: 50000  },
    { id: 3, minPrice: 26001, maxPrice: 29000, surcharge20F: 100000, surcharge40F: 120000, surcharge20E: 70000,  surcharge40E: 100000 },
    { id: 4, minPrice: 29001, maxPrice: 32000, surcharge20F: 150000, surcharge40F: 180000, surcharge20E: 105000, surcharge40E: 150000 },
    { id: 5, minPrice: 32001, maxPrice: 35000, surcharge20F: 200000, surcharge40F: 240000, surcharge20E: 140000, surcharge40E: 200000 },
    { id: 6, minPrice: 35001, maxPrice: 38000, surcharge20F: 250000, surcharge40F: 300000, surcharge20E: 175000, surcharge40E: 250000 },
    { id: 7, minPrice: 38001, maxPrice: 41000, surcharge20F: 300000, surcharge40F: 360000, surcharge20E: 210000, surcharge40E: 300000 },
    { id: 8, minPrice: 41001, maxPrice: 44000, surcharge20F: 350000, surcharge40F: 420000, surcharge20E: 245000, surcharge40E: 350000 },
    { id: 9, minPrice: 44001, maxPrice: 47000, surcharge20F: 400000, surcharge40F: 480000, surcharge20E: 280000, surcharge40E: 400000 },
    { id: 10, minPrice: 47001, maxPrice: 99999, surcharge20F: 450000, surcharge40F: 540000, surcharge20E: 315000, surcharge40E: 450000 },
  ],
  bulk_tiers: [
    { id: 1, minPrice: 0,     maxPrice: 23000, percentSurcharge: 0  },
    { id: 2, minPrice: 23001, maxPrice: 26000, percentSurcharge: 3  },
    { id: 3, minPrice: 26001, maxPrice: 29000, percentSurcharge: 6  },
    { id: 4, minPrice: 29001, maxPrice: 32000, percentSurcharge: 9  },
    { id: 5, minPrice: 32001, maxPrice: 35000, percentSurcharge: 12 },
    { id: 6, minPrice: 35001, maxPrice: 38000, percentSurcharge: 15 },
    { id: 7, minPrice: 38001, maxPrice: 41000, percentSurcharge: 15 },
    { id: 8, minPrice: 41001, maxPrice: 44000, percentSurcharge: 18 },
    { id: 9, minPrice: 44001, maxPrice: 47000, percentSurcharge: 18 },
    { id: 10, minPrice: 47001, maxPrice: 99999, percentSurcharge: 21 },
  ],
  customers: [
    { id: 1, name: 'Công ty TNHH Vận tải Minh Phương', email: 'logistics@minhphuong.com', phone: '028 3821 7333', address: '93 Nguyễn Du, Quận 1, TP. HCM', taxCode: '0300601156', status: 'active' },
  ],
  services: [
    { id: 1, name: 'Bốc xếp Container 20 Full',  unit: 'Cont', price: 500000,  category: 'Container' },
    { id: 2, name: 'Bốc xếp Container 40 Full',  unit: 'Cont', price: 800000,  category: 'Container' },
    { id: 3, name: 'Bốc xếp Container 20 Empty', unit: 'Cont', price: 300000,  category: 'Container' },
    { id: 4, name: 'Bốc xếp Container 40 Empty', unit: 'Cont', price: 500000,  category: 'Container' },
    { id: 5, name: 'Cước vận chuyển',             unit: 'Cont', price: 2000000, category: 'Vận tải'   },
  ],
  quotations: [],
  quotation_items: [],
  reconciliation_logs: [],
  registration_services: [],
  registrations: [],
  registration_items: [],
  audit_logs: [],
  app_config: [
    { key: 'fallback', value: { price: 44780, date: '2026-04-04' } }
  ],
  users: [],
};

let autoId = 1000;
function nextId() { return ++autoId; }

// ─── Generic helpers (mirroring db.ts API) ───────────────────────────────────
export async function query<T = any>(_text: string, _params?: any[]): Promise<T[]> {
  // Simple in-memory — return empty for raw SQL queries
  return [] as T[];
}

export async function queryOne<T = any>(_text: string, _params?: any[]): Promise<T | null> {
  return null;
}

export async function execute(text: string, params?: any[]): Promise<void> {
  // Handle specific SQL patterns needed by the app in memory mode
  const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase();

  // Unpin all: UPDATE fuel_prices SET is_published = FALSE
  if (normalized.includes('update fuel_prices') && normalized.includes('is_published') && normalized.includes('false')) {
    store.fuel_prices = store.fuel_prices.map(p => ({ ...p, isPublished: false }));
    return;
  }

  // Pin specific: UPDATE fuel_prices SET is_published = TRUE WHERE id = $1
  if (normalized.includes('update fuel_prices') && normalized.includes('is_published') && normalized.includes('true') && params?.[0] !== undefined) {
    const id = Number(params[0]);
    store.fuel_prices = store.fuel_prices.map(p => ({ ...p, isPublished: p.id === id }));
    return;
  }

  // Edit price value: UPDATE fuel_prices SET price_v1 = $1 WHERE id = $2
  if (normalized.includes('update fuel_prices') && normalized.includes('price_v1') && params?.[0] !== undefined && params?.[1] !== undefined) {
    const [priceV1, id] = params;
    const idx = store.fuel_prices.findIndex(p => p.id === Number(id));
    if (idx >= 0) {
      store.fuel_prices[idx] = { ...store.fuel_prices[idx], priceV1: Number(priceV1) };
    }
    return;
  }
  // Other SQL → no-op (audit logs etc.)
}

export async function withTransaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
  return fn(null);
}

// ─── Fuel Prices ─────────────────────────────────────────────────────────────
export async function getAllPrices() {
  return store.fuel_prices.map(r => ({
    id: r.id, date: r.date, effectiveAt: r.effectiveAt,
    fuelType: r.fuelType, priceV1: r.priceV1, isPublished: r.isPublished
  })).sort((a, b) => b.date.localeCompare(a.date));
}
export async function replacePrices(rows: any[], _client?: any) {
  store.fuel_prices = rows.map((r, i) => ({
    id: r.id || nextId(), date: r.date,
    effectiveAt: r.effectiveAt || null,
    fuelType: r.fuelType || 'Dầu DO 0,05S-II',
    priceV1: r.priceV1, isPublished: r.isPublished ?? false
  }));
}

// ─── Tiers ───────────────────────────────────────────────────────────────────
export async function getAllTiers() {
  return store.tiers.map(r => ({
    id: r.id, minPrice: r.minPrice, maxPrice: r.maxPrice,
    surcharge20F: r.surcharge20F, surcharge40F: r.surcharge40F,
    surcharge20E: r.surcharge20E, surcharge40E: r.surcharge40E
  })).sort((a, b) => a.minPrice - b.minPrice);
}
export async function replaceTiers(rows: any[], _client?: any) {
  store.tiers = rows.map((r, i) => ({ id: r.id || nextId(), ...r }));
}

// ─── Bulk Tiers ──────────────────────────────────────────────────────────────
export async function getAllBulkTiers() {
  return store.bulk_tiers.map(r => ({
    id: r.id, minPrice: r.minPrice, maxPrice: r.maxPrice,
    percentSurcharge: r.percentSurcharge
  })).sort((a, b) => a.minPrice - b.minPrice);
}
export async function replaceBulkTiers(rows: any[], _client?: any) {
  store.bulk_tiers = rows.map((r, i) => ({ id: r.id || nextId(), ...r }));
}

// ─── Customers ───────────────────────────────────────────────────────────────
export async function getAllCustomers() {
  return store.customers.map(r => ({
    id: r.id, name: r.name, email: r.email, phone: r.phone,
    address: r.address, taxCode: r.taxCode, status: r.status
  }));
}
export async function replaceCustomers(rows: any[], _client?: any) {
  store.customers = rows.map(r => ({ id: r.id || nextId(), ...r }));
}

// ─── Services ────────────────────────────────────────────────────────────────
export async function getAllServices() {
  return store.services.map(r => ({ id: r.id, name: r.name, unit: r.unit, price: r.price, category: r.category }));
}
export async function replaceServices(rows: any[], _client?: any) {
  store.services = rows.map(r => ({ id: r.id || nextId(), ...r }));
}

// ─── Quotations ──────────────────────────────────────────────────────────────
export async function getAllQuotations() {
  return store.quotations.map(q => ({ ...q, items: (q as any).items || [] }));
}
export async function replaceQuotations(rows: any[], _client?: any) {
  store.quotations = rows.map(r => ({ id: r.id || nextId(), quotationNo: r.quotationNo, customerName: r.customerName, date: r.date, total: r.total || 0, status: r.status || 'draft', createdBy: r.createdBy, items: r.items || [] }));
}

// ─── Reconciliation Logs ─────────────────────────────────────────────────────
export async function getAllReconLogs() {
  return store.reconciliation_logs.map(r => ({
    id: r.id, containerId: r.containerId, containerType: r.containerType,
    bookingDate: r.bookingDate, checkDate: r.checkDate,
    fuelPriceAtBooking: r.fuelPriceAtBooking, fuelPriceNow: r.fuelPriceNow,
    surchargeAtBooking: r.surchargeAtBooking, surchargeNow: r.surchargeNow,
    delta: r.delta, status: r.status, note: r.note, createdAt: r.createdAt
  }));
}
export async function replaceReconLogs(rows: any[], _client?: any) {
  store.reconciliation_logs = rows.map(r => ({ id: r.id || nextId(), ...r, createdAt: r.createdAt || new Date().toISOString() }));
}

// ─── Registration Services ───────────────────────────────────────────────────
export async function getAllRegistrationServices() {
  return store.registration_services;
}
export async function replaceRegistrationServices(rows: any[], _client?: any) {
  store.registration_services = rows.map(r => ({ id: r.id || nextId(), name: r.name, unit: r.unit }));
}

// ─── Registrations ───────────────────────────────────────────────────────────
export async function getAllRegistrations() {
  return store.registrations.map(r => ({ ...r, items: r.items || [] }));
}
export async function replaceRegistrations(rows: any[], _client?: any) {
  store.registrations = rows.map(r => ({ id: r.id || nextId(), ...r, items: r.items || [], createdAt: r.createdAt || new Date().toISOString() }));
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────
export async function getAllAuditLogs() {
  return store.audit_logs.slice(0, 200);
}
export async function insertAuditLog(action: string, details: string) {
  store.audit_logs.unshift({ id: nextId(), action, details, timestamp: new Date().toISOString() });
}

// ─── App Config ──────────────────────────────────────────────────────────────
export async function getConfig(key: string): Promise<any | null> {
  const item = store.app_config.find(c => c.key === key);
  return item ? item.value : null;
}
export async function setConfig(key: string, value: any): Promise<void> {
  const idx = store.app_config.findIndex(c => c.key === key);
  if (idx >= 0) { store.app_config[idx].value = value; }
  else { store.app_config.push({ key, value }); }
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function findUserByUsername(username: string) {
  // Pre-seed admin user with password "admin@@@@"
  if (store.users.length === 0) {
    const hash = bcrypt.hashSync("admin@@@@", 10);
    store.users.push({ id: 1, username: "admin", password_hash: hash, display_name: "Admin", role: "admin", created_at: new Date().toISOString() });
  }
  return store.users.find(u => u.username === username) || null;
}

export async function getAllUsers() {
  if (store.users.length === 0) await findUserByUsername("admin");
  return store.users.map(u => ({ id: u.id, username: u.username, displayName: u.display_name, role: u.role, createdAt: u.created_at || new Date().toISOString() }));
}

export async function createUser(username: string, passwordHash: string, displayName: string, role: string) {
  const id = nextId();
  store.users.push({ id, username, password_hash: passwordHash, display_name: displayName, role, created_at: new Date().toISOString() });
  return { id };
}

export async function updateUser(id: number, displayName: string, role: string, passwordHash?: string) {
  const u = store.users.find(u => u.id === id);
  if (u) {
    u.display_name = displayName;
    u.role = role;
    if (passwordHash) u.password_hash = passwordHash;
  }
}

export async function deleteUser(id: number) {
  store.users = store.users.filter(u => u.id !== id);
}

// ─── Init (no-op for memory mode) ────────────────────────────────────────────
export async function initDB(): Promise<void> {
  console.log("[DB-MEMORY] ✅ In-memory database initialized (no PostgreSQL needed)");
}

// ─── Table mapping (same as db.ts) ───────────────────────────────────────────
export const TABLE_GETTERS: Record<string, () => Promise<any[]>> = {
  prices: getAllPrices,
  tiers: getAllTiers,
  bulk_tiers: getAllBulkTiers,
  customers: getAllCustomers,
  services: getAllServices,
  quotations: getAllQuotations,
  audit: getAllAuditLogs,
  reconciliation_logs: getAllReconLogs,
  registration_services: getAllRegistrationServices,
  registrations: getAllRegistrations,
};

export const TABLE_SETTERS: Record<string, (rows: any[]) => Promise<void>> = {
  prices: (r) => replacePrices(r),
  tiers: (r) => replaceTiers(r),
  bulk_tiers: (r) => replaceBulkTiers(r),
  customers: (r) => replaceCustomers(r),
  services: (r) => replaceServices(r),
  quotations: (r) => replaceQuotations(r),
  reconciliation_logs: (r) => replaceReconLogs(r),
  registration_services: (r) => replaceRegistrationServices(r),
  registrations: (r) => replaceRegistrations(r),
};

export const pool = null;
