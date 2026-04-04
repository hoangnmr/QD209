# Roadmap Tích hợp Tính năng Đối soát Nâng cao & Scraper (v2 — Post-Review)

**Tài liệu dành cho:** Enterprise Architect (EA) / Agent Reviewer
**Mục tiêu:** Hợp nhất module Đối Soát (Reconciliation) và Cào Dữ liệu (Scraper) từ `Bao_gia_phu_thu_Dau DO` vào `QD209`.
**Phiên bản:** v2 — Đã bổ sung sau đánh giá độc lập ngày 04/04/2026.

---

## 1. Ngữ cảnh (Context)
Dự án `QD209` (bản gốc) sở hữu kiến trúc tốt với Database PostgreSQL và phân chia Backend/Frontend rõ rệt. Tuy nhiên tồn tại nhược điểm nghiệp vụ: hệ thống cào dữ liệu mỏng manh (1 strategy duy nhất) và đối soát chỉ dừng ở mức thủ công đơn chiếc.

Phiên bản `Bao_gia_phu_thu_Dau DO` (bản local) sở hữu: (1) Scraper 5 lớp dự phòng, (2) Logic offset 08:00 AM khớp quy trình cảng, (3) Đối soát hàng loạt bằng Excel.

**Quyết định:** Hợp nhất 100% thuật toán ưu việt. Ghi đè UI cũ.

---

## 2. Phân tích Điểm Mạnh / Điểm Yếu

### 2.1. Scraper Petrolimex
| | QD209 (Cũ) | Bao_gia (Mới) |
|---|---|---|
| Strategy | 1 (VIEApps API) | 5 (API → Table → Body → Div → Broad) |
| Fallback khi API chết | Dùng giá cứng | Parse HTML article tự động |
| Bóc tách thời gian hiệu lực | Không | Regex giờ/phút/giây từ thông cáo |
| **Nguyên nhân cập nhật** | **High Availability — giảm sự cố lệch giá** ||

### 2.2. Logic Khung Thời Gian
| | QD209 (Cũ) | Bao_gia (Mới) |
|---|---|---|
| Mốc áp giá | 00:00 (theo ngày) | 08:00 AM (theo ca cảng) |
| Trường dữ liệu | `date` (YYYY-MM-DD) | `date` + `effectiveAt` (ISO DateTime) |
| **Nguyên nhân cập nhật** | **Khớp 100% quy trình kế toán/thương vụ cảng biển** ||

### 2.3. Module Đối Soát
| | QD209 (Cũ) | Bao_gia (Mới) |
|---|---|---|
| Phương thức | QR/OCR đơn chiếc (358 dòng) | Excel hàng loạt + QR (1015 dòng) |
| Validate | Không | 8 loại lỗi nghiệp vụ |
| Xuất báo cáo | Không | Excel tô màu bằng exceljs |
| **Nguyên nhân cập nhật** | **Chuyển Manual → Batch Automation** ||

---

## 3. Rủi ro đã phát hiện (Post-Review)

| # | Rủi ro | Mức độ | Biện pháp |
|---|---|---|---|
| R1 | `FuelPrice` thiếu trường `effectiveAt` | 🔴 Nghiêm trọng | Cập nhật `types/index.ts` |
| R2 | Database thiếu cột `effective_at` | 🔴 Nghiêm trọng | Sửa `schema.sql` + `db.ts` |
| R3 | AppContext thiếu auto-sync offset 08:00 | 🟡 Trung bình | Copy logic từ bản DO |
| R4 | Mất guard quyền Admin trên Reconciliation | 🟡 Trung bình | Thêm lại `canEdit` |
| R5 | Thiếu dependency `cheerio` | 🟡 Trung bình | Cài thêm khi cài `exceljs` |

---

## 4. Lộ Trình Thực Thi (6 Giai đoạn)

### Giai đoạn 0: Cập nhật Type + Schema ← MỚI
- Thêm `effectiveAt?: string` vào `FuelPrice` trong `types/index.ts`
- Cập nhật `schema.sql` thêm cột `effective_at`
- Cập nhật `db.ts` để đọc/ghi trường mới

### Giai đoạn 1: Dependencies
- `npm install exceljs cheerio`

### Giai đoạn 2: Backend Scraper
- Copy `vietnamTime.ts` vào `backend/utils/`
- Thay `internalSyncLogic()` bằng bản 5-strategy từ DO
- GIỮ NGUYÊN `syncAndSave()` + `cronSync()` (PostgreSQL)
- Adapter: lưu `effectiveAt` vào DB khi UPSERT

### Giai đoạn 3: Frontend Core Libraries
- Copy `fuelPrices.ts` vào `frontend/src/lib/`
- Copy `reconciliation.ts` vào `frontend/src/lib/`

### Giai đoạn 4: AppContext Sync ← MỚI
- Thêm `upsertFuelPrice()` vào `AppContext.tsx`
- Thêm auto-sync với offset 08:00
- Import `getSurchargeEffectiveAt` từ `fuelPrices.ts`

### Giai đoạn 5: UI Replacement
- XÓA `ReconciliationModule.styles.ts` (chỉ file này)
- Ghi đè `ReconciliationModule.tsx` từ bản DO
- Thêm lại guard `canEdit` cho admin-only actions
