export interface FuelPrice {
  id: string;
  date: string;
  effectiveAt?: string;
  fuelType: string;
  priceV1: number;
  isPublished?: boolean;
}

export interface Tier {
  id: string;
  minPrice: number;
  maxPrice: number;
  surcharge20F: number;
  surcharge40F: number;
  surcharge20E: number;
  surcharge40E: number;
}

export interface BulkTier {
  id: string;
  minPrice: number;
  maxPrice: number;
  percentSurcharge: number;
}

export interface QuotationItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  total: number;
  note?: string;
}

export interface RowItem {
  id: string;
  name: string;
  unit: string;
  price: number;
  quantity: number;
  containerQty: number;
  startDate: string;
  endDate: string;
}

export interface Product {
  id?: string;
  name: string;
  unit: string;
  price: number;
  category?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  taxCode: string;
  status: 'active' | 'inactive';
}

export interface QuotationHistoryItem {
  id: string;
  quotationNo: string;
  customerName: string;
  date: string;
  total: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdBy: string;
  items?: QuotationItem[];
}

export interface ReconciliationLog {
  id: string;
  containerId: string;
  containerType: '20F' | '40F' | '20E' | '40E' | 'bulk';
  bookingDate: string;        // ngày làm lệnh
  checkDate: string;          // ngày đối soát (hôm nay)
  fuelPriceAtBooking: number; // giá dầu lúc làm lệnh
  fuelPriceNow: number;       // giá dầu hiện tại
  surchargeAtBooking: number; // phụ thu lúc làm lệnh
  surchargeNow: number;       // phụ thu hiện tại
  delta: number;              // chênh lệch
  status: 'increase' | 'decrease' | 'same';
  note?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION MODULE TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface RegistrationServiceItem {
  id: string;
  name: string;
  unit: string;
}

export interface RegistrationLineItem {
  id: string;
  serviceName: string; // Tên phương án
  size: string;        // 20', 40', 45'
  quantity: number;
}

export interface RegistrationHistoryItem {
  id: string;
  registrationNumber: string;
  registrationDate: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  workingDate: string;
  cargoType: string;
  containerType: string;
  customerNotes: string;
  items: RegistrationLineItem[];
  createdAt: string;
}
