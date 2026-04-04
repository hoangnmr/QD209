import axios from "axios";
import * as cheerio from "cheerio";
import { getFallbackConfig, logAudit } from "../config.js";
import { query, execute } from "../db.js";
import { getVietnamTodayIsoDate } from "../utils/vietnamTime.js";

// ─── Scraper cache ────────────────────────────────────────────────────────────
interface SyncResult {
  success: boolean;
  data: {
    fuelType: string;
    priceV1: number;
    date: string;
    effectiveDate: string;
    effectiveAt: string | null;
    source: string;
    articleUrl: string;
    status: string;
    parsedFromWeb: boolean;
    isNewArticle: boolean;
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

// ─── Parser strategies (from Bao_gia_phu_thu_Dau DO) ─────────────────────────
function parseFromTable($: cheerio.CheerioAPI): number | null {
  let found: number | null = null;
  $("table tr").each((_i, row) => {
    const rowText = $(row).text();
    if (rowText.includes("0,05S") || rowText.toLowerCase().includes("điêzen") || rowText.toLowerCase().includes("diesel")) {
      $(row).find("td").each((_j, cell) => {
        const cellText = $(cell).text().trim().replace(/\./g, "").replace(/,/g, "");
        const numVal = parseInt(cellText);
        if (!isNaN(numVal) && numVal >= 15000 && numVal <= 60000) {
          found = numVal;
          return false;
        }
      });
      if (found) return false;
    }
  });
  return found;
}

function parseFromBodyText($: cheerio.CheerioAPI): number | null {
  const bodyText = $("body").text();
  const patterns = [
    /(?:Điêzen|Diesel|điêzen|diesel)\s*0[,.]05S[^:]*?:\s*(\d{2}[.,]\d{3})/i,
    /(?:DO|Dầu\s+DO)\s*0[,.]05S[^0-9]*?(\d{2}[.,]\d{3})\s*(?:đ|đồng|VND)/i,
    /0[,.]05S[^0-9]{0,30}?(\d{2}[.,]\d{3})/i,
    /0[,.]05S[^0-9]{0,100}?(\d{2}[.,]\d{3})/i,
  ];
  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match) {
      const price = parseInt(match[1].replace(/[.,]/g, ""));
      if (price >= 15000 && price <= 60000) return price;
    }
  }
  return null;
}

function parseFromStructuredDiv($: cheerio.CheerioAPI): number | null {
  let found: number | null = null;
  $("*").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length < 200 && text.includes("0,05S")) {
      const numMatch = text.match(/(\d{2}[.,]\d{3})/);
      if (numMatch) {
        const price = parseInt(numMatch[1].replace(/[.,]/g, ""));
        if (price >= 15000 && price <= 60000) { found = price; return false; }
      }
    }
  });
  return found;
}

function parseAllPriceNumbers($: cheerio.CheerioAPI): number | null {
  const bodyText = $("body").text();
  const allNumbers = bodyText.match(/\d{2}[.,]\d{3}/g) || [];
  for (const numStr of allNumbers) {
    const val = parseInt(numStr.replace(/[.,]/g, ""));
    if (val >= 35000 && val <= 55000) {
      const context = bodyText.substring(
        Math.max(0, bodyText.indexOf(numStr) - 80),
        bodyText.indexOf(numStr) + numStr.length + 20
      ).toLowerCase();
      if (context.includes("0,05s") || context.includes("diesel") || context.includes("điêzen") || context.includes("dầu do")) {
        console.log(`[Petrolimex Scraper] ✅ Parse từ BROAD SEARCH: ${val} đ`);
        return val;
      }
    }
  }
  return null;
}

function extractDateFromText(text: string): string | null {
  if (!text) return null;
  const d1 = text.match(/(\d{1,2})[.\s/-](\d{1,2})[.\s/-](\d{4})/);
  if (d1) return `${d1[3]}-${String(d1[2]).padStart(2, '0')}-${String(d1[1]).padStart(2, '0')}`;
  const d2 = text.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i);
  if (d2) return `${d2[3]}-${String(d2[2]).padStart(2, '0')}-${String(d2[1]).padStart(2, '0')}`;
  const d3 = text.match(/ngày\s+(\d{1,2})\/(\d{1,2})/i);
  if (d3) {
    const y = Number(getVietnamTodayIsoDate().slice(0, 4));
    return `${y}-${String(d3[2]).padStart(2, '0')}-${String(d3[1]).padStart(2, '0')}`;
  }
  return null;
}

function extractDateFromUrl(url: string): string | null {
  const m = url.match(/ngay-(\d{2})-(\d{1,2})-(\d{4})/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  return null;
}

function formatDateInVietnam(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function buildIsoDateTime(year: string | number, month: string | number, day: string | number, hour: string | number, minute: string | number, second: string | number = "00"): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+07:00`;
}

function extractEffectiveDateTimeFromText(text: string): string | null {
  if (!text) return null;
  const precise = text.match(/(\d{1,2})\s*giờ\s*(\d{1,2})\s*phút(?:\s*(\d{1,2})\s*giây)?[^0-9]{0,30}ngày\s*(\d{1,2})[.\s/-](\d{1,2})[.\s/-](\d{4})/i);
  if (precise) {
    const [, hour, minute, second = "00", day, month, year] = precise;
    return buildIsoDateTime(year, month, day, hour, minute, second);
  }
  const slashPrecise = text.match(/(\d{1,2})[:h](\d{2})(?::(\d{2}))?[^0-9]{0,30}(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (slashPrecise) {
    const [, hour, minute, second = "00", day, month, year] = slashPrecise;
    return buildIsoDateTime(year, month, day, hour, minute, second);
  }
  return null;
}

async function fetchLatestArticleMetadata(headers: Record<string, string>) {
  const listResponse = await axios.get("https://petrolimex.com.vn/ndi/thong-cao-bao-chi.html", {
    headers, timeout: 15000
  });
  const $ = cheerio.load(listResponse.data);
  let latestArticleUrl = "";
  $("a").each((_i, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes("dieu-chinh-gia-xang-dau") && !latestArticleUrl) {
      latestArticleUrl = href.startsWith("http") ? href : `https://petrolimex.com.vn${href}`;
    }
  });
  if (!latestArticleUrl) throw new Error("Không tìm thấy bài thông cáo");

  const articleResponse = await axios.get(latestArticleUrl, { headers, timeout: 15000 });
  const $article = cheerio.load(articleResponse.data);
  const titleText = $article("h1, h2, .title, .article-title").first().text();
  const bodyText = $article("body").text();
  const effectiveAt = extractEffectiveDateTimeFromText(`${titleText} ${bodyText}`);
  const effectiveDate = effectiveAt?.slice(0, 10) || extractDateFromUrl(latestArticleUrl) || extractDateFromText(titleText) || extractDateFromText(bodyText);

  return { latestArticleUrl, $article, titleText, bodyText, effectiveDate, effectiveAt };
}

// ─── VIEApps CMS API (PRIMARY strategy) ──────────────────────────────────────
const VIEAPPS_FILTER = {
  FilterBy: { And: [
    { SystemID: { Equals: "6783dc1271ff449e95b74a9520964169" } },
    { RepositoryID: { Equals: "a95451e23b474fe5886bfb7cf843f53c" } },
    { RepositoryEntityID: { Equals: "3801378fe1e045b1afa10de7c5776124" } },
    { Status: { Equals: "Published" } }
  ]},
  SortBy: { LastModified: "Descending" },
  Pagination: { TotalRecords: -1, TotalPages: 0, PageSize: 0, PageNumber: 0 }
};

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function fetchFromVieAppsAPI(): Promise<{ price: number; lastModified: string } | null> {
  try {
    const xRequest = base64UrlEncode(JSON.stringify(VIEAPPS_FILTER));
    const url = `https://portals.petrolimex.com.vn/~apis/portals/cms.item/search?x-request=${xRequest}&x-device-id=logipro-scraper&language=vi-VN`;
    const resp = await axios.get(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      timeout: 15000
    });
    const data = resp.data;
    const objects: any[] = data?.Objects || [];
    const doProduct = objects.find((o: any) =>
      o.Title === "DO 0,05S-II" || o.Alias === "do-005s-ii" ||
      (o.Title || "").toLowerCase().includes("do 0,05s")
    );
    if (doProduct && typeof doProduct.Zone1Price === "number" && doProduct.Zone1Price >= 15000 && doProduct.Zone1Price <= 60000) {
      return { price: doProduct.Zone1Price, lastModified: doProduct.LastModified || "" };
    }
    console.warn("[Petrolimex API] DO 0,05S-II not found. Products:", objects.map((o: any) => o.Title).join(", "));
    return null;
  } catch (err: any) {
    console.warn(`[Petrolimex API] VIEApps CMS API failed: ${err.message}`);
    return null;
  }
}

// ─── Main sync logic (5-strategy resilient) ──────────────────────────────────
export async function internalSyncLogic(force = false): Promise<SyncResult> {
  const today = getVietnamTodayIsoDate();

  if (!force && isCacheValid() && scraperCache) {
    console.log("[Petrolimex Scraper] Trả về từ cache (còn hiệu lực)");
    return scraperCache.data;
  }

  const HEADERS = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9', 'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8' };

  // ── Strategy 0 (PRIMARY): VIEApps CMS JSON API ────────────────────────────
  const apiResult = await fetchFromVieAppsAPI();
  if (apiResult) {
    const articleMetadata = await fetchLatestArticleMetadata(HEADERS).catch(() => null);
    const lm = new Date(apiResult.lastModified);
    const effectiveDate = articleMetadata?.effectiveDate || (!isNaN(lm.getTime())
      ? formatDateInVietnam(lm)
      : today);
    const effectiveAt = articleMetadata?.effectiveAt || `${effectiveDate}T00:00:00+07:00`;
    console.log(`[Petrolimex Scraper] ✅ VIEApps API: ${apiResult.price.toLocaleString()} đ (cập nhật ${effectiveDate})`);

    const result: SyncResult = {
      success: true,
      data: {
        fuelType: FUEL_TYPE, priceV1: apiResult.price, date: today, effectiveDate, effectiveAt,
        source: `Petrolimex (VIEApps CMS API — giá chính thức)`,
        articleUrl: articleMetadata?.latestArticleUrl || "",
        status: `CÀO THẬT từ web: ${apiResult.price.toLocaleString()}đ (cập nhật ${effectiveDate})`,
        parsedFromWeb: true,
        isNewArticle: false
      }
    };
    scraperCache = { data: result, timestamp: Date.now() };
    return result;
  }

  // ── Fallback: Article HTML parsing (Strategies 1–4) ───────────────────────
  console.log("[Petrolimex Scraper] ⚠️ VIEApps API thất bại → thử parse bài viết HTML...");
  try {
    const articleMetadata = await fetchLatestArticleMetadata(HEADERS);
    const latestArticleUrl = articleMetadata.latestArticleUrl;
    console.log(`[Petrolimex Scraper] 📰 Article URL: ${latestArticleUrl}`);
    const $a = articleMetadata.$article;
    let priceV1: number | null = null;
    let parseMethod = "";

    priceV1 = parseFromTable($a);
    if (priceV1) { parseMethod = "table"; }
    if (!priceV1) { priceV1 = parseFromBodyText($a); if (priceV1) parseMethod = "body-text"; }
    if (!priceV1) { priceV1 = parseFromStructuredDiv($a); if (priceV1) parseMethod = "structured-div"; }
    if (!priceV1) { priceV1 = parseAllPriceNumbers($a); if (priceV1) parseMethod = "broad-search"; }

    const parsedFromWeb = priceV1 !== null;
    const titleText = articleMetadata.titleText;
    const bodyExcerpt = articleMetadata.bodyText.slice(0, 1000);
    let effectiveDate = articleMetadata.effectiveDate || extractDateFromUrl(latestArticleUrl) || extractDateFromText(titleText) || extractDateFromText(bodyExcerpt);
    let effectiveAt = articleMetadata.effectiveAt || (effectiveDate ? `${effectiveDate}T00:00:00+07:00` : null);

    if (!parsedFromWeb) {
      const cfg = await getFallbackConfig();
      priceV1 = cfg.price;
      parseMethod = "fallback";
      if (!effectiveDate) effectiveDate = cfg.date;
      if (!effectiveAt) effectiveAt = `${cfg.date}T00:00:00+07:00`;
      console.log(`[Petrolimex Scraper] ⚠️ Tất cả strategy thất bại → Fallback: ${priceV1.toLocaleString()} đ`);
    } else {
      console.log(`[Petrolimex Scraper] ✅ Article parse: ${priceV1!.toLocaleString()} đ (method: ${parseMethod})`);
    }

    const cfg = await getFallbackConfig();
    const isNewArticle = effectiveDate ? effectiveDate !== cfg.date : false;

    const result: SyncResult = {
      success: true,
      data: {
        fuelType: FUEL_TYPE, priceV1: priceV1!, date: today, effectiveDate: effectiveDate!, effectiveAt: effectiveAt!,
        source: parsedFromWeb
          ? `Petrolimex (Article HTML, method: ${parseMethod})`
          : `Petrolimex (Giá điều hành đã biết ${effectiveDate} - Web không parse được)`,
        articleUrl: latestArticleUrl,
        status: parsedFromWeb ? `OK - Parsed via ${parseMethod}` : "OK - Fallback price",
        parsedFromWeb,
        isNewArticle
      }
    };
    scraperCache = { data: result, timestamp: Date.now() };
    return result;

  } catch (error: any) {
    console.error("[Petrolimex Scraper] Lỗi kết nối:", error.message);
    const fallbackCfg = await getFallbackConfig();
    const fallbackResult: SyncResult = {
      success: true,
      data: {
        fuelType: FUEL_TYPE, priceV1: fallbackCfg.price, date: today,
        effectiveDate: fallbackCfg.date,
        effectiveAt: `${fallbackCfg.date}T00:00:00+07:00`,
        source: `Giá điều hành ${fallbackCfg.date} (Lỗi kết nối: ${error.message})`,
        articleUrl: "",
        status: "Network Error - Using last known price", parsedFromWeb: false,
        isNewArticle: false
      }
    };
    scraperCache = { data: fallbackResult, timestamp: Date.now() - CACHE_TTL_MS + 30 * 60 * 1000 };
    return fallbackResult;
  }
}

// ─── Sync and save to PostgreSQL database ─────────────────────────────────────
export async function syncAndSave(force = false): Promise<SyncResult & { saved: boolean; message: string }> {
  const result = await internalSyncLogic(force);

  if (!result.success || !result.data.priceV1) {
    return { ...result, saved: false, message: "Không có dữ liệu giá để lưu." };
  }

  const { effectiveDate, fuelType, priceV1 } = result.data;
  const effectiveAt = result.data.effectiveAt || null;

  // UPSERT: insert or update if date already exists
  const upsertResult = await query(
    `INSERT INTO fuel_prices (date, fuel_type, price_v1, effective_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (date) DO UPDATE SET fuel_type = EXCLUDED.fuel_type, price_v1 = EXCLUDED.price_v1, effective_at = EXCLUDED.effective_at
     RETURNING (xmax = 0) AS inserted`,
    [effectiveDate, fuelType, priceV1, effectiveAt],
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
    const today = getVietnamTodayIsoDate();
    const todayRow = await query(
      `SELECT id FROM fuel_prices WHERE date = $1`, [today]
    );

    if (todayRow.length === 0) {
      const latest = await query(
        `SELECT fuel_type, price_v1, effective_at FROM fuel_prices ORDER BY date DESC LIMIT 1`
      );
      if (latest.length > 0) {
        await execute(
          `INSERT INTO fuel_prices (date, fuel_type, price_v1, effective_at) VALUES ($1, $2, $3, $4)
           ON CONFLICT (date) DO NOTHING`,
          [today, latest[0].fuel_type, latest[0].price_v1, latest[0].effective_at]
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
