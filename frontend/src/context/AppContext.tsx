import React, { createContext, useContext, useState, useEffect } from 'react';
import { FuelPrice, Tier, BulkTier, Customer, Product, QuotationHistoryItem, ReconciliationLog } from '../types';
import { getSurchargeEffectiveAt, getVietnamTodayIsoDate, normalizeDateInput } from '../lib/fuelPrices';
import { logiStorage } from '../lib/storage';
import { API_BASE } from '../lib/apiBase';

interface AppContextType {
  isAdminMode: boolean;
  setIsAdminMode: (val: boolean) => void;
  
  userRole: string | null;
  setUserRole: (val: string | null) => void;

  userDisplayName: string;
  setUserDisplayName: (val: string) => void;

  loading: boolean;
  setLoading: (val: boolean) => void;
  
  error: string | null;
  setError: (val: string | null) => void;

  prices: FuelPrice[];
  setPrices: (val: FuelPrice[]) => void;
  
  tiers: Tier[];
  setTiers: (val: Tier[]) => void;
  
  bulkTiers: BulkTier[];
  setBulkTiers: (val: BulkTier[]) => void;
  
  customers: Customer[];
  setCustomers: (val: Customer[]) => void;
  
  services: Product[];
  setServices: (val: Product[]) => void;
  
  quotations: QuotationHistoryItem[];
  setQuotations: (val: QuotationHistoryItem[]) => void;

  reconLogs: ReconciliationLog[];
  setReconLogs: (val: ReconciliationLog[]) => void;

  // New Shared State for Quotation (A-3)
  pendingSurcharge: { amount: number; quantity: number; cargoType: string } | null;
  setPendingSurcharge: (val: { amount: number; quantity: number; cargoType: string } | null) => void;
  pendingCustomer: Customer | null;
  setPendingCustomer: (val: Customer | null) => void;

  fetchData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prices, setPrices] = useState<FuelPrice[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [bulkTiers, setBulkTiers] = useState<BulkTier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Product[]>([]);
  const [quotations, setQuotations] = useState<QuotationHistoryItem[]>([]);
  const [reconLogs, setReconLogs] = useState<ReconciliationLog[]>([]);
  const [pendingSurcharge, setPendingSurcharge] = useState<{ amount: number; quantity: number; cargoType: string } | null>(null);
  const [pendingCustomer, setPendingCustomer] = useState<Customer | null>(null);

  const upsertFuelPrice = (
    currentPrices: FuelPrice[],
    nextEntry: FuelPrice,
    scanDateToCleanup?: string
  ) => {
    const normalized = currentPrices.filter(price => !(
      scanDateToCleanup &&
      scanDateToCleanup !== nextEntry.date &&
      price.date === scanDateToCleanup &&
      price.fuelType === nextEntry.fuelType &&
      price.priceV1 === nextEntry.priceV1
    ));
    const existingIndex = normalized.findIndex(
      price => price.date === nextEntry.date && price.fuelType === nextEntry.fuelType
    );
    if (existingIndex >= 0) {
      const updated = [...normalized];
      updated[existingIndex] = { ...updated[existingIndex], ...nextEntry };
      return updated;
    }
    return [...normalized, nextEntry];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Tải dữ liệu công khai (không cần login)
      const [storedPrices, pTiers, pBulkTiers, pServices] = await Promise.all([
        logiStorage.getPrices(),
        logiStorage.getTiers(),
        logiStorage.getBulkTiers(),
        logiStorage.getServices()
      ]);

      setPrices(storedPrices);
      setTiers(pTiers);
      setBulkTiers(pBulkTiers);
      setServices(pServices);

      // 2. Kiểm tra Token & Tải dữ liệu nhạy cảm (nếu có)
      const sessionToken = sessionStorage.getItem("logipro_token");
      if (sessionToken) {
        try {
          const verifyRes = await fetch(`${API_BASE}/api/auth/verify`, {
            headers: { "Authorization": `Bearer ${sessionToken}` }
          });
          const verifyJson = await verifyRes.json();
          
          if (verifyJson.success) {
            setIsAdminMode(true);
            setUserRole(verifyJson.role || null);
            setUserDisplayName(verifyJson.displayName || verifyJson.username || '');
            // Fetch dữ liệu nhạy cảm song song khi đã login
            const [pCustomers, pQuotations, pReconLogs] = await Promise.all([
              logiStorage.getCustomers(),
              logiStorage.getQuotations(),
              logiStorage.getReconLogs()
            ]);
            setCustomers(pCustomers);
            setQuotations(pQuotations);
            setReconLogs(pReconLogs);
          } else {
            sessionStorage.removeItem("logipro_token");
            setIsAdminMode(false);
            setUserRole(null);
            setUserDisplayName('');
          }
        } catch {
          setIsAdminMode(false);
        }
      } else {
        setIsAdminMode(false);
        setUserRole(null);
        setUserDisplayName('');
      }

      // Auto-sync with offset 08:00 AM logic
      const todayStr = getVietnamTodayIsoDate();
      const hasTodayPrice = storedPrices.some(p => {
        if (p.fuelType !== "Dầu DO 0,05S-II") return false;
        const surchargeDate = normalizeDateInput(getSurchargeEffectiveAt(p) || p.date);
        return surchargeDate === todayStr;
      });

      if (!hasTodayPrice) {
        try {
          const res = await fetch(`${API_BASE}/api/petrolimex-sync`);
          const json = await res.json();
          if (json.success && json.data && json.data.parsedFromWeb) {
            const newPrice = Number(json.data.priceV1);
            const sourceDate = normalizeDateInput(json.data.effectiveDate) || todayStr;
            const surchargeDate = normalizeDateInput(
              getSurchargeEffectiveAt({
                id: 'auto-sync-preview',
                date: sourceDate,
                effectiveAt: json.data.effectiveAt,
                fuelType: "Dầu DO 0,05S-II",
                priceV1: newPrice
              }) || sourceDate
            ) || todayStr;
            const autoPrice: FuelPrice = {
              id: Date.now().toString(),
              date: surchargeDate,
              effectiveAt: json.data.effectiveAt || `${sourceDate}T00:00:00+07:00`,
              fuelType: "Dầu DO 0,05S-II",
              priceV1: newPrice
            };
            const updated = upsertFuelPrice(storedPrices, autoPrice, todayStr);
            const existing = storedPrices.find(price => price.date === surchargeDate && price.fuelType === autoPrice.fuelType);
            if (!existing || existing.priceV1 !== newPrice || updated.length !== storedPrices.length) {
              setPrices(updated);
              await logiStorage.setPrices(updated);
              console.log(`[Auto-Sync] ✅ Đã đồng bộ giá áp dụng ${surchargeDate}: ${newPrice.toLocaleString()} đ`);
            }
          } else if (json.success && json.data) {
            console.warn(`[Auto-Sync] ⚠️ Scraper trả về fallback (${json.data.priceV1.toLocaleString()} đ) — không tự thêm.`);
          }
        } catch (e) {
          console.error("Auto Sync Failed", e);
        }
      }

    } catch (err) {
      setError("Lỗi tải dữ liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh when switching between browser tabs
    const handleFocus = () => {
      fetchData();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <AppContext.Provider value={{
      isAdminMode, setIsAdminMode,
      userRole, setUserRole,
      userDisplayName, setUserDisplayName,
      loading, setLoading,
      error, setError,
      prices, setPrices,
      tiers, setTiers,
      bulkTiers, setBulkTiers,
      customers, setCustomers,
      services, setServices,
      quotations, setQuotations,
      reconLogs, setReconLogs,
      pendingSurcharge, setPendingSurcharge,
      pendingCustomer, setPendingCustomer,
      fetchData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
