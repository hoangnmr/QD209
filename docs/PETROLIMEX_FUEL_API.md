# Petrolimex Fuel Price API — Tài liệu kỹ thuật

## Tổng quan

Hệ thống lấy giá dầu **Dầu DO 0,05S-II** từ Petrolimex theo cơ chế **5-strategy resilient** (5 chiến lược dự phòng). Dữ liệu sau khi cào được lưu vào bảng `fuel_prices` trong PostgreSQL và phục vụ ra ngoài qua Public API.

---

## 1. Nguồn dữ liệu Petrolimex

### 1.1. Strategy 0 — VIEApps CMS JSON API *(Primary)*

Đây là chiến lược **ưu tiên cao nhất**, gọi trực tiếp vào CMS API nội bộ của Petrolimex.

**Endpoint gốc:**

```
GET https://portals.petrolimex.com.vn/~apis/portals/cms.item/search
```

**Query parameters:**

| Param          | Mô tả |
|----------------|--------|
| `x-request`    | Base64-URL-encoded JSON chứa bộ lọc (filter) |
| `x-device-id`  | Định danh thiết bị (tuỳ chọn) |
| `language`      | `vi-VN` |

**Bộ lọc (`x-request` sau khi decode):**

```json
{
  "FilterBy": {
    "And": [
      { "SystemID":           { "Equals": "6783dc1271ff449e95b74a9520964169" } },
      { "RepositoryID":       { "Equals": "a95451e23b474fe5886bfb7cf843f53c" } },
      { "RepositoryEntityID": { "Equals": "3801378fe1e045b1afa10de7c5776124" } },
      { "Status":             { "Equals": "Published" } }
    ]
  },
  "SortBy": { "LastModified": "Descending" },
  "Pagination": { "TotalRecords": -1, "TotalPages": 0, "PageSize": 0, "PageNumber": 0 }
}
```

**Cách encode `x-request`:**

```ts
function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
```

**Response trả về:**

```json
{
  "Objects": [
    {
      "Title": "DO 0,05S-II",
      "Alias": "do-005s-ii",
      "Zone1Price": 19920,
      "LastModified": "2026-04-05T15:00:00Z"
    }
  ]
}
```

Hệ thống tìm object có `Title === "DO 0,05S-II"` hoặc `Alias === "do-005s-ii"` rồi lấy trường `Zone1Price`. Giá hợp lệ nằm trong khoảng **15.000 – 60.000 đ/lít**.

### 1.2. Strategy 1–4 — HTML Article Scraper *(Fallback)*

Khi VIEApps API thất bại, hệ thống chuyển sang cào HTML từ trang thông cáo báo chí.

**Bước 1: Lấy danh sách bài viết**

```
GET https://petrolimex.com.vn/ndi/thong-cao-bao-chi.html
```

Tìm link bài viết chứa `dieu-chinh-gia-xang-dau` trong `href`.

**Bước 2: Đọc nội dung bài viết**

```
GET <articleUrl>  (ví dụ: https://petrolimex.com.vn/.../dieu-chinh-gia-xang-dau-ngay-05-4-2026.html)
```

**Bước 3: Parse giá từ HTML theo 4 strategy tuần tự:**

| Strategy | Tên | Mô tả |
|----------|-----|-------|
| 1 | `parseFromTable` | Tìm `<table>` chứa dòng "0,05S" / "điêzen" / "diesel", lấy giá từ `<td>` |
| 2 | `parseFromBodyText` | Regex trên toàn bộ body text với các pattern Diesel/DO 0,05S |
| 3 | `parseFromStructuredDiv` | Tìm element ngắn (< 200 ký tự) chứa "0,05S" rồi trích số |
| 4 | `parseAllPriceNumbers` | Broad search — quét tất cả số dạng `XX.XXX`, lọc trong context chứa keyword dầu |

**Bước 4: Trích ngày hiệu lực**

- Từ nội dung bài: regex dạng `"15 giờ 00 phút ngày 05/04/2026"`
- Từ URL bài viết: regex dạng `ngay-05-4-2026`
- Từ tiêu đề bài viết: regex ngày `dd/mm/yyyy` hoặc `dd.mm.yyyy`

### 1.3. Fallback cuối cùng

Nếu **tất cả strategy đều thất bại** (hoặc lỗi kết nối), hệ thống dùng **giá dự phòng** (`fallbackConfig`) — là giá đã biết gần nhất, được admin cấu hình thủ công.

---

## 2. Caching

- **TTL**: 6 giờ (`CACHE_TTL_MS = 6 * 60 * 60 * 1000`)
- Nếu cache còn hiệu lực và không `force`, trả luôn từ cache mà không gọi Petrolimex
- Khi lỗi mạng, cache được set TTL ngắn hơn (chỉ 30 phút) để retry sớm

---

## 3. Cron tự động (built-in scheduler)

- **Lịch chạy**: Mỗi ngày lúc **06:00 sáng giờ Việt Nam** (`Asia/Ho_Chi_Minh`)
- **Triển khai**: Module `backend/cron.ts` — dùng `setTimeout` + `setInterval` tính chính xác theo giờ VN, không cần dependency bên ngoài
- **Logic**:
  1. Gọi `syncAndSave(force=true)` — cào giá mới nhất từ Petrolimex
  2. **Bỏ qua ngày hiệu lực của Petrolimex** — luôn lưu vào ngày hiện tại VN với `effective_at = ${today}T06:00:00+07:00`
  3. UPSERT vào `fuel_prices` với `date = ngày hôm nay VN`
  4. Tự động ghim (`is_published = true`) giá vừa lưu, bỏ ghim các ngày khác
- **Lưu ý quan trọng**: `date` luôn là ngày hiện tại VN (lúc 6h sáng), KHÔNG phải ngày hiệu lực trên web Petrolimex hay ngày hôm qua

---

## 4. Internal API (yêu cầu Auth)

Base path: `/api`

### 4.1. `GET /api/petrolimex-sync`

Cào giá từ Petrolimex (chỉ đọc, **không lưu DB**).

| Param | Mô tả |
|-------|--------|
| `force=true` | Bỏ qua cache, cào trực tiếp |

**Response:**

```json
{
  "success": true,
  "data": {
    "fuelType": "Dầu DO 0,05S-II",
    "priceV1": 19920,
    "date": "2026-04-08",
    "effectiveDate": "2026-04-05",
    "effectiveAt": "2026-04-05T15:00:00+07:00",
    "source": "Petrolimex (VIEApps CMS API — giá chính thức)",
    "articleUrl": "https://petrolimex.com.vn/.../dieu-chinh-gia-xang-dau-...",
    "status": "CÀO THẬT từ web: 19.920đ (cập nhật 2026-04-05)",
    "parsedFromWeb": true,
    "isNewArticle": false
  }
}
```

### 4.2. `POST /api/petrolimex-sync`

Cào giá + **lưu vào DB** (UPSERT theo `date`). Yêu cầu header `Authorization: Bearer <token>`.

**Response:** Giống GET, thêm:

```json
{
  "saved": true,
  "message": "✅ Đã lưu giá 19.920đ cho ngày 2026-04-05."
}
```

### 4.3. `POST /api/petrolimex-sync/clear-cache`

Xoá cache scraper thủ công. Yêu cầu Bearer token.

### 4.4. `GET /api/cron/sync`

Endpoint cho external cron trigger. Yêu cầu header `Authorization: Bearer <CRON_SECRET>` (env `CRON_SECRET`, mặc định `logipro_cron_2026`).

---

## 5. Public API (không cần Auth)

Base path: `/api/public`

### 5.1. `GET /api/public/fuel-prices`

Lấy danh sách giá dầu (mặc định 30 ngày gần nhất).

| Param | Mô tả |
|-------|--------|
| `limit` | Số ngày (1–365, mặc định 30) |

**Response:**

```json
{
  "success": true,
  "count": 30,
  "data": [
    {
      "id": 42,
      "date": "2026-04-08",
      "effectiveAt": "2026-04-05T15:00:00+07:00",
      "fuelType": "Dầu DO 0,05S-II",
      "priceV1": 19920,
      "isPublished": true
    }
  ]
}
```

### 5.2. `GET /api/public/fuel-prices/latest`

Trả về **giá dầu mới nhất**. Ưu tiên giá đã ghim (`is_published = true`), nếu không có thì lấy giá mới nhất theo ngày.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 42,
    "date": "2026-04-08",
    "effectiveAt": "2026-04-05T15:00:00+07:00",
    "fuelType": "Dầu DO 0,05S-II",
    "priceV1": 19920,
    "isPublished": true
  }
}
```

### 5.3. `GET /api/public/surcharge-summary`

Tổng hợp: giá dầu hiện tại + bậc phụ thu container & hàng rời đang áp dụng.

**Response:**

```json
{
  "success": true,
  "data": {
    "currentFuelPrice": { "id": 42, "date": "2026-04-08", "priceV1": 19920, "..." : "..." },
    "activeContainerTier": { "minPrice": 19001, "maxPrice": 20000, "surcharge20F": 1300000, "..." : "..." },
    "activeBulkTier": { "minPrice": 19001, "maxPrice": 20000, "percentSurcharge": 8 },
    "containerTiers": [ "..." ],
    "bulkTiers": [ "..." ]
  }
}
```

---

## 6. Database schema

```sql
CREATE TABLE fuel_prices (
  id           SERIAL PRIMARY KEY,
  date         DATE         NOT NULL UNIQUE,
  fuel_type    VARCHAR(50)  NOT NULL DEFAULT 'Dầu DO 0,05S-II',
  price_v1     INTEGER      NOT NULL,         -- đơn vị: đồng/lít
  is_published BOOLEAN      NOT NULL DEFAULT FALSE,
  effective_at TEXT                            -- ISO datetime có timezone, ví dụ 2026-04-05T15:00:00+07:00
);
```

- `date`: ngày ghi nhận giá (UNIQUE, dùng cho UPSERT)
- `price_v1`: giá vùng 1 (đơn vị đồng)
- `is_published`: chỉ 1 ngày được ghim tại 1 thời điểm → hiển thị trên Trang Chủ
- `effective_at`: thời điểm ghi nhận giá — luôn là `${date}T06:00:00+07:00` (giờ cron chạy), **không dùng ngày hiệu lực từ Petrolimex**

---

## 7. Sơ đồ luồng

```
┌──────────────────────────────────────────────────────────┐
│  Cron 06:00 AM (VN)  hoặc  Admin bấm "Đồng bộ"        │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
     ┌───────────────────┐
     │  Cache còn hiệu   │──── Có ──▶ Trả cache
     │   lực? (6h TTL)   │
     └────────┬──────────┘
              │ Không / force
              ▼
     ┌───────────────────────────────────────┐
     │  Strategy 0: VIEApps CMS JSON API     │
     │  portals.petrolimex.com.vn/~apis/...  │
     └────────┬──────────────┬───────────────┘
              │ OK           │ Fail
              ▼              ▼
        Lấy giá Zone1  ┌─────────────────────────────┐
        + metadata      │  Fallback: Article Scraper  │
              │         │  petrolimex.com.vn          │
              │         └────────┬────────────────────┘
              │                  │
              │         Strategy 1: Table parse
              │         Strategy 2: Body text regex
              │         Strategy 3: Structured div
              │         Strategy 4: Broad number search
              │                  │
              │            OK?───┤──── Fail ──▶ Dùng fallbackConfig
              │                  │
              ▼                  ▼
     ┌──────────────────────────────────┐
     │   UPSERT vào fuel_prices        │
     │   (date = ngày hiện tại VN)     │
     │   effective_at = today 06:00 VN │
     │   Ghim is_published = true      │
     └──────────────────────────────────┘
               │
               ▼
     ┌──────────────────────────────────┐
     │  Public API phục vụ frontend    │
     │  /api/public/fuel-prices/latest │
     └──────────────────────────────────┘
```
