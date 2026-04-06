import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings, 
  Plus, 
  AlertCircle,
  DownloadCloud,
  Database,
  UploadCloud,
  Save,
  ShieldAlert,
  History,
  Trash2,
  FileSpreadsheet,
  Users,
  Pencil,
  UserPlus,
  Pin,
  PinOff,
  Check,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

import * as XLSX from 'xlsx';

import { FuelPrice, Tier, BulkTier } from '../types';
import { useAppContext } from '../context/AppContext';
import { logiStorage } from '../lib/storage';
import { API_BASE } from '../lib/apiBase';
import * as S from '../styles/AdminPanel.styles';

const AdminPanel: React.FC = () => {
  const { prices, setPrices, tiers, setTiers, bulkTiers, setBulkTiers, error, setError, fetchData } = useAppContext();
  
  const [adminTab, setAdminTab] = useState<"prices" | "tiers" | "bulkTiers" | "backup" | "fallback" | "audit" | "users">("prices");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Price Form
  const localDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const [newDate, setNewDate] = useState(localDateStr());
  const [newFuelType, setNewFuelType] = useState("Dầu DO 0,05S-II");
  const [newPriceV1, setNewPriceV1] = useState("");
  
  // Tier Form
  const [newMinPrice, setNewMinPrice] = useState("");
  const [newMaxPrice, setNewMaxPrice] = useState("");
  const [newSurcharge20F, setNewSurcharge20F] = useState("");
  const [newSurcharge40F, setNewSurcharge40F] = useState("");
  const [newSurcharge20E, setNewSurcharge20E] = useState("");
  const [newSurcharge40E, setNewSurcharge40E] = useState("");
  
  // Bulk Tier Form
  const [newBulkMinPrice, setNewBulkMinPrice] = useState("");
  const [newBulkMaxPrice, setNewBulkMaxPrice] = useState("");
  const [newPercentSurcharge, setNewPercentSurcharge] = useState("");

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<React.ReactNode>("");

  // Inline edit state for fuel price rows
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");
  
  const [expandedPriceId, setExpandedPriceId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [fallbackPrice, setFallbackPrice] = useState("");
  const [fallbackDate, setFallbackDate] = useState("");
  const [fallbackMsg, setFallbackMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // User management state
  interface UserRow { id: number; username: string; displayName: string; role: string; createdAt: string; }
  const [userList, setUserList] = useState<UserRow[]>([]);
  const [userFormMode, setUserFormMode] = useState<'add' | 'edit'>('add');
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [ufUsername, setUfUsername] = useState('');
  const [ufDisplayName, setUfDisplayName] = useState('');
  const [ufPassword, setUfPassword] = useState('');
  const [ufRole, setUfRole] = useState('guest');
  const [userMsg, setUserMsg] = useState('');

  const authHeader = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionStorage.getItem('logipro_token')}` });

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, { headers: authHeader() });
      const json = await res.json();
      if (json.success) setUserList(json.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { if (adminTab === 'users') fetchUsers(); }, [adminTab]);

  const resetUserForm = () => { setUserFormMode('add'); setEditUserId(null); setUfUsername(''); setUfDisplayName(''); setUfPassword(''); setUfRole('guest'); };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg('');
    try {
      if (userFormMode === 'add') {
        const res = await fetch(`${API_BASE}/api/auth/users`, { method: 'POST', headers: authHeader(), body: JSON.stringify({ username: ufUsername, password: ufPassword, displayName: ufDisplayName, role: ufRole }) });
        const json = await res.json();
        if (json.success) { setUserMsg('✅ Đã tạo user thành công'); resetUserForm(); fetchUsers(); }
        else setUserMsg('❌ ' + json.message);
      } else {
        const body: any = { displayName: ufDisplayName, role: ufRole };
        if (ufPassword) body.password = ufPassword;
        const res = await fetch(`${API_BASE}/api/auth/users/${editUserId}`, { method: 'PUT', headers: authHeader(), body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) { setUserMsg('✅ Đã cập nhật user'); resetUserForm(); fetchUsers(); }
        else setUserMsg('❌ ' + json.message);
      }
    } catch { setUserMsg('❌ Lỗi kết nối API'); }
    setTimeout(() => setUserMsg(''), 4000);
  };

  const handleEditUser = (u: UserRow) => {
    setUserFormMode('edit'); setEditUserId(u.id); setUfUsername(u.username); setUfDisplayName(u.displayName); setUfPassword(''); setUfRole(u.role);
  };

  const handleDeleteUser = async (u: UserRow) => {
    if (!window.confirm(`Xóa user "${u.username}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/users/${u.id}`, { method: 'DELETE', headers: authHeader() });
      const json = await res.json();
      if (json.success) fetchUsers();
      else alert('❌ ' + json.message);
    } catch { alert('❌ Lỗi kết nối'); }
  };

  React.useEffect(() => {
    if (adminTab === "fallback") {
      fetch(`${API_BASE}/api/fallback`).then(r => r.json()).then(res => {
        if (res.success && res.data) {
          setFallbackPrice(res.data.price.toString());
          setFallbackDate(res.data.date);
        }
      });
    }
    if (adminTab === "audit") {
      logiStorage.getAuditLogs().then(setAuditLogs);
    }
  }, [adminTab]);

  const handleSaveFallback = async (e: React.FormEvent) => {
    e.preventDefault();
    setFallbackMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/fallback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("logipro_token")}`
        },
        body: JSON.stringify({ price: Number(fallbackPrice), date: fallbackDate })
      });
      const data = await res.json();
      if (data.success) {
        setFallbackMsg("✅ Đã lưu cấu hình Fallback");
      }
      else setFallbackMsg("❌ Lỗi: " + data.message);
    } catch {
      setFallbackMsg("❌ Lỗi kết nối API");
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMsg("");
    try {
      // GET only → fetch price from web, populate form, do NOT auto-save
      const res = await fetch(`${API_BASE}/api/petrolimex-sync?force=true`);
      const json = await res.json();
      if (json.success && json.data) {
        setNewPriceV1(json.data.priceV1.toString());
        // Keep date field as today — don't overwrite with Petrolimex effective date
        setNewDate(localDateStr());
        const petrolDate = json.data.effectiveDate || json.data.date;
        if (json.data.parsedFromWeb) {
          setSyncMsg(<>✅ Cào giá thật từ Petrolimex: <b style={{color:'#22c55e'}}>{Number(json.data.priceV1).toLocaleString()} đ</b> (ngày cập nhật trên Petrolimex: <b style={{color:'#facc15'}}>{petrolDate}</b>) — Bấm &quot;+ Thêm&quot; để lưu.</>);
        } else {
          setSyncMsg(<>⚠️ Không cào được từ web! Đang dùng giá FALLBACK: <b style={{color:'#f97316'}}>{Number(json.data.priceV1).toLocaleString()} đ</b> (ngày <b style={{color:'#facc15'}}>{petrolDate}</b>) — Hãy kiểm tra lại trước khi lưu!</>);
        }
      } else {
        setSyncMsg("❌ " + (json.message || "Lỗi dữ liệu."));
      }
    } catch(err) {
      setSyncMsg("❌ Lỗi đồng bộ.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPriceV1) return;
    setIsSubmitting(true);
    setSyncMsg("");
    try {
      const token = sessionStorage.getItem("logipro_token");
      const res = await fetch(`${API_BASE}/api/prices/upsert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ date: newDate, fuelType: newFuelType, priceV1: Number(newPriceV1) }),
      });
      const json = await res.json();
      if (json.success) {
        setSyncMsg(json.message);
        setNewPriceV1("");

        // Auto-publish if the added date is today
        if (newDate === localDateStr() && json.id) {
          await fetch(`${API_BASE}/api/prices/${json.id}/publish`, {
            method: "PUT",
            headers: authHeader(),
          });
        }

        await fetchData();
        setTimeout(() => setSyncMsg(""), 3000);
      } else {
        setError(json.message || "Lỗi khi thêm giá dầu.");
      }
    } catch (err) {
      setError("Lỗi khi thêm giá dầu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSurchargeFromPrice = (price: number, type: string) => {
    const activeTier = tiers.find(t => price >= t.minPrice && price <= t.maxPrice);
    if (!activeTier) return 0;
    if (type === '20F') return activeTier.surcharge20F;
    if (type === '40F') return activeTier.surcharge40F;
    if (type === '20E') return activeTier.surcharge20E;
    if (type === '40E') return activeTier.surcharge40E;
    return 0;
  };

  const getTierLabel = (price: number): string => {
    const sorted = [...tiers].sort((a, b) => a.minPrice - b.minPrice);
    const idx = sorted.findIndex(t => price >= t.minPrice && price <= t.maxPrice);
    if (idx === -1) return '—';
    return `Bậc ${idx + 1}`;
  };

  const getBulkTierPercent = (price: number): string => {
    const tier = bulkTiers.find(t => price >= t.minPrice && price <= t.maxPrice);
    if (!tier) return '—';
    return `${tier.percentSurcharge}%`;
  };

  const handleDeletePrice = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa lịch sử giá này?")) return;
    try {
      const updated = prices.filter(p => p.id !== id);
      setPrices(updated);
      await logiStorage.setPrices(updated);
    } catch {
      setError("Lỗi khi xóa giá.");
    }
  };

  const handleStartEditPrice = (p: FuelPrice) => {
    setEditingPriceId(p.id);
    setEditPriceValue(p.priceV1.toString());
  };

  const handleCancelEditPrice = () => {
    setEditingPriceId(null);
    setEditPriceValue("");
  };

  const handleSaveEditPrice = async (id: string) => {
    if (!editPriceValue) return;
    try {
      const res = await fetch(`${API_BASE}/api/prices/${id}`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ priceV1: Number(editPriceValue) }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingPriceId(null);
        setEditPriceValue("");
        await fetchData();
      } else {
        setError(json.message || "Lỗi khi sửa giá.");
      }
    } catch {
      setError("Lỗi kết nối khi sửa giá.");
    }
  };

  const handlePublishPrice = async (id: string, isCurrentlyPublished: boolean) => {
    try {
      let res;
      if (isCurrentlyPublished) {
        // Unpin → revert to default (latest)
        res = await fetch(`${API_BASE}/api/prices/publish`, {
          method: "DELETE",
          headers: authHeader(),
        });
      } else {
        res = await fetch(`${API_BASE}/api/prices/${id}/publish`, {
          method: "PUT",
          headers: authHeader(),
        });
      }
      const json = await res.json();
      if (json.success) {
        await fetchData();
      } else {
        setError(json.message || "Lỗi khi ghim giá.");
      }
    } catch {
      setError("Lỗi kết nối khi ghim giá.");
    }
  };

  const handleExportHistoryExcel = () => {
    // Sort descending for report
    const sorted = [...prices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const data = sorted.map((p, i, arr) => {
      const delta = i < arr.length - 1 ? p.priceV1 - arr[i + 1].priceV1 : 0;
      return {
        'Ngày Áp Dụng': new Date(p.date).toLocaleDateString('vi-VN'),
        'Loại Nhiên Liệu': p.fuelType,
        'Giá Bán Lẻ Vùng 1 (VNĐ)': p.priceV1,
        'Biến Động Giá': delta,
        'Phụ Thu 20 Full': getSurchargeFromPrice(p.priceV1, '20F'),
        'Phụ Thu 40 Full': getSurchargeFromPrice(p.priceV1, '40F'),
        'Phụ Thu 20 Empty': getSurchargeFromPrice(p.priceV1, '20E'),
        'Phụ Thu 40 Empty': getSurchargeFromPrice(p.priceV1, '40E')
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Thống kê giá Dầu DO");
    XLSX.writeFile(wb, `Thong_ke_gia_Dau_DO_${new Date().toISOString().split('T')[0]}.xlsx`);
  };


  const handleAddTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMinPrice || !newMaxPrice) return;
    setIsSubmitting(true);
    try {
      const newTier: Tier = {
        id: Date.now().toString(),
        minPrice: Number(newMinPrice),
        maxPrice: Number(newMaxPrice),
        surcharge20F: Number(newSurcharge20F) || 0,
        surcharge40F: Number(newSurcharge40F) || 0,
        surcharge20E: Number(newSurcharge20E) || 0,
        surcharge40E: Number(newSurcharge40E) || 0
      };
      const updated = [...tiers, newTier].sort((a, b) => a.minPrice - b.minPrice);
      setTiers(updated);
      await logiStorage.setTiers(updated);
      setNewMinPrice(""); setNewMaxPrice("");
      setNewSurcharge20F(""); setNewSurcharge40F("");
      setNewSurcharge20E(""); setNewSurcharge40E("");
    } catch (err) {
      setError("Lỗi khi thêm bậc phụ thu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddBulkTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBulkMinPrice || !newBulkMaxPrice) return;
    setIsSubmitting(true);
    try {
      const newTier: BulkTier = {
        id: Date.now().toString(),
        minPrice: Number(newBulkMinPrice),
        maxPrice: Number(newBulkMaxPrice),
        percentSurcharge: Number(newPercentSurcharge) || 0
      };
      const updated = [...bulkTiers, newTier].sort((a, b) => a.minPrice - b.minPrice);
      setBulkTiers(updated);
      await logiStorage.setBulkTiers(updated);
      setNewBulkMinPrice(""); setNewBulkMaxPrice("");
      setNewPercentSurcharge("");
    } catch (err) {
      setError("Lỗi khi thêm bậc phụ thu hàng ngoài.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportBackup = async () => {
    const data = {
      version: 1, 
      timestamp: new Date().toISOString(),
      prices: await logiStorage.getPrices(),
      tiers: await logiStorage.getTiers(),
      bulkTiers: await logiStorage.getBulkTiers(),
      customers: await logiStorage.getCustomers(),
      services: await logiStorage.getServices(),
      quotationHistory: await logiStorage.getQuotations()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logipro_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (window.confirm("CẢNH BÁO: Dữ liệu hiện tại sẽ bị Ghi đè bằng dữ liệu trong file backup. Quá trình này không thể hoàn tác. Bạn đã chắc chắn?")) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          
          if (!parsed.version) throw new Error("Cấu trúc file backup không chuẩn.");
          
          if (parsed.prices) await logiStorage.setPrices(parsed.prices);
          if (parsed.tiers) await logiStorage.setTiers(parsed.tiers);
          if (parsed.bulkTiers) await logiStorage.setBulkTiers(parsed.bulkTiers);
          if (parsed.customers) await logiStorage.setCustomers(parsed.customers);
          if (parsed.services) await logiStorage.setServices(parsed.services);
          if (parsed.quotationHistory) await logiStorage.setQuotations(parsed.quotationHistory); 

          alert("✅ Đã khôi phục dữ liệu lên Server thành công! Ứng dụng sẽ tải lại.");
          window.location.reload();
        } catch (error: any) {
          alert("❌ Lỗi khôi phục: " + error.message);
        }
      };
      reader.readAsText(file);
    }
  };


  return (
    <div className={S.wrapper}>
      <div className={S.headerCol}>
        <h1 className={S.title}>CÀI ĐẶT</h1>
        <p className={S.subtitle}>Quản lý giá nhiên liệu và phụ thu</p>
      </div>

      {error && (
        <div className={S.errorBanner}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className={S.errorText}>{error}</p>
        </div>
      )}

      <section className={S.sectionCard}>
        <div className={S.sectionHeader}>
          <div className={S.sectionIcon}><Settings className="w-5 h-5" /></div>
          <div className={S.tabRow}>
            <button onClick={() => setAdminTab("prices")} className={S.tab(adminTab === 'prices')}>Dầu DO 0,05S-II</button>
            <button onClick={() => setAdminTab("tiers")} className={S.tab(adminTab === 'tiers')}>Hàng Container</button>
            <button onClick={() => setAdminTab("bulkTiers")} className={S.tab(adminTab === 'bulkTiers')}>Hàng ngoài container</button>
            <button onClick={() => setAdminTab("backup")} className={S.tab(adminTab === 'backup')}>Sao Lưu Data</button>
            <button onClick={() => setAdminTab("fallback")} className={S.tab(adminTab === 'fallback')}>Giá Khẩn Cấp</button>
            <button onClick={() => setAdminTab("audit")} className={S.tab(adminTab === 'audit')}>Nhật Ký (Audit)</button>
            <button onClick={() => setAdminTab("users")} className={S.tab(adminTab === 'users')}>👥 Quản lý Users</button>
          </div>
        </div>
        
        <div className={S.sectionBody}>
          {adminTab === "prices" && (
            <div className={S.pricesSpace}>
              <div className={S.pricesHeaderRow}>
                <h3 className={S.pricesSectionTitle}>Thêm giá mới</h3>
                <div className={S.syncRow}>
                  {syncMsg && <span className={S.syncMsg}>{syncMsg}</span>}
                  <button type="button" onClick={() => handleSync()} disabled={isSyncing} className={S.syncBtn}>
                    <DownloadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                    {isSyncing ? "Đang lấy..." : "🌐 Đồng bộ từ Web"}
                  </button>
                </div>
              </div>
              <form onSubmit={handleAddPrice} className={S.priceForm}>
              <div className={S.fieldGroup}>
                <label className={S.label}>Ngày</label>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required className={S.input} />
              </div>
              <div className={S.fieldGroup}>
                <label className={S.label}>Loại nhiên liệu</label>
                <select value={newFuelType} onChange={e => setNewFuelType(e.target.value)} className={S.input}>
                  <option value="Dầu DO 0,05S-II">Dầu DO 0,05S-II</option>
                </select>
              </div>
              <div className={S.fieldGroup}>
                <label className={S.label}>Giá Vùng 1 (VND)</label>
                <input type="number" value={newPriceV1} onChange={e => setNewPriceV1(e.target.value)} required placeholder="VD: 20500" className={S.input} />
              </div>
              <div>
                <button type="submit" disabled={isSubmitting} className={S.submitBtn}>
                  <Plus className="w-5 h-5" /> Thêm
                </button>
              </div>
             </form>
             
             <div className={S.statsWrapper}>
                <div className={S.statsHeaderRow}>
                  <div>
                    <h3 className={S.statsTitle}>Thống kê</h3>
                    <p className={S.statsSubtitle}>Bảng tổng hợp giá DO và các mức phụ thu tương ứng.</p>
                  </div>
                  <button onClick={handleExportHistoryExcel} className={S.excelBtn}>
                    <FileSpreadsheet className="w-4 h-4" /> Xuất Excel Báo Cáo
                  </button>
                </div>

                <div className={S.tableCard}>
                   <table className={S.table}>
                     <thead className={S.thead}>
                       <tr>
                         <th className={S.thSlate}></th>
                         <th className={S.thSlate}>Ngày Áp Dụng</th>
                         <th className={S.thIndigo}>Giá Vùng 1 (VNĐ)</th>
                         <th className={S.thIndigoCenter}>Biến động</th>
                         <th className={S.thIndigoCenter}>Mức Phụ Thu</th>
                         <th className={S.thSlateCenter}>Thao tác</th>
                       </tr>
                     </thead>
                     <tbody className={S.tbody}>
                       {[...prices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((p, index, array) => {
                         const delta = index < array.length - 1 ? p.priceV1 - array[index + 1].priceV1 : 0;
                         const isEditing = editingPriceId === p.id;
                         const hasAnyPublished = prices.some(x => x.isPublished);
                         const isPublished = p.isPublished;
                         const isEffective = isPublished || (!hasAnyPublished && index === 0);
                         const isExpanded = expandedPriceId === p.id;
                         return (
                         <React.Fragment key={p.id}>
                         <tr
                           className={`${S.row} ${isEffective ? 'ring-1 ring-indigo-300 bg-indigo-50/40' : ''} cursor-pointer`}
                           onClick={() => setExpandedPriceId(isExpanded ? null : p.id)}
                         >
                           <td className={S.tdExpandIcon}>
                             {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                           </td>
                           <td className={S.tdDate}>
                             {new Date(p.date).toLocaleDateString('vi-VN')}
                             {isEffective && <span className={S.publishedBadge}>📌 Đang dùng</span>}
                           </td>
                           <td className={S.tdPrice}>
                             {isEditing ? (
                               <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                                 <input
                                   type="number"
                                   value={editPriceValue}
                                   onChange={e => setEditPriceValue(e.target.value)}
                                   className={S.inlineEditInput}
                                   autoFocus
                                   onKeyDown={e => {
                                     if (e.key === 'Enter') handleSaveEditPrice(p.id);
                                     if (e.key === 'Escape') handleCancelEditPrice();
                                   }}
                                 />
                                 <button onClick={() => handleSaveEditPrice(p.id)} className={S.inlineEditSaveBtn} title="Lưu">
                                   <Check className="w-3.5 h-3.5" />
                                 </button>
                                 <button onClick={handleCancelEditPrice} className={S.inlineEditCancelBtn} title="Hủy">
                                   <X className="w-3.5 h-3.5" />
                                 </button>
                               </div>
                             ) : (
                               <>{p.priceV1.toLocaleString('vi-VN')} đ</>
                             )}
                           </td>
                           <td className={S.tdDeltaCenter}>
                              {delta > 0 && <span className={S.deltaUp}>+ {delta.toLocaleString('vi-VN')} đ (Tăng)</span>}
                              {delta < 0 && <span className={S.deltaDown}>- {Math.abs(delta).toLocaleString('vi-VN')} đ (Giảm)</span>}
                              {delta === 0 && <span className={S.deltaNone}>-</span>}
                           </td>
                           <td className={S.tdTierCenter}>
                             <span className={S.tierBadge}>{getTierLabel(p.priceV1)}</span>
                           </td>
                           <td className={S.tdActionCenter} onClick={e => e.stopPropagation()}>
                             <div className="flex items-center justify-center gap-1">
                               <button onClick={() => handleStartEditPrice(p)} className={S.editIconBtn} title="Sửa giá">
                                 <Pencil className="w-4 h-4" />
                               </button>
                               <button
                                 onClick={() => handlePublishPrice(p.id, !!isPublished)}
                                 className={isEffective ? S.pinActiveBtn : S.pinIconBtn}
                                 title={isEffective ? "Bỏ ghim (dùng giá mới nhất)" : "Ghim giá này lên Trang chủ"}
                               >
                                 {isEffective ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                               </button>
                               <button onClick={() => handleDeletePrice(p.id)} className={S.deleteIconBtn} title="Xóa giá này">
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </div>
                           </td>
                         </tr>
                         {isExpanded && (
                           <tr className={S.expandedRow}>
                             <td colSpan={6} className={S.expandedCell}>
                               <div className={S.expandedWrapper}>
                                 <div className={S.expandedInlineSection}>
                                   <span className={S.expandedSectionTitle}>📦 Hàng Container</span>
                                   <span className={S.expandedInlineItem}><span className={S.expandedLabel}>20E:</span> <span className={S.expandedValueRose}>{getSurchargeFromPrice(p.priceV1, '20E').toLocaleString('vi-VN')} đ</span></span>
                                   <span className={S.expandedInlineSep}>|</span>
                                   <span className={S.expandedInlineItem}><span className={S.expandedLabel}>40E:</span> <span className={S.expandedValueRose}>{getSurchargeFromPrice(p.priceV1, '40E').toLocaleString('vi-VN')} đ</span></span>
                                   <span className={S.expandedInlineSep}>|</span>
                                   <span className={S.expandedInlineItem}><span className={S.expandedLabel}>20F:</span> <span className={S.expandedValueRose}>{getSurchargeFromPrice(p.priceV1, '20F').toLocaleString('vi-VN')} đ</span></span>
                                   <span className={S.expandedInlineSep}>|</span>
                                   <span className={S.expandedInlineItem}><span className={S.expandedLabel}>40F:</span> <span className={S.expandedValueRose}>{getSurchargeFromPrice(p.priceV1, '40F').toLocaleString('vi-VN')} đ</span></span>
                                 </div>
                                 <div className={S.expandedInlineSection}>
                                   <span className={S.expandedSectionTitle}>🚛 Hàng Rời (Bulk)</span>
                                   <span className={S.expandedInlineItem}><span className={S.expandedLabel}>Tỉ lệ phụ thu:</span> <span className={S.expandedValueOrange}>{getBulkTierPercent(p.priceV1)}</span></span>
                                 </div>
                               </div>
                             </td>
                           </tr>
                         )}
                         </React.Fragment>
                       )})}
                       {prices.length === 0 && (
                         <tr><td colSpan={6} className={S.emptyRow}>Chưa có dữ liệu thống kê.</td></tr>
                       )}
                     </tbody>
                   </table>
                </div>
             </div>

            </div>
          )}
          {adminTab === "tiers" && (
            <form onSubmit={handleAddTier} className={S.tierForm}>
              <div className={S.tierGrid2}>
                <div className={S.fieldGroup}>
                  <label className={S.label}>Giá DO Từ (VND)</label>
                  <input type="number" value={newMinPrice} onChange={e => setNewMinPrice(e.target.value)} required placeholder="VD: 23001" className={S.input} />
                </div>
                <div className={S.fieldGroup}>
                  <label className={S.label}>Giá DO Đến (VND)</label>
                  <input type="number" value={newMaxPrice} onChange={e => setNewMaxPrice(e.target.value)} required placeholder="VD: 26000" className={S.input} />
                </div>
              </div>
              <div className={S.tierGrid4}>
                <div className={S.fieldGroup}>
                  <label className={S.label}>20 Full</label>
                  <input type="number" value={newSurcharge20F} onChange={e => setNewSurcharge20F(e.target.value)} placeholder="VD: 50000" className={S.input} />
                </div>
                <div className={S.fieldGroup}>
                  <label className={S.label}>40 Full</label>
                  <input type="number" value={newSurcharge40F} onChange={e => setNewSurcharge40F(e.target.value)} placeholder="VD: 60000" className={S.input} />
                </div>
                <div className={S.fieldGroup}>
                  <label className={S.label}>20 Empty</label>
                  <input type="number" value={newSurcharge20E} onChange={e => setNewSurcharge20E(e.target.value)} placeholder="VD: 35000" className={S.input} />
                </div>
                <div className={S.fieldGroup}>
                  <label className={S.label}>40 Empty</label>
                  <input type="number" value={newSurcharge40E} onChange={e => setNewSurcharge40E(e.target.value)} placeholder="VD: 50000" className={S.input} />
                </div>
              </div>
              <div className={S.tierSubmitRow}>
                <button type="submit" disabled={isSubmitting} className={S.tierSubmitBtn}>
                  <Plus className="w-6 h-6" /> Thêm Bậc
                </button>
              </div>
            </form>
          )}
          {adminTab === "bulkTiers" && (
            <form onSubmit={handleAddBulkTier} className={S.tierForm}>
              <div className={S.bulkGrid3}>
                <div className={S.fieldGroup}>
                  <label className={S.label}>Giá DO Từ (VND)</label>
                  <input type="number" value={newBulkMinPrice} onChange={e => setNewBulkMinPrice(e.target.value)} required placeholder="VD: 23001" className={S.input} />
                </div>
                <div className={S.fieldGroup}>
                  <label className={S.label}>Giá DO Đến (VND)</label>
                  <input type="number" value={newBulkMaxPrice} onChange={e => setNewBulkMaxPrice(e.target.value)} required placeholder="VD: 26000" className={S.input} />
                </div>
                <div className={S.fieldGroup}>
                  <label className={S.label}>Mức Phụ Thu (%)</label>
                  <input type="number" value={newPercentSurcharge} onChange={e => setNewPercentSurcharge(e.target.value)} required placeholder="VD: 3" className={S.input} />
                </div>
              </div>
              <div className={S.tierSubmitRow}>
                <button type="submit" disabled={isSubmitting} className={S.tierSubmitBtn}>
                  <Plus className="w-6 h-6" /> Thêm Bậc
                </button>
              </div>
            </form>
          )}
          {adminTab === "backup" && (
            <div className={S.backupSpace}>
              <div className={S.warningBox}>
                <Database className="w-8 h-8 text-amber-500 flex-shrink-0" />
                <div>
                  <h3 className={S.warningTitle}>Sao lưu & Phục hồi cơ sở dữ liệu</h3>
                  <p className={S.warningText}>
                    Hệ thống lưu trữ trên trình duyệt của máy tính hiện tại. Bạn NÊN thường xuyên tải xuống bản sao lưu để lưu trữ an toàn. 
                    Khi chuyển sang máy tính mới hoặc cài lại trình duyệt, bạn có thể tái thiết lập dữ liệu bằng tính năng Import.
                  </p>
                </div>
              </div>

              <div className={S.backupGrid}>
                <div className={S.backupCard}>
                  <div className={S.backupIconIndigo}><DownloadCloud className="w-8 h-8" /></div>
                  <h3 className={S.backupCardTitle}>Xuất Dữ liệu (Export)</h3>
                  <p className={S.backupCardText}>Tải toàn bộ cấu hình bảng giá, phụ thu và lịch sử xuống máy thành 1 file JSON độc lập.</p>
                  <button onClick={handleExportBackup} className={S.exportBackupBtn}>
                    <Save className="w-4 h-4" /> Tải file JSON an toàn
                  </button>
                </div>

                <div className={S.backupCard}>
                  <div className={S.backupIconRose}><UploadCloud className="w-8 h-8" /></div>
                  <h3 className={S.backupCardTitle}>Khôi phục Dữ liệu (Import)</h3>
                  <p className={S.backupCardText}>Ghi đè ứng dụng hiện tại bằng file JSON sao lưu. <span className="font-bold text-rose-500">Thao tác này sẽ xóa dữ liệu cũ.</span></p>
                  <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImportBackup} />
                  <button onClick={() => fileInputRef.current?.click()} className={S.importBackupBtn}>
                    <UploadCloud className="w-4 h-4" /> Chọn file & Khôi phục
                  </button>
                </div>
              </div>
            </div>
          )}

          {adminTab === "fallback" && (
            <div className={S.fallbackSpace}>
              <div className={S.fallbackWarning}>
                <ShieldAlert className="w-6 h-6 flex-shrink-0 mt-1" />
                <div>
                   <h3 className={S.fallbackWarningTitle}>Cấu hình Giá dự phòng (Fallback)</h3>
                   <p className={S.fallbackWarningText}>Khi Petrolimex thay đổi giao diện hoặc không thể tự động lấy giá, hệ thống sẽ chốt và sử dụng giá được thiết lập cứng tại đây để tránh làm gián đoạn việc tính phụ thu.</p>
                </div>
              </div>
              <form onSubmit={handleSaveFallback} className={S.fallbackForm}>
                <div className={S.fieldGroup}>
                  <label className={S.fallbackLabel}>Giá DO (VNĐ)</label>
                  <input type="number" value={fallbackPrice} onChange={e => setFallbackPrice(e.target.value)} required className={S.fallbackInput} />
                </div>
                <div className={S.fieldGroup}>
                  <label className={S.fallbackLabel}>Kỳ Điều Hành (Ngày)</label>
                  <input type="date" value={fallbackDate} onChange={e => setFallbackDate(e.target.value)} required className={S.fallbackInput} />
                </div>
                <div className={S.fallbackSubmitRow}>
                   <button type="submit" className={S.fallbackSubmitBtn}>Lưu Cấu Hình</button>
                   {fallbackMsg && <span className={S.fallbackMsg(fallbackMsg.includes('✅'))}>{fallbackMsg}</span>}
                </div>
              </form>
            </div>
          )}

          {adminTab === "users" && (
            <div className={S.auditSpace}>
              <h3 className={S.auditTitle}>
                <Users className="w-5 h-5 text-indigo-500" /> Quản lý Tài khoản
              </h3>

              {/* User form */}
              <form onSubmit={handleSaveUser} className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className={S.fieldGroup}>
                    <label className={S.label}>Username</label>
                    <input type="text" value={ufUsername} onChange={e => setUfUsername(e.target.value)} required disabled={userFormMode === 'edit'} placeholder="VD: nhanvien01" className={S.input} />
                  </div>
                  <div className={S.fieldGroup}>
                    <label className={S.label}>Tên hiển thị</label>
                    <input type="text" value={ufDisplayName} onChange={e => setUfDisplayName(e.target.value)} required placeholder="VD: Nguyễn Văn A" className={S.input} />
                  </div>
                  <div className={S.fieldGroup}>
                    <label className={S.label}>{userFormMode === 'edit' ? 'Mật khẩu mới (để trống = giữ nguyên)' : 'Mật khẩu'}</label>
                    <input type="password" value={ufPassword} onChange={e => setUfPassword(e.target.value)} required={userFormMode === 'add'} placeholder="••••••" className={S.input} />
                  </div>
                  <div className={S.fieldGroup}>
                    <label className={S.label}>Vai trò</label>
                    <select value={ufRole} onChange={e => setUfRole(e.target.value)} className={S.input}>
                      <option value="admin">Admin</option>
                      <option value="thuongvu">Thương vụ</option>
                      <option value="guest">Khách / Xem</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button type="submit" className={S.submitBtn}>
                    {userFormMode === 'add' ? <><UserPlus className="w-4 h-4" /> Tạo User</> : <><Save className="w-4 h-4" /> Cập nhật</>}
                  </button>
                  {userFormMode === 'edit' && <button type="button" onClick={resetUserForm} className="text-sm text-slate-500 hover:text-slate-700">Hủy</button>}
                  {userMsg && <span className="text-sm font-medium">{userMsg}</span>}
                </div>
              </form>

              {/* User list table */}
              <div className={S.auditCard}>
                <table className={S.auditTable}>
                  <thead className={S.auditThead}>
                    <tr>
                      <th className={S.auditTh}>Username</th>
                      <th className={S.auditTh}>Tên hiển thị</th>
                      <th className={S.auditTh}>Vai trò</th>
                      <th className={S.auditTh}>Ngày tạo</th>
                      <th className={S.auditTh}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className={S.auditTbody}>
                    {userList.map((u) => (
                      <tr key={u.id} className={S.auditRow}>
                        <td className={S.auditTdAction}>{u.username}</td>
                        <td className={S.auditTdDetail}>{u.displayName}</td>
                        <td className={S.auditTdAction}>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                            u.role === 'admin' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                            u.role === 'thuongvu' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {u.role === 'admin' ? 'Admin' : u.role === 'thuongvu' ? 'Thương vụ' : 'Khách'}
                          </span>
                        </td>
                        <td className={S.auditTdTime}>{u.createdAt && !isNaN(new Date(u.createdAt).getTime()) ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2">
                            <button onClick={() => handleEditUser(u)} className="p-1 text-indigo-500 hover:text-indigo-700" title="Sửa"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteUser(u)} className="p-1 text-rose-500 hover:text-rose-700" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {userList.length === 0 && (
                      <tr><td colSpan={5} className={S.auditEmpty}>Chưa có user nào.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminTab === "audit" && (
            <div className={S.auditSpace}>
              <h3 className={S.auditTitle}>
                <History className="w-5 h-5 text-indigo-500" /> Nhật ký Thao tác (Audit Logs)
              </h3>
              <div className={S.auditCard}>
                <table className={S.auditTable}>
                  <thead className={S.auditThead}>
                    <tr>
                      <th className={S.auditTh}>Thời gian</th>
                      <th className={S.auditTh}>Hành động</th>
                      <th className={S.auditTh}>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className={S.auditTbody}>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className={S.auditRow}>
                        <td className={S.auditTdTime}>{new Date(log.timestamp).toLocaleString('vi-VN')}</td>
                        <td className={S.auditTdAction}>{log.action}</td>
                        <td className={S.auditTdDetail}>{log.details}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr><td colSpan={3} className={S.auditEmpty}>Chưa có dữ liệu lịch sử thao tác.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminPanel;
