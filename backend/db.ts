import pg from "pg";

// Fix: Return DATE columns as 'YYYY-MM-DD' strings, not JavaScript Date objects.
// OID 1082 = DATE type in PostgreSQL.
pg.types.setTypeParser(1082, (val: string) => val);

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/logipro",
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error", err);
});

// ─── Generic helpers ─────────────────────────────────────────────────────────
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params?: any[]): Promise<void> {
  await pool.query(text, params);
}

// ─── Transaction helper ──────────────────────────────────────────────────────
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ─── Table helpers (camelCase ↔ snake_case mapping) ──────────────────────────

// fuel_prices
export async function getAllPrices() {
  return query("SELECT id, date, effective_at AS \"effectiveAt\", fuel_type AS \"fuelType\", price_v1 AS \"priceV1\", is_published AS \"isPublished\" FROM fuel_prices ORDER BY date DESC");
}
export async function replacePrices(rows: any[], client?: pg.PoolClient) {
  const q = client ?? pool;
  await q.query("DELETE FROM fuel_prices");
  for (const r of rows) {
    await q.query(
      `INSERT INTO fuel_prices (date, fuel_type, price_v1, effective_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (date) DO UPDATE SET fuel_type = EXCLUDED.fuel_type, price_v1 = EXCLUDED.price_v1, effective_at = EXCLUDED.effective_at`,
      [r.date, r.fuelType || "Dầu DO 0,05S-II", r.priceV1, r.effectiveAt || null]
    );
  }
}

// tiers
export async function getAllTiers() {
  return query(`SELECT id, min_price AS "minPrice", max_price AS "maxPrice",
    surcharge_20f AS "surcharge20F", surcharge_40f AS "surcharge40F",
    surcharge_20e AS "surcharge20E", surcharge_40e AS "surcharge40E" FROM tiers ORDER BY min_price`);
}
export async function replaceTiers(rows: any[], client?: pg.PoolClient) {
  const q = client ?? pool;
  await q.query("DELETE FROM tiers");
  for (const r of rows) {
    await q.query(
      "INSERT INTO tiers (min_price, max_price, surcharge_20f, surcharge_40f, surcharge_20e, surcharge_40e) VALUES ($1,$2,$3,$4,$5,$6)",
      [r.minPrice, r.maxPrice, r.surcharge20F, r.surcharge40F, r.surcharge20E, r.surcharge40E]
    );
  }
}

// bulk_tiers
export async function getAllBulkTiers() {
  return query(`SELECT id, min_price AS "minPrice", max_price AS "maxPrice",
    percent_surcharge AS "percentSurcharge" FROM bulk_tiers ORDER BY min_price`);
}
export async function replaceBulkTiers(rows: any[], client?: pg.PoolClient) {
  const q = client ?? pool;
  await q.query("DELETE FROM bulk_tiers");
  for (const r of rows) {
    await q.query(
      "INSERT INTO bulk_tiers (min_price, max_price, percent_surcharge) VALUES ($1,$2,$3)",
      [r.minPrice, r.maxPrice, r.percentSurcharge]
    );
  }
}

// customers
export async function getAllCustomers() {
  return query(`SELECT id, name, email, phone, address, tax_code AS "taxCode", status FROM customers ORDER BY id`);
}
export async function replaceCustomers(rows: any[], client?: pg.PoolClient) {
  const q = client ?? pool;
  await q.query("DELETE FROM customers");
  for (const r of rows) {
    await q.query(
      "INSERT INTO customers (name, email, phone, address, tax_code, status) VALUES ($1,$2,$3,$4,$5,$6)",
      [r.name, r.email, r.phone, r.address, r.taxCode, r.status || "active"]
    );
  }
}

// services
export async function getAllServices() {
  return query("SELECT id, name, unit, price, category FROM services ORDER BY id");
}
export async function replaceServices(rows: any[], client?: pg.PoolClient) {
  const q = client ?? pool;
  await q.query("DELETE FROM services");
  for (const r of rows) {
    await q.query(
      "INSERT INTO services (name, unit, price, category) VALUES ($1,$2,$3,$4)",
      [r.name, r.unit, r.price, r.category]
    );
  }
}

// quotations + quotation_items
export async function getAllQuotations() {
  const headers = await query(`SELECT id, quotation_no AS "quotationNo", customer_name AS "customerName",
    date, total, status, created_by AS "createdBy" FROM quotations ORDER BY id DESC`);
  for (const h of headers) {
    const items = await query(
      `SELECT id, name, unit, quantity, price, total, note FROM quotation_items WHERE quotation_id = $1 ORDER BY id`,
      [h.id]
    );
    h.items = items;
  }
  return headers;
}
export async function replaceQuotations(rows: any[], client?: pg.PoolClient) {
  const q = client ?? pool;
  await q.query("DELETE FROM quotations");
  for (const r of rows) {
    const res = await q.query(
      `INSERT INTO quotations (quotation_no, customer_name, date, total, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [r.quotationNo, r.customerName, r.date || null, r.total || 0, r.status || "draft", r.createdBy]
    );
    const qId = res.rows[0].id;
    if (Array.isArray(r.items)) {
      for (const item of r.items) {
        await q.query(
          `INSERT INTO quotation_items (quotation_id, name, unit, quantity, price, total, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [qId, item.name, item.unit, item.quantity, item.price, item.total, item.note]
        );
      }
    }
  }
}

// reconciliation_logs
export async function getAllReconLogs() {
  return query(`SELECT id, container_id AS "containerId", container_type AS "containerType",
    booking_date AS "bookingDate", check_date AS "checkDate",
    fuel_price_at_booking AS "fuelPriceAtBooking", fuel_price_now AS "fuelPriceNow",
    surcharge_at_booking AS "surchargeAtBooking", surcharge_now AS "surchargeNow",
    delta, status, note, created_at AS "createdAt"
    FROM reconciliation_logs ORDER BY created_at DESC`);
}
export async function replaceReconLogs(rows: any[], client?: pg.PoolClient) {
  const q = client ?? pool;
  await q.query("DELETE FROM reconciliation_logs");
  for (const r of rows) {
    await q.query(
      `INSERT INTO reconciliation_logs
       (container_id, container_type, booking_date, check_date,
        fuel_price_at_booking, fuel_price_now, surcharge_at_booking, surcharge_now,
        delta, status, note, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [r.containerId, r.containerType, r.bookingDate, r.checkDate,
       r.fuelPriceAtBooking, r.fuelPriceNow, r.surchargeAtBooking, r.surchargeNow,
       r.delta, r.status, r.note, r.createdAt || new Date().toISOString()]
    );
  }
}

// registration_services
export async function getAllRegistrationServices() {
  return query("SELECT id, name, unit FROM registration_services ORDER BY id");
}
export async function replaceRegistrationServices(rows: any[], client?: pg.PoolClient) {
  const q = client ?? pool;
  await q.query("DELETE FROM registration_services");
  for (const r of rows) {
    await q.query("INSERT INTO registration_services (name, unit) VALUES ($1,$2)", [r.name, r.unit]);
  }
}

// registrations + registration_items
export async function getAllRegistrations() {
  const headers = await query(`SELECT id, registration_number AS "registrationNumber",
    registration_date AS "registrationDate", customer_name AS "customerName",
    customer_address AS "customerAddress", customer_phone AS "customerPhone",
    working_date AS "workingDate", cargo_type AS "cargoType",
    container_type AS "containerType", customer_notes AS "customerNotes",
    created_at AS "createdAt"
    FROM registrations ORDER BY id DESC`);
  for (const h of headers) {
    h.items = await query(
      `SELECT id, service_name AS "serviceName", size, quantity FROM registration_items WHERE registration_id = $1 ORDER BY id`,
      [h.id]
    );
  }
  return headers;
}
export async function replaceRegistrations(rows: any[], client?: pg.PoolClient) {
  const q = client ?? pool;
  await q.query("DELETE FROM registrations");
  for (const r of rows) {
    const res = await q.query(
      `INSERT INTO registrations (registration_number, registration_date, customer_name,
       customer_address, customer_phone, working_date, cargo_type, container_type, customer_notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [r.registrationNumber, r.registrationDate || null, r.customerName,
       r.customerAddress, r.customerPhone, r.workingDate || null,
       r.cargoType, r.containerType, r.customerNotes, r.createdAt || new Date().toISOString()]
    );
    const regId = res.rows[0].id;
    if (Array.isArray(r.items)) {
      for (const item of r.items) {
        await q.query(
          "INSERT INTO registration_items (registration_id, service_name, size, quantity) VALUES ($1,$2,$3,$4)",
          [regId, item.serviceName, item.size, item.quantity]
        );
      }
    }
  }
}

// audit_logs
export async function getAllAuditLogs() {
  return query(`SELECT id, action, details, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 200`);
}
export async function insertAuditLog(action: string, details: string) {
  await execute("INSERT INTO audit_logs (action, details) VALUES ($1, $2)", [action, details]);
}

// app_config
export async function getConfig(key: string): Promise<any | null> {
  const row = await queryOne<{ value: any }>("SELECT value FROM app_config WHERE key = $1", [key]);
  return row ? row.value : null;
}
export async function setConfig(key: string, value: any): Promise<void> {
  await execute(
    `INSERT INTO app_config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2`,
    [key, JSON.stringify(value)]
  );
}

// users
export async function findUserByUsername(username: string) {
  return queryOne<{ id: number; username: string; password_hash: string; display_name: string; role: string }>(
    "SELECT id, username, password_hash, display_name, role FROM users WHERE username = $1",
    [username]
  );
}

export async function getAllUsers() {
  return query<{ id: number; username: string; displayName: string; role: string; createdAt: string }>(
    `SELECT id, username, display_name AS "displayName", role, created_at AS "createdAt" FROM users ORDER BY id`
  );
}

export async function createUser(username: string, passwordHash: string, displayName: string, role: string) {
  return queryOne<{ id: number }>(
    `INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id`,
    [username, passwordHash, displayName, role]
  );
}

export async function updateUser(id: number, displayName: string, role: string, passwordHash?: string) {
  if (passwordHash) {
    await execute(
      `UPDATE users SET display_name = $1, role = $2, password_hash = $3 WHERE id = $4`,
      [displayName, role, passwordHash, id]
    );
  } else {
    await execute(
      `UPDATE users SET display_name = $1, role = $2 WHERE id = $3`,
      [displayName, role, id]
    );
  }
}

export async function deleteUser(id: number) {
  await execute(`DELETE FROM users WHERE id = $1`, [id]);
}

// ─── Init: run schema ────────────────────────────────────────────────────────
export async function initDB(): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  const schemaPath = path.join(import.meta.dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");
  await pool.query(sql);
  console.log("[DB] ✅ Schema initialized");
}

// ─── Mapping for CRUD routes ─────────────────────────────────────────────────
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
  prices: (r) => withTransaction((c) => replacePrices(r, c)),
  tiers: (r) => withTransaction((c) => replaceTiers(r, c)),
  bulk_tiers: (r) => withTransaction((c) => replaceBulkTiers(r, c)),
  customers: (r) => withTransaction((c) => replaceCustomers(r, c)),
  services: (r) => withTransaction((c) => replaceServices(r, c)),
  quotations: (r) => withTransaction((c) => replaceQuotations(r, c)),
  reconciliation_logs: (r) => withTransaction((c) => replaceReconLogs(r, c)),
  registration_services: (r) => withTransaction((c) => replaceRegistrationServices(r, c)),
  registrations: (r) => withTransaction((c) => replaceRegistrations(r, c)),
};

export { pool };
