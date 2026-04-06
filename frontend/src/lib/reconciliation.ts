import * as XLSX from 'xlsx';
import {
  formatIsoDateToVi,
  formatIsoDateTimeToVi,
  getLatestPriceByFuelTypeAt,
  getLatestPriceByFuelType,
  getLatestPriceByFuelTypeOnOrBeforeDate,
  normalizeDateTimeInput,
  normalizeDateInput
} from './fuelPrices';
import { FuelPrice, ReconciliationLog, Tier } from '../types';

export const DIESEL_FUEL_TYPE = 'Dầu DO 0,05S-II';
const REQUIRED_HEADERS = ['Số lệnh', 'Số PIN', 'Ngày lệnh', 'Số container', 'KC ISO', 'F/E', 'Ghi chú'];
const IMPORT_HISTORY_STORAGE_KEY = 'logipro_reconciliation_import_history';
const CURRENT_SESSION_STORAGE_KEY = 'logipro_reconciliation_current_session';
const ACTIVE_TAB_STORAGE_KEY = 'logipro_reconciliation_active_tab';

export type SupportedContainerType = '20F' | '40F' | '20E' | '40E';
export type ReconciliationStatus = 'increase' | 'decrease' | 'same' | 'missing';

export interface ImportedOrderRow {
  orderNo: string;
  pin: string;
  bookingDate: string;
  bookingDateDisplay: string;
  bookingDateTime: string;
  bookingDateTimeDisplay: string;
  containerNumber: string;
  isoCode: string;
  fullEmpty: string;
  note: string;
  containerType?: SupportedContainerType;
}

export interface ProcessedOrderRow extends ImportedOrderRow {
  executionDate: string;
  executionDateDisplay: string;
  fuelPriceAtBooking: number | null;
  fuelPriceAtExecution: number | null;
  surchargeAtBooking: number | null;
  surchargeAtExecution: number | null;
  delta: number | null;
  status: ReconciliationStatus;
  adjustmentLabel: string;
}

export interface ReconciliationImportHistoryItem {
  id: string;
  sourceFilename: string;
  executionDate: string;
  createdAt: string;
  totalRows: number;
  increaseCount: number;
  decreaseCount: number;
  sameCount: number;
  missingCount: number;
  rows: ProcessedOrderRow[];
}

export interface ReconciliationCurrentSession {
  sourceFilename: string;
  executionDate: string;
  rows: ProcessedOrderRow[];
}

export type ReconciliationValidationSeverity = 'error' | 'warning';

export interface ReconciliationValidationIssue {
  code:
    | 'missing_order_no'
    | 'missing_container_number'
    | 'missing_booking_date'
    | 'invalid_date_order'
    | 'unknown_container_type'
    | 'missing_booking_price'
    | 'missing_execution_price'
    | 'duplicate_order_container';
  severity: ReconciliationValidationSeverity;
  rowIndex: number;
  orderNo: string;
  containerNumber: string;
  message: string;
}

export interface ReconciliationValidationSummary {
  checkedAt: string;
  executionDate: string;
  totalRows: number;
  errorCount: number;
  warningCount: number;
  status: 'pass' | 'blocked';
  issues: ReconciliationValidationIssue[];
}

interface ManualReconciliationInput {
  bookingDate: string;
  containerId: string;
  containerType: '20F' | '40F' | '20E' | '40E' | 'bulk';
  executionDate: string;
  fuelPriceAtBooking?: number;
  prices: FuelPrice[];
  surchargeAtBooking: number;
  tiers: Tier[];
}

const normalizeHeader = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');

const toText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  return String(value).trim();
};

const isMeaningfulRow = (row: ImportedOrderRow) =>
  Boolean(row.orderNo || row.pin || row.bookingDate || row.containerNumber || row.isoCode || row.fullEmpty);

const buildExportFilename = (sourceFilename: string, executionDate: string) => {
  const sanitizedName = sourceFilename.replace(/\.(xlsx|xls)$/i, '').replace(/[^\w\-]+/g, '_');
  return `Doi_soat_phu_thu_${sanitizedName}_${executionDate}.xlsx`;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const getTierForPrice = (tiers: Tier[], price: number) =>
  tiers.find(tier => price >= tier.minPrice && price <= tier.maxPrice);

export const getContainerSurchargeFromPrice = (
  tiers: Tier[],
  price: number,
  type: SupportedContainerType
) => {
  const activeTier = getTierForPrice(tiers, price);
  if (!activeTier) return 0;

  if (type === '20F') return activeTier.surcharge20F;
  if (type === '40F') return activeTier.surcharge40F;
  if (type === '20E') return activeTier.surcharge20E;
  return activeTier.surcharge40E;
};

export const inferContainerType = (
  isoCode: unknown,
  fullEmptyValue: unknown
): SupportedContainerType | undefined => {
  const isoText = String(isoCode ?? '').trim().toUpperCase();
  const fullEmpty = String(fullEmptyValue ?? '').trim().toUpperCase();

  // L5 size types (e.g. L5G1) are treated as 40' containers
  const size = isoText.startsWith('2') ? '20'
    : isoText.startsWith('4') ? '40'
    : isoText.startsWith('L5') ? '40'
    : undefined;
  const mode = fullEmpty.startsWith('F') ? 'F' : fullEmpty.startsWith('E') ? 'E' : undefined;

  if (!size || !mode) return undefined;
  return `${size}${mode}` as SupportedContainerType;
};

export const getReconciliationStatus = (delta: number): Exclude<ReconciliationStatus, 'missing'> => {
  if (delta > 0) return 'increase';
  if (delta < 0) return 'decrease';
  return 'same';
};

export const getAdjustmentLabel = (status: ReconciliationStatus) => {
  if (status === 'increase') return 'Tăng';
  if (status === 'decrease') return 'Giảm';
  if (status === 'same') return 'Giữ nguyên';
  return 'Thiếu dữ liệu';
};

export const getFuelPriceForDate = (prices: FuelPrice[], date: string) =>
  getLatestPriceByFuelTypeOnOrBeforeDate(prices, DIESEL_FUEL_TYPE, date)?.priceV1 ?? 0;

export const getLatestDieselPrice = (prices: FuelPrice[]) =>
  getLatestPriceByFuelType(prices, DIESEL_FUEL_TYPE)?.priceV1 ?? 0;

export const parseImportedOrders = (buffer: ArrayBuffer): ImportedOrderRow[] => {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
    header: 1,
    defval: '',
    raw: false
  });

  const headerRowIndex = rows.findIndex(row => {
    const normalizedRow = row.map(normalizeHeader);
    return REQUIRED_HEADERS.every(header => normalizedRow.includes(header));
  });

  if (headerRowIndex === -1) {
    throw new Error('Không tìm thấy dòng tiêu đề chuẩn trong file Excel.');
  }

  const headerRow = rows[headerRowIndex].map(normalizeHeader);
  const headerIndexes = Object.fromEntries(headerRow.map((header, index) => [header, index]));

  return rows
    .slice(headerRowIndex + 1)
    .filter(row => row.some(cell => normalizeHeader(cell) !== ''))
    .map(row => {
      const bookingDate = normalizeDateInput(row[headerIndexes['Ngày lệnh']]);
      const bookingDateTime = normalizeDateTimeInput(row[headerIndexes['Ngày lệnh']]);
      const isoCode = toText(row[headerIndexes['KC ISO']]).toUpperCase();
      const fullEmpty = toText(row[headerIndexes['F/E']]).toUpperCase();

      return {
        orderNo: toText(row[headerIndexes['Số lệnh']]),
        pin: toText(row[headerIndexes['Số PIN']]),
        bookingDate: bookingDate ?? '',
        bookingDateDisplay: bookingDate ? formatIsoDateToVi(bookingDate) : toText(row[headerIndexes['Ngày lệnh']]),
        bookingDateTime: bookingDateTime ?? '',
        bookingDateTimeDisplay: bookingDateTime ? formatIsoDateTimeToVi(bookingDateTime) : toText(row[headerIndexes['Ngày lệnh']]),
        containerNumber: toText(row[headerIndexes['Số container']]).toUpperCase(),
        isoCode,
        fullEmpty,
        note: toText(row[headerIndexes['Ghi chú']]),
        containerType: inferContainerType(isoCode, fullEmpty)
      };
    })
    .filter(isMeaningfulRow);
};

export const validateImportedOrders = (
  rows: ImportedOrderRow[],
  prices: FuelPrice[],
  tiers: Tier[],
  executionDate: string
): ReconciliationValidationSummary => {
  const issues: ReconciliationValidationIssue[] = [];
  const normalizedExecutionDate = normalizeDateInput(executionDate);
  const executionPrice = normalizedExecutionDate
    ? getLatestPriceByFuelTypeOnOrBeforeDate(prices, DIESEL_FUEL_TYPE, normalizedExecutionDate)
    : undefined;
  const rowKeys = new Map<string, number[]>();

  rows.forEach((row, index) => {
    const rowIndex = index + 1;
    const normalizedBookingDate = normalizeDateInput(row.bookingDate);
    const normalizedBookingDateTime = normalizeDateTimeInput(row.bookingDateTime || row.bookingDate);
    const key = [row.orderNo, row.containerNumber, row.pin, normalizedBookingDateTime ?? normalizedBookingDate ?? row.bookingDate].join('|');
    const existingIndexes = rowKeys.get(key) ?? [];
    existingIndexes.push(rowIndex);
    rowKeys.set(key, existingIndexes);

    if (!row.orderNo) {
      issues.push({
        code: 'missing_order_no',
        severity: 'error',
        rowIndex,
        orderNo: row.orderNo,
        containerNumber: row.containerNumber,
        message: 'Thiếu Số lệnh.'
      });
    }

    if (!row.containerNumber) {
      issues.push({
        code: 'missing_container_number',
        severity: 'error',
        rowIndex,
        orderNo: row.orderNo,
        containerNumber: row.containerNumber,
        message: 'Thiếu Số container.'
      });
    }

    if (!normalizedBookingDate) {
      issues.push({
        code: 'missing_booking_date',
        severity: 'error',
        rowIndex,
        orderNo: row.orderNo,
        containerNumber: row.containerNumber,
        message: 'Không đọc được Ngày lệnh.'
      });
    }

    if (normalizedBookingDate && normalizedExecutionDate && normalizedBookingDate > normalizedExecutionDate) {
      issues.push({
        code: 'invalid_date_order',
        severity: 'error',
        rowIndex,
        orderNo: row.orderNo,
        containerNumber: row.containerNumber,
        message: `Ngày lệnh ${formatIsoDateToVi(normalizedBookingDate)} sau Ngày thực hiện ${formatIsoDateToVi(normalizedExecutionDate)}.`
      });
    }

    if (!row.containerType) {
      issues.push({
        code: 'unknown_container_type',
        severity: 'warning',
        rowIndex,
        orderNo: row.orderNo,
        containerNumber: row.containerNumber,
        message: `Không suy ra được loại cont từ KC ISO "${row.isoCode}" và F/E "${row.fullEmpty}". Cần kiểm tra thủ công.`
      });
    }

    if (normalizedBookingDate) {
      const bookingPrice = normalizedBookingDateTime
        ? getLatestPriceByFuelTypeAt(prices, DIESEL_FUEL_TYPE, normalizedBookingDateTime)
        : getLatestPriceByFuelTypeOnOrBeforeDate(prices, DIESEL_FUEL_TYPE, normalizedBookingDate);
      if (!bookingPrice) {
        issues.push({
          code: 'missing_booking_price',
          severity: 'error',
          rowIndex,
          orderNo: row.orderNo,
          containerNumber: row.containerNumber,
          message: `Không có lịch sử giá dầu cho Ngày lệnh ${formatIsoDateToVi(normalizedBookingDate)}.`
        });
      } else if (!getTierForPrice(tiers, bookingPrice.priceV1)) {
        issues.push({
          code: 'missing_booking_price',
          severity: 'error',
          rowIndex,
          orderNo: row.orderNo,
          containerNumber: row.containerNumber,
          message: `Giá dầu ngày lệnh ${bookingPrice.priceV1.toLocaleString('vi-VN')} không khớp bậc phụ thu nào.`
        });
      }
    }

    if (!executionPrice) {
      issues.push({
        code: 'missing_execution_price',
        severity: 'error',
        rowIndex,
        orderNo: row.orderNo,
        containerNumber: row.containerNumber,
        message: `Không có lịch sử giá dầu cho Ngày thực hiện ${executionDate}.`
      });
    } else if (!getTierForPrice(tiers, executionPrice.priceV1)) {
      issues.push({
        code: 'missing_execution_price',
        severity: 'error',
        rowIndex,
        orderNo: row.orderNo,
        containerNumber: row.containerNumber,
        message: `Giá dầu ngày thực hiện ${executionPrice.priceV1.toLocaleString('vi-VN')} không khớp bậc phụ thu nào.`
      });
    }
  });

  rowKeys.forEach((indexes, key) => {
    if (indexes.length <= 1) return;
    const [orderNo, containerNumber] = key.split('|');
    indexes.forEach(rowIndex => {
      issues.push({
        code: 'duplicate_order_container',
        severity: 'error',
        rowIndex,
        orderNo,
        containerNumber,
        message: `Dòng bị trùng khóa Số lệnh + Container + PIN + Ngày lệnh với ${indexes.length} bản ghi.`
      });
    });
  });

  const errorCount = issues.filter(issue => issue.severity === 'error').length;
  const warningCount = issues.filter(issue => issue.severity === 'warning').length;

  return {
    checkedAt: new Date().toISOString(),
    executionDate,
    totalRows: rows.length,
    errorCount,
    warningCount,
    status: errorCount > 0 ? 'blocked' : 'pass',
    issues
  };
};

export const buildProcessedRows = (
  rows: ImportedOrderRow[],
  prices: FuelPrice[],
  tiers: Tier[],
  executionDate: string
): ProcessedOrderRow[] => rows.map(row => {
  const normalizedBookingDate = normalizeDateInput(row.bookingDate);
  const normalizedBookingDateTime = normalizeDateTimeInput(row.bookingDateTime || row.bookingDate);
  const normalizedExecutionDate = normalizeDateInput(executionDate);
  const bookingPrice = normalizedBookingDateTime
    ? getLatestPriceByFuelTypeAt(prices, DIESEL_FUEL_TYPE, normalizedBookingDateTime)
    : row.bookingDate
      ? getLatestPriceByFuelTypeOnOrBeforeDate(prices, DIESEL_FUEL_TYPE, row.bookingDate)
    : undefined;
  const executionPrice = getLatestPriceByFuelTypeOnOrBeforeDate(prices, DIESEL_FUEL_TYPE, executionDate);
  const hasInvalidDateOrder = Boolean(
    normalizedBookingDate &&
    normalizedExecutionDate &&
    normalizedBookingDate > normalizedExecutionDate
  );

  const surchargeAtOrder =
    bookingPrice && row.containerType
      ? getContainerSurchargeFromPrice(tiers, bookingPrice.priceV1, row.containerType)
      : null;

  const surchargeAtExecution =
    executionPrice && row.containerType
      ? getContainerSurchargeFromPrice(tiers, executionPrice.priceV1, row.containerType)
      : null;

  const hasEnoughData = surchargeAtOrder !== null && surchargeAtExecution !== null;
  const delta = hasEnoughData ? surchargeAtExecution - surchargeAtOrder : null;
  const status: ReconciliationStatus = hasInvalidDateOrder
    ? 'missing'
    : delta === null
      ? 'missing'
      : getReconciliationStatus(delta);

  return {
    ...row,
    executionDate,
    executionDateDisplay: formatIsoDateToVi(executionDate),
    fuelPriceAtBooking: bookingPrice?.priceV1 ?? null,
    fuelPriceAtExecution: executionPrice?.priceV1 ?? null,
    surchargeAtBooking: hasInvalidDateOrder ? null : surchargeAtOrder,
    surchargeAtExecution: hasInvalidDateOrder ? null : surchargeAtExecution,
    delta: hasInvalidDateOrder ? null : delta,
    status,
    adjustmentLabel: hasInvalidDateOrder ? 'Sai mốc ngày' : getAdjustmentLabel(status)
  };
});

export const summarizeProcessedRows = (rows: ProcessedOrderRow[]) => ({
  total: rows.length,
  increase: rows.filter(row => row.status === 'increase').length,
  decrease: rows.filter(row => row.status === 'decrease').length,
  same: rows.filter(row => row.status === 'same').length,
  missing: rows.filter(row => row.status === 'missing').length
});

export const loadReconciliationImportHistory = (): ReconciliationImportHistoryItem[] => {
  if (typeof window === 'undefined') return [];

  try {
    const saved = window.localStorage.getItem(IMPORT_HISTORY_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveReconciliationImportHistory = (
  session: Omit<ReconciliationImportHistoryItem, 'id' | 'createdAt' | 'totalRows' | 'increaseCount' | 'decreaseCount' | 'sameCount' | 'missingCount'>
): ReconciliationImportHistoryItem[] => {
  const summary = summarizeProcessedRows(session.rows);
  const nextItem: ReconciliationImportHistoryItem = {
    id: `recon_import_${Date.now()}`,
    createdAt: new Date().toISOString(),
    totalRows: summary.total,
    increaseCount: summary.increase,
    decreaseCount: summary.decrease,
    sameCount: summary.same,
    missingCount: summary.missing,
    ...session,
  };

  const existing = loadReconciliationImportHistory();
  const nextList = [nextItem, ...existing].slice(0, 30);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(IMPORT_HISTORY_STORAGE_KEY, JSON.stringify(nextList));
  }

  return nextList;
};

export const deleteReconciliationImportHistory = (id: string): ReconciliationImportHistoryItem[] => {
  const nextList = loadReconciliationImportHistory().filter(item => item.id !== id);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(IMPORT_HISTORY_STORAGE_KEY, JSON.stringify(nextList));
  }

  return nextList;
};

export const loadReconciliationCurrentSession = (): ReconciliationCurrentSession | null => {
  if (typeof window === 'undefined') return null;

  try {
    const saved = window.localStorage.getItem(CURRENT_SESSION_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as ReconciliationCurrentSession;
    if (!parsed || !Array.isArray(parsed.rows) || typeof parsed.executionDate !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveReconciliationCurrentSession = (session: ReconciliationCurrentSession): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CURRENT_SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearReconciliationCurrentSession = (): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CURRENT_SESSION_STORAGE_KEY);
};

export const loadReconciliationActiveTab = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
};

export const saveReconciliationActiveTab = (tab: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
};

export const buildManualReconciliationResult = ({
  bookingDate,
  containerId,
  containerType,
  executionDate,
  fuelPriceAtBooking,
  prices,
  surchargeAtBooking,
  tiers
}: ManualReconciliationInput): Partial<ReconciliationLog> => {
  const bookingFuelPrice =
    fuelPriceAtBooking ||
    getLatestPriceByFuelTypeOnOrBeforeDate(prices, DIESEL_FUEL_TYPE, bookingDate)?.priceV1 ||
    0;

  const currentFuelPrice = getFuelPriceForDate(prices, executionDate) || getLatestDieselPrice(prices);
  const surchargeNow =
    containerType === 'bulk'
      ? 0
      : getContainerSurchargeFromPrice(tiers, currentFuelPrice, containerType);
  const delta = surchargeNow - surchargeAtBooking;

  return {
    id: `RECON_${Date.now()}`,
    containerId,
    containerType,
    bookingDate,
    checkDate: executionDate,
    fuelPriceAtBooking: bookingFuelPrice,
    fuelPriceNow: currentFuelPrice,
    surchargeAtBooking,
    surchargeNow,
    delta,
    status: getReconciliationStatus(delta),
    createdAt: new Date().toISOString(),
  };
};

export const exportProcessedRowsToExcel = async (
  rows: ProcessedOrderRow[],
  sourceFilename: string,
  executionDate: string,
  validationSummary?: ReconciliationValidationSummary
) => {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Doi soat phu thu');

  worksheet.columns = [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Số lệnh', key: 'orderNo', width: 16 },
    { header: 'Số PIN', key: 'pin', width: 22 },
    { header: 'Ngày lệnh', key: 'bookingDateTimeDisplay', width: 22 },
    { header: 'Ngày thực hiện', key: 'executionDateDisplay', width: 16 },
    { header: 'Số container', key: 'containerNumber', width: 18 },
    { header: 'KC ISO', key: 'isoCode', width: 10 },
    { header: 'F/E', key: 'fullEmpty', width: 8 },
    { header: 'Loại cont', key: 'containerType', width: 12 },
    { header: 'Ghi chú', key: 'note', width: 24 },
    { header: 'Giá dầu ngày lệnh', key: 'fuelPriceAtBooking', width: 18 },
    { header: 'Giá dầu ngày thực hiện', key: 'fuelPriceAtExecution', width: 20 },
    { header: 'Phụ thu ngày lệnh', key: 'surchargeAtBooking', width: 18 },
    { header: 'Phụ thu ngày thực hiện', key: 'surchargeAtExecution', width: 20 },
    { header: 'Chênh lệch phụ thu', key: 'delta', width: 18 },
    { header: 'Phụ thu có VAT', key: 'deltaVat', width: 18 },
    { header: 'Điều chỉnh', key: 'adjustmentLabel', width: 16 }
  ];

  const deltaColIndex = worksheet.columns.findIndex(c => c.key === 'delta') + 1;
  const vatColIndex = worksheet.columns.findIndex(c => c.key === 'deltaVat') + 1;

  rows.forEach((row, index) => {
    const excelRow = worksheet.addRow({
      stt: index + 1,
      ...row,
      containerType: row.containerType ?? 'Không rõ',
      deltaVat: null
    });
    // Set VAT formula: =<delta_cell>*1.08
    const deltaCol = String.fromCharCode(64 + deltaColIndex);
    const rowNum = excelRow.number;
    excelRow.getCell('deltaVat').value = { formula: `${deltaCol}${rowNum}*1.08` } as any;
  });

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount }
  };

  const headerFill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: '4F46E5' }
  };

  worksheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'C7D2FE' } },
      left: { style: 'thin', color: { argb: 'C7D2FE' } },
      bottom: { style: 'thin', color: { argb: 'C7D2FE' } },
      right: { style: 'thin', color: { argb: 'C7D2FE' } }
    };
  });

  const currencyColumns = ['fuelPriceAtBooking', 'fuelPriceAtExecution', 'surchargeAtBooking', 'surchargeAtExecution', 'delta', 'deltaVat'] as const;
  const statusColors: Record<ReconciliationStatus, { fill: string; font: string }> = {
    increase: { fill: 'FEE2E2', font: 'BE123C' },
    decrease: { fill: 'DCFCE7', font: '15803D' },
    same: { fill: 'E2E8F0', font: '475569' },
    missing: { fill: 'FEF3C7', font: 'B45309' }
  };

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    row.eachCell(cell => {
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'E2E8F0' } },
        left: { style: 'thin', color: { argb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } }
      };
    });

    currencyColumns.forEach(columnKey => {
      const cell = row.getCell(columnKey);
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const statusValue = row.getCell('adjustmentLabel').value;
    const matchedStatus =
      statusValue === 'Tăng' ? 'increase' :
      statusValue === 'Giảm' ? 'decrease' :
      statusValue === 'Giữ nguyên' ? 'same' :
      'missing';

    const style = statusColors[matchedStatus];
    row.getCell('adjustmentLabel').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: style.fill }
    };
    row.getCell('adjustmentLabel').font = { bold: true, color: { argb: style.font } };
    row.getCell('adjustmentLabel').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('delta').font = { bold: true, color: { argb: style.font } };
  });

  const auditSheet = workbook.addWorksheet('Kiem tra du lieu');
  auditSheet.columns = [
    { header: 'Muc', key: 'label', width: 34 },
    { header: 'Gia tri', key: 'value', width: 60 }
  ];
  auditSheet.addRows([
    { label: 'Nguon file', value: sourceFilename },
    { label: 'Ngay thuc hien', value: formatIsoDateToVi(executionDate) },
    { label: 'So dong du lieu', value: rows.length },
    { label: 'Thoi gian kiem tra', value: validationSummary ? validationSummary.checkedAt : new Date().toISOString() },
    { label: 'Trang thai kiem tra', value: validationSummary?.status === 'blocked' ? 'BLOCKED' : 'PASS' },
    { label: 'So loi', value: validationSummary?.errorCount ?? 0 },
    { label: 'So canh bao', value: validationSummary?.warningCount ?? 0 }
  ]);

  auditSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  auditSheet.getRow(1).fill = headerFill;
  auditSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

  if (validationSummary && validationSummary.issues.length > 0) {
    auditSheet.addRow({ label: '', value: '' });
    auditSheet.addRow({ label: 'Danh sach loi/canh bao', value: '' });
    auditSheet.getRow(auditSheet.rowCount).font = { bold: true };
    validationSummary.issues.forEach(issue => {
      auditSheet.addRow({
        label: `Dong ${issue.rowIndex} | ${issue.code}`,
        value: issue.message
      });
    });
  }

  // === Sheet for unknown container type rows ===
  const unknownTypeRows = rows.filter(r => !r.containerType);
  if (unknownTypeRows.length > 0) {
    const unknownSheet = workbook.addWorksheet('Kiem tra loai cont');
    unknownSheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Số lệnh', key: 'orderNo', width: 16 },
      { header: 'Số PIN', key: 'pin', width: 22 },
      { header: 'Ngày lệnh', key: 'bookingDateTimeDisplay', width: 22 },
      { header: 'Số container', key: 'containerNumber', width: 18 },
      { header: 'KC ISO', key: 'isoCode', width: 10 },
      { header: 'F/E', key: 'fullEmpty', width: 8 },
      { header: 'Ghi chú', key: 'note', width: 24 },
      { header: 'Lý do', key: 'reason', width: 40 }
    ];
    unknownTypeRows.forEach((row, idx) => {
      unknownSheet.addRow({
        stt: idx + 1,
        orderNo: row.orderNo,
        pin: row.pin,
        bookingDateTimeDisplay: row.bookingDateTimeDisplay,
        containerNumber: row.containerNumber,
        isoCode: row.isoCode,
        fullEmpty: row.fullEmpty,
        note: row.note,
        reason: `Không suy ra được loại cont từ KC ISO "${row.isoCode}" và F/E "${row.fullEmpty}"`
      });
    });
    unknownSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    unknownSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'B45309' } };
    unknownSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
  }

  const filename = buildExportFilename(sourceFilename, executionDate);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const picker = (window as Window & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }) => Promise<{
      createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
  }).showSaveFilePicker;

  if (picker) {
    const handle = await picker({
      suggestedName: filename,
      types: [
        {
          description: 'Excel Workbook',
          accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
          }
        }
      ]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return filename;
  }

  downloadBlob(blob, filename);
  return filename;
};
