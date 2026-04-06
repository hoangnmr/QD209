import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAppContext } from '../context/AppContext';
import { numberToWords_VI, numberToWords_EN } from '../utils/numberToWords';
import { logiStorage } from '../lib/storage';
import { QuotationHistoryItem, QuotationItem, Customer, RowItem } from '../types';
import { useToast } from '../hooks/useToast';
import { useResponsive } from '../hooks/useResponsive';
import { useLogoBase64 } from '../hooks/useLogoBase64';
import { useSequentialNo } from '../hooks/useSequentialNo';
import { usePDFExport } from '../hooks/usePDFExport';
import { useExcelIO } from '../hooks/useExcelIO';
import { T } from '../constants/quotationT';
import QuotationHistoryModal from './quotation/QuotationHistoryModal';
import QuotationTariffModal, { TariffItem } from './quotation/QuotationTariffModal';
import QuotationA4Template from './quotation/QuotationA4Template';
import QuotationFormSection from './quotation/QuotationFormSection';
import QuotationActionsPanel from './quotation/QuotationActionsPanel';
import * as S from '../styles/QuotationModule.styles';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const newEmptyRow = (): RowItem => ({
  id: Math.random().toString(36).slice(2),
  name: '', unit: 'cont', price: 0, quantity: 1,
  containerQty: 1, startDate: '', endDate: ''
});

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function QuotationModule() {
  const { customers, services, quotations, setQuotations, pendingSurcharge, setPendingSurcharge, pendingCustomer, setPendingCustomer, isAdminMode, userRole } = useAppContext();
  const canEdit = isAdminMode && userRole !== 'guest';

  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const t = T[lang];

  // ── Shared hooks ──────────────────────────────────────────────────────────
  const isMobile = useResponsive();
  const { toast, showToast } = useToast();
  const logoBase64 = useLogoBase64();
  const { peek: peekQuoteNo, advance: advanceQuoteNo } = useSequentialNo({ prefix: lang === 'vi' ? 'BG' : 'QT', counterKey: 'logipro_daily_counter' });
  const { a4Ref, previewImg, setPreviewImg, isRendering, generatePreview, exportPDF } = usePDFExport();

  // ── Form state ────────────────────────────────────────────────────────────
  const [quoteNo, setQuoteNo] = useState('');
  const [quoteDate, setQuoteDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<RowItem[]>([newEmptyRow()]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTariff, setShowTariff] = useState(false);
  const [tariffList, setTariffList] = useState<TariffItem[]>([]);
  const [tariffForm, setTariffForm] = useState({ name: '', unit: 'cont', price: 0 });
  const [tariffEditId, setTariffEditId] = useState<string | null>(null);

  // ── Load tariff on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('logipro_tariff');
    if (saved) {
      setTariffList(JSON.parse(saved));
    } else {
      setTariffList(services.map((s: any) => ({ id: s.id || Math.random().toString(36).slice(2), name: s.name, unit: s.unit || 'cont', price: s.price || 0 })));
    }
    setQuoteNo(peekQuoteNo());
    setQuoteDate(new Date().toLocaleDateString('vi-VN'));
  }, []);

  const saveTariff = (list: TariffItem[]) => {
    setTariffList(list);
    localStorage.setItem('logipro_tariff', JSON.stringify(list));
  };

  const handleTariffSave = () => {
    if (!tariffForm.name.trim()) return;
    if (tariffEditId) {
      saveTariff(tariffList.map(item => item.id === tariffEditId ? { ...item, ...tariffForm } : item));
    } else {
      saveTariff([...tariffList, { id: Date.now().toString(), ...tariffForm }]);
    }
    setTariffForm({ name: '', unit: 'cont', price: 0 });
    setTariffEditId(null);
  };

  const { handleImport: handleTariffImportExcel, handleExport: handleTariffExportExcel } = useExcelIO({
    onImport: (rows) => {
      const newList = rows.map(r => ({ id: Date.now().toString() + Math.random(), name: String(r['Name'] || r['Tên'] || ''), unit: String(r['Unit'] || r['ĐVT'] || 'cont'), price: parseFloat(String(r['Price'] || r['Đơn giá'] || '0')) || 0 })).filter(x => x.name);
      if (newList.length === 0) { showToast('Không tìm thấy dữ liệu trong file.', 'error'); return; }
      if (confirm(`Tìm thấy ${newList.length} phương án. Thay thế danh sách hiện tại?`)) { saveTariff(newList); showToast('Đã import danh sách phương án!'); }
    },
    toExportRows: () => tariffList.map(item => ({ 'Name': item.name, 'Unit': item.unit, 'Price': item.price })),
    exportFilename: 'DanhMucPhuongAn', sheetName: 'PhuongAn'
  });


  // ── Absorb pendingSurcharge from Calculator ───────────────────────────────
  const lastProcessedSurchargeRef = useRef<typeof pendingSurcharge>(null);
  useEffect(() => {
    if (!pendingSurcharge) return;
    // Guard against React StrictMode double-invoke (same object reference = already processed)
    if (pendingSurcharge === lastProcessedSurchargeRef.current) return;
    lastProcessedSurchargeRef.current = pendingSurcharge;

    const surcharge = pendingSurcharge;
    setPendingSurcharge(null);
    const surchargeRow: RowItem = {
      id: Math.random().toString(36).slice(2),
      name: lang === 'vi' ? 'Phụ thu nhiên liệu' : 'Fuel Surcharge',
      unit: surcharge.cargoType === 'container' ? 'cont' : 'VNĐ',
      price: surcharge.amount,
      quantity: surcharge.quantity,
      containerQty: 1, startDate: '', endDate: ''
    };
    setItems(prev => [...prev.filter(i => i.name !== ''), surchargeRow, newEmptyRow()]);
    showToast(
      lang === 'vi'
        ? `Đã thêm phụ thu nhiên liệu (${surcharge.amount.toLocaleString()} đ/cont). Vui lòng chọn thêm phương án.`
        : `Fuel surcharge added. Please select additional services.`,
      'success'
    );
  }, [pendingSurcharge]);


  // ── Absorb pendingCustomer (from CustomerList) ────────────────────────────
  useEffect(() => {
    if (!pendingCustomer) return;
    const c = pendingCustomer;
    setPendingCustomer(null);
    setCustomerName(c.name);
    setTaxCode(c.taxCode || '');
    setAddress(c.address || '');
    setPhone(c.phone || '');
    setNotes(c.email ? `Email: ${c.email}` : '');
  }, [pendingCustomer]);

  // ── Calculations ──────────────────────────────────────────────────────────
  const processed = useMemo(() => {
    let grand = 0;
    const rows = items.map(item => {
      const isStorage = item.name.toLowerCase().includes(t.storageKw);
      const isPower = item.name.toLowerCase().includes(t.powerKw);
      const lineTotal = (isStorage || isPower)
        ? item.containerQty * item.quantity * item.price
        : item.quantity * item.price;
      grand += lineTotal;
      return { ...item, lineTotal };
    });
    return { rows, grand, inWords: lang === 'vi' ? numberToWords_VI(grand) : numberToWords_EN(grand) };
  }, [items, lang]);

  // ── Customer autocomplete ─────────────────────────────────────────────────
  const handleCustomerChange = (name: string) => {
    setCustomerName(name);
    const c = customers.find((cu: Customer) => cu.name === name);
    if (c) { setTaxCode(c.taxCode || ''); setAddress(c.address || ''); setPhone(c.phone || ''); setNotes(c.email ? `Email: ${c.email}` : ''); }
  };

  // ── Row helpers ───────────────────────────────────────────────────────────
  const updateRow = (id: string, patch: Partial<RowItem>) => setItems(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  const removeRow = (id: string) => setItems(prev => prev.filter(r => r.id !== id));
  const addRow = () => setItems(prev => [...prev, newEmptyRow()]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleNew = () => {
    if (!confirm(t.confirmNew)) return;
    setCustomerName(''); setTaxCode(''); setAddress(''); setPhone(''); setNotes('');
    setItems([newEmptyRow()]);
    advanceQuoteNo();
    setQuoteNo(peekQuoteNo());
    setPreviewImg(null);
    showToast(lang === 'vi' ? 'Đã tạo báo giá mới' : 'New quotation created', 'info');
  };

  const handleSave = async () => {
    const q: QuotationHistoryItem = {
      id: quoteNo + '_' + Date.now(), quotationNo: quoteNo, customerName, date: quoteDate,
      total: processed.grand, status: 'draft', createdBy: 'user',
      items: processed.rows.map(r => ({ id: r.id, name: r.name, unit: r.unit, quantity: r.quantity, price: r.price, total: r.lineTotal }) as QuotationItem)
    };
    try {
      await logiStorage.saveQuotation(q);
      setQuotations(await logiStorage.getQuotations());
      showToast(lang === 'vi' ? `Đã lưu báo giá cho "${customerName}"!` : `Saved for "${customerName}"!`);
      advanceQuoteNo();
      setQuoteNo(peekQuoteNo());
      if (customerName && !customers.find((c: Customer) => c.name === customerName)) {
        await logiStorage.saveCustomer({ id: Date.now().toString(), name: customerName, taxCode: taxCode || '', address: address || '', phone: phone || '', email: '', status: 'active' });
      }
    } catch { showToast('Lỗi khi lưu! Vui lòng thử lại.', 'error'); }
  };



  const handleDeleteQuote = async (id: string) => {
    if (!confirm(t.confirmDeleteQuote)) return;
    await logiStorage.deleteQuotation(id);
    setQuotations(await logiStorage.getQuotations());
  };

  const handleLoadQuote = (q: QuotationHistoryItem) => {
    setQuoteNo(q.quotationNo); setQuoteDate(q.date); setCustomerName(q.customerName);
    setItems((q.items || []).map(i => ({ id: i.id || Math.random().toString(36).slice(2), name: i.name, unit: i.unit, price: i.price, quantity: i.quantity, containerQty: 1, startDate: '', endDate: '' })));
    setShowHistory(false);
    setPreviewImg(null);
  };

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.root(isMobile)}>

      {/* TOAST */}
      {toast && (
        <div style={{ ...S.toastBase, background: S.toastBg[toast.type] || S.toastBg.success }}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div style={S.header}>
        <div>
          <h1 style={S.headerTitle}>{t.appTitle}</h1>
          <p style={S.headerSub}>{t.developedBy}</p>
        </div>
        <div style={S.headerActions}>
          <button onClick={() => setShowTariff(true)} disabled={!canEdit} style={{...S.cBtn('#6c757d'), ...(canEdit ? {} : {opacity:0.5, cursor:'not-allowed'})}} >📋 {t.manageTariff}</button>
          <button onClick={() => setShowHistory(true)} style={S.cBtn('#fd7e14')}>{t.historyBtn}</button>
          <button onClick={() => setLang(l => l === 'vi' ? 'en' : 'vi')} style={S.cBtn('#6f42c1')}>{t.switchLang}</button>
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={S.mainGrid(isMobile)}>
        <QuotationFormSection
          t={t} quoteNo={quoteNo} onQuoteNoChange={canEdit ? setQuoteNo : ()=>{}}
          quoteDate={quoteDate} onQuoteDateChange={canEdit ? setQuoteDate : ()=>{}}
          customerName={customerName} onCustomerChange={canEdit ? handleCustomerChange : ()=>{}}
          taxCode={taxCode} onTaxCodeChange={canEdit ? setTaxCode : ()=>{}}
          address={address} onAddressChange={canEdit ? setAddress : ()=>{}}
          phone={phone} onPhoneChange={canEdit ? setPhone : ()=>{}}
          notes={notes} onNotesChange={canEdit ? setNotes : ()=>{}}
          customers={customers} items={items} tariffList={tariffList} services={services}
          updateRow={updateRow} removeRow={removeRow} addRow={addRow}
          processed={processed}
        />
        <div>
          <QuotationActionsPanel
            t={t} onNew={handleNew} onSave={handleSave}
            onGeneratePreview={generatePreview} isRendering={isRendering}
            onExportPDF={() => exportPDF(`Bao_gia_${customerName || 'khach_hang'}`)}
            previewImg={previewImg}
            canEdit={canEdit}
          />
        </div>
      </div>

      {/* MODALS */}
      {showHistory && (
        <QuotationHistoryModal quotations={quotations} onLoad={handleLoadQuote} onDelete={handleDeleteQuote} onClose={() => setShowHistory(false)} />
      )}
      {showTariff && (
        <QuotationTariffModal
          tariffList={tariffList} tariffForm={tariffForm} tariffEditId={tariffEditId}
          onFormChange={patch => setTariffForm(f => ({ ...f, ...patch }))}
          onSave={handleTariffSave}
          onEdit={item => { setTariffEditId(item.id); setTariffForm({ name: item.name, unit: item.unit, price: item.price }); }}
          onDelete={id => { if (!confirm('Xóa phương án này?')) return; saveTariff(tariffList.filter(x => x.id !== id)); }}
          onCancelEdit={() => { setTariffEditId(null); setTariffForm({ name: '', unit: 'cont', price: 0 }); }}
          onImportExcel={handleTariffImportExcel} onExportExcel={handleTariffExportExcel}
          onClose={() => setShowTariff(false)}
        />
      )}

      {/* HIDDEN A4 TEMPLATE */}
      <QuotationA4Template
        a4Ref={a4Ref} quoteNo={quoteNo} quoteDate={quoteDate}
        customerName={customerName} taxCode={taxCode} address={address} phone={phone} notes={notes}
        rows={processed.rows} grand={processed.grand} inWords={processed.inWords}
        dong={t.dong} storageKw={t.storageKw} powerKw={t.powerKw}
        logoBase64={logoBase64} pdf={T[lang].pdf}
      />
    </div>
  );
}

