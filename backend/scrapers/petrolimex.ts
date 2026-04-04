import axios from "axios";
import { getFallbackConfig, logAudit } from "../config.js";
import { query, execute } from "../db.js";

// ─── Scraper cache ────────────────────────────────────────────────────────────
interface SyncResult {
  success: boolean;
  data: {
    fuelType: string;
    priceV1: number;
    date: string;
    effectiveDate: string;
    source: string;
    articleUrl: string;
    status: string;
    parsedFromWeb: boolean;
  };
}

interface ScraperCache { data: SyncResult; timestamp: number; }
let scraperCache: ScraperCache | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function isCacheValid(): boolean {
  return !!scraperCache && (Date.now() - scraperCache.timestamp) < CACHE_TTL_MS;
}

export function clearCache(): void {
  scraperCache = null;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FUEL_TYPE = "Dầu DO 0,05S-II";
const FUEL_TITLE_MATCH = "DO 0,05S-II"; // Title in VIEApps API response

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ─── Strategy 1: VIEApps Portals API (real price from Petrolimex website) ─────
// This is the same API that powers the "Giá bán lẻ xăng dầu" hover panel
// on petrolimex.com.vn — returns actual Zone1/Zone2 prices as structured JSON.
interface VieAppsProduct {
  ID: string;
  Title: string;
  Zone1Price: number;
  Zone2Price: number;
  LastModified: string;
}

async function fetchFromVieAppsAPI(): Promise<{
  priceV1: number;
  effectiveDate: string;
  lastModified: string;
  allProducts: VieAppsProduct[];
} | null> {
  try {
    const requestPayload = {
      FilterBy: {
        And: [
          { SystemID: { Equals: "6783dc1271ff449e95b74a9520964169" } },
          { RepositoryID: { Equals: "a95451e23b474fe5886bfb7cf843f53c" } },
          { RepositoryEntityID: { Equals: "3801378fe1e045b1afa10de7c5776124" } },
          { Status: { Equals: "Published" } },
        ],
      },
      SortBy: { LastModified: "Descending" },
      Pagination: { TotalRecords: -1, TotalPages: 0, PageSize: 0, PageNumber: 0 },
    };
    const b64 = Buffer.from(JSON.stringify(requestPayload))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    const url = `https://portals.petrolimex.com.vn/~apis/portals/cms.item/search?x-request=${encodeURIComponent(b64)}`;

    const res = await axios.get(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      timeout: 15000,
    });

    const data = res.data;
    if (!data?.Objects?.length) {
      console.error("[Petrolimex API] Không có sản phẩm nào trong response");
      return null;
    }

    const allProducts: VieAppsProduct[] = data.Objects.map((item: any) => ({
      ID: item.ID,
      Title: item.Title,
      Zone1Price: item.Zone1Price,
      Zone2Price: item.Zone2Price,
      LastModified: item.LastModified,
    }));

    // Find DO 0,05S-II
    const doProduct = allProducts.find(
      (p) => p.Title === FUEL_TITLE_MATCH || p.Title.includes("DO 0,05S"),
    );

    if (!doProduct || !doProduct.Zone1Price) {
      console.error("[Petrolimex API] Không tìm thấy sản phẩm DO 0,05S-II trong danh sách:", allProducts.map(p => p.Title));
      return null;
    }

    // effectiveDate = date portion of LastModified (the most recent update across all products)
    const latestModified = allProducts
      .map(p => new Date(p.LastModified).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    const effectiveDate = new Date(latestModified).toISOString().split("T")[0];

    console.log(`[Petrolimex API] ✅ Giá DO 0,05S-II Vùng 1: ${doProduct.Zone1Price.toLocaleString()}đ (cập nhật: ${effectiveDate})`);
    console.log(`[Petrolimex API]    Tất cả sản phẩm: ${allProducts.map(p => `${p.Title}=${p.Zone1Price}`).join(", ")}`);

    return {
      priceV1: doProduct.Zone1Price,
      effectiveDate,
      lastModified: new Date(latestModified).toISOString(),
      allProducts,
    };
  } catch (e: any) {
    console.error("[Petrolimex API] Lỗi gọi VIEApps API:", e.message);
    return null;
  }
}

// ─── Main sync logic ──────────────────────────────────────────────────────────
export async function internalSyncLogic(force = false): Promise<SyncResult> {
  if (!force && isCacheValid() && scraperCache) {
    console.log("[Petrolimex Scraper] Trả về từ cache (còn hiệu lực)");
    return scraperCache.data;
  }

  const today = todayStr();
  const fallbackCfg = await getFallbackConfig();

  // Strategy 1: VIEApps Portals API (real prices from petrolimex.com.vn)
  console.log("[Petrolimex Scraper] Đang gọi VIEApps API (giá bán lẻ chính thức)...");
  const apiResult = await fetchFromVieAppsAPI();

  let result: SyncResult;

  if (apiResult) {
    result = {
      success: true,
      data: {
        fuelType: FUEL_TYPE,
        priceV1: apiResult.priceV1,
        date: today,
        effectiveDate: apiResult.effectiveDate,
        source: `Petrolimex API (cập nhật ${apiResult.effectiveDate})`,
        articleUrl: "https://www.petrolimex.com.vn/thong-tin-khach-hang.html#cuahangxangdau",
        status: `CÀO THẬT từ web: ${apiResult.priceV1.toLocaleString()}đ (cập nhật ${apiResult.effectiveDate})`,
        parsedFromWeb: true,
      },
    };
  } else {
    console.log("[Petrolimex Scraper] ⚠️ Không cào được giá từ web → Dùng giá fallback");
    result = {
      success: true,
      data: {
        fuelType: FUEL_TYPE,
        priceV1: fallbackCfg.price,
        date: today,
        effectiveDate: fallbackCfg.date,
        source: `⚠️ FALLBACK — Không cào được từ web. Giá lưu sẵn ngày ${fallbackCfg.date}`,
        articleUrl: "",
        status: `FALLBACK: ${fallbackCfg.price.toLocaleString()}đ ngày ${fallbackCfg.date} — Hãy kiểm tra lại!`,
        parsedFromWeb: false,
      },
    };
  }

  scraperCache = { data: result, timestamp: Date.now() };
  return result;
}

// ─── Sync and save to database ────────────────────────────────────────────────
export async function syncAndSave(force = false): Promise<SyncResult & { saved: boolean; message: string }> {
  const result = await internalSyncLogic(force);

  if (!result.success || !result.data.priceV1) {
    return { ...result, saved: false, message: "Không có dữ liệu giá để lưu." };
  }

  const { effectiveDate, fuelType, priceV1 } = result.data;

  // UPSERT: insert or update if date already exists
  const upsertResult = await query(
    `INSERT INTO fuel_prices (date, fuel_type, price_v1) VALUES ($1, $2, $3)
     ON CONFLICT (date) DO UPDATE SET fuel_type = EXCLUDED.fuel_type, price_v1 = EXCLUDED.price_v1
     RETURNING (xmax = 0) AS inserted`,
    [effectiveDate, fuelType, priceV1],
  );
  const wasInserted = upsertResult[0]?.inserted ?? true;

  const action = wasInserted ? "Thêm mới" : "Cập nhật";
  await logAudit("SYNC_PRICE", `${action} giá: ${priceV1.toLocaleString()}đ ngày ${effectiveDate} (${result.data.source})`);

  return {
    ...result,
    saved: true,
    message: wasInserted
      ? `✅ Đã lưu giá ${priceV1.toLocaleString()}đ cho ngày ${effectiveDate}.`
      : `✅ Đã cập nhật giá ${priceV1.toLocaleString()}đ cho ngày ${effectiveDate}.`,
  };
}

// ─── Cron sync (called by daily scheduler) ────────────────────────────────────
export async function cronSync(): Promise<void> {
  console.log("[Cron] 🕖 Bắt đầu đồng bộ giá dầu tự động...");
  try {
    const result = await syncAndSave(true);
    if (result.saved) {
      console.log(`[Cron] ✅ ${result.message}`);
    } else {
      console.log(`[Cron] ℹ️ ${result.message}`);
    }

    // Always ensure today has a price row
    const today = todayStr();
    const todayRow = await query(
      `SELECT id FROM fuel_prices WHERE date = $1`, [today]
    );

    if (todayRow.length === 0) {
      // No row for today — copy the most recent price
      const latest = await query(
        `SELECT fuel_type, price_v1 FROM fuel_prices ORDER BY date DESC LIMIT 1`
      );
      if (latest.length > 0) {
        await execute(
          `INSERT INTO fuel_prices (date, fuel_type, price_v1) VALUES ($1, $2, $3)
           ON CONFLICT (date) DO NOTHING`,
          [today, latest[0].fuel_type, latest[0].price_v1]
        );
        console.log(`[Cron] 📋 Sao chép giá ${latest[0].price_v1}đ cho ngày ${today} (giá không đổi)`);
        await logAudit("CRON_COPY_PRICE", `Sao chép giá ${latest[0].price_v1}đ cho ngày ${today} (giá không đổi)`);
      }
    }

    // Always publish today's price to homepage
    await execute(`UPDATE fuel_prices SET is_published = FALSE`);
    await execute(`UPDATE fuel_prices SET is_published = TRUE WHERE date = $1`, [today]);
    console.log(`[Cron] 📌 Đã ghim giá ngày ${today} lên Trang Chủ`);
  } catch (e: any) {
    console.error(`[Cron] ❌ Lỗi đồng bộ: ${e.message}`);
    await logAudit("CRON_SYNC_ERROR", `Lỗi cào tự động: ${e.message}`);
  }
}
