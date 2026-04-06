import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, Download, FileSpreadsheet, Settings, History, X, Check, AlertCircle, Upload, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { logiStorage } from '../lib/storage';
import { QuotationHistoryItem } from '../types';

interface QuotationItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  total: number;
  note?: string;
}

interface Product {
  name: string;
  unit: string;
  price: number;
}

interface QuotationAppProps {
  pendingSurcharge: { amount: number; quantity: number; cargoType: string } | null;
  onSurchargeProcessed: () => void;
}

const defaultProducts: Product[] = [
  { name: 'Cước vận chuyển', unit: 'cont', price: 2000000 },
  { name: 'Phí nâng hạ', unit: 'cont', price: 500000 },
  { name: 'Phí lưu bãi', unit: 'ngày', price: 100000 },
  { name: 'Phụ thu nhiên liệu', unit: 'cont', price: 0 },
];

const numberToWords = (number: number): string => {
  const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const tens = ["", "mười", "hai mươi", "ba mươi", "bốn mươi", "năm mươi", "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];

  if (number === 0) return "không đồng";

  const readGroup = (group: number): string => {
    let res = "";
    const hundreds = Math.floor(group / 100);
    const remainder = group % 100;
    const ten = Math.floor(remainder / 10);
    const unit = remainder % 10;

    if (hundreds > 0) {
      res += units[hundreds] + " trăm ";
      if (ten === 0 && unit !== 0) res += "lẻ ";
    }

    if (ten > 0) {
      if (ten === 1) res += "mười ";
      else res += tens[ten] + " ";
    }

    if (unit > 0) {
      if (ten > 0 && unit === 1 && ten !== 1) res += "mốt ";
      else if (ten > 0 && unit === 5) res += "lăm ";
      else res += units[unit] + " ";
    }

    return res;
  };

  const groups = [];
  let temp = Math.floor(number);
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const groupNames = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  let result = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] > 0) {
      result += readGroup(groups[i]) + groupNames[i] + " ";
    }
  }

  result = result.trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + " đồng.";
};

export default function QuotationApp({ pendingSurcharge, onSurchargeProcessed }: QuotationAppProps) {
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [products, setProducts] = useState<Product[]>(defaultProducts);
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [note, setNote] = useState('');
  const [quotationNo, setQuotationNo] = useState(`BG${new Date().toISOString().slice(2, 4)}${new Date().toISOString().slice(5, 7)}-001`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [vatRate, setVatRate] = useState<number>(8);
  const [discount, setDiscount] = useState<number>(0);
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [showTariffModal, setShowTariffModal] = useState(false);
  const [showImportPreviewModal, setShowImportPreviewModal] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [importPreviewItems, setImportPreviewItems] = useState<QuotationItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // New product form state
  const [newProdName, setNewProdName] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');

  const quotationRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quotationImportRef = useRef<HTMLInputElement>(null);

  // Load products from local storage on mount
  useEffect(() => {
    const savedProducts = localStorage.getItem('quotation_products');
    if (savedProducts) {
      try {
        setProducts(JSON.parse(savedProducts));
      } catch (e) {
        console.error("Failed to parse saved products");
      }
    }
  }, []);

  // Handle pending surcharge from calculator
  useEffect(() => {
    if (pendingSurcharge) {
      const surchargeName = language === 'vi' ? 'Phụ thu nhiên liệu' : 'Fuel Surcharge';
      const unit = pendingSurcharge.cargoType === 'container' ? 'cont' : 'VNĐ';

      // Update or add product
      let updatedProducts = [...products];
      const existingProductIndex = updatedProducts.findIndex(p => p.name === surchargeName);
      if (existingProductIndex >= 0) {
        updatedProducts[existingProductIndex] = { name: surchargeName, unit, price: pendingSurcharge.amount };
      } else {
        updatedProducts.push({ name: surchargeName, unit, price: pendingSurcharge.amount });
      }
      setProducts(updatedProducts);
      localStorage.setItem('quotation_products', JSON.stringify(updatedProducts));

      // Add to quotation items
      const newItem: QuotationItem = {
        id: Date.now().toString(),
        name: surchargeName,
        unit: unit,
        quantity: pendingSurcharge.quantity,
        price: pendingSurcharge.amount,
        total: pendingSurcharge.amount * pendingSurcharge.quantity,
        note: ''
      };

      setItems(prev => [...prev, newItem]);
      onSurchargeProcessed();
    }
  }, [pendingSurcharge, language, products, onSurchargeProcessed]);

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), name: '', unit: 'cont', quantity: 1, price: 0, total: 0, note: '' }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSaveQuotation = () => {
    if (!customerName) {
      alert("Vui lòng nhập tên khách hàng");
      return;
    }

    const newQuotation: QuotationHistoryItem = {
      id: Date.now().toString(),
      quotationNo,
      customerName,
      date,
      total: grandTotal,
      status: 'draft',
      createdBy: sessionStorage.getItem('logipro_admin') === 'true' ? 'Admin' : 'User',
      items: [...items]
    };

    logiStorage.saveQuotation(newQuotation);
    alert("Báo giá đã được lưu vào Lịch sử!");
  };

  const updateItem = (id: string, field: keyof QuotationItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'name') {
          const product = products.find(p => p.name === value);
          if (product) {
            updatedItem.unit = product.unit;
            updatedItem.price = product.price;
          }
        }
        if (field === 'quantity' || field === 'price' || field === 'name') {
          updatedItem.total = (updatedItem.quantity || 0) * (updatedItem.price || 0);
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const vatAmount = subtotal * (vatRate / 100);
  const grandTotal = subtotal + vatAmount - discount;

  const handleImportQuotationExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const newItems: QuotationItem[] = data.map((row, index) => {
          const name = row['Tên dịch vụ'] || row['Service Name'] || row['Phương án'] || row['Tên'] || '';
          const unit = row['ĐVT'] || row['Unit'] || 'cont';
          const quantity = parseFloat(row['Số lượng'] || row['Qty'] || row['Quantity'] || '1');
          const price = parseFloat(row['Đơn giá'] || row['Price'] || row['Unit Price'] || '0');
          const note = row['Ghi chú'] || row['Note'] || '';

          return {
            id: (Date.now() + index).toString(),
            name,
            unit,
            quantity,
            price,
            total: quantity * price,
            note
          };
        }).filter(item => item.name);

        if (newItems.length > 0) {
          setImportPreviewItems(newItems);
          setShowImportPreviewModal(true);
        } else {
          alert("Không tìm thấy dữ liệu hợp lệ trong file Excel.");
        }
      } catch (err) {
        console.error("Error parsing Excel:", err);
        alert("Lỗi khi đọc file Excel. Vui lòng kiểm tra lại định dạng.");
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = () => {
    setItems([...items, ...importPreviewItems]);
    setShowImportPreviewModal(false);
    setImportPreviewItems([]);
  };

  const handleExportPDF = async () => {
    if (!quotationRef.current || isExporting) return;

    setIsExporting(true);
    try {
      // Small delay to ensure any UI updates are rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(quotationRef.current, {
        scale: 3, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1200
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`Bao_Gia_${customerName || 'Khach_Hang'}_${date}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert("Có lỗi xảy ra khi xuất PDF. Vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const newProducts = data.map(row => ({
        name: row['Tên'] || row['Name'] || '',
        unit: row['ĐVT'] || row['Unit'] || 'cont',
        price: parseFloat(row['Đơn giá'] || row['Price'] || '0')
      })).filter(p => p.name);

      if (newProducts.length > 0) {
        const updated = [...products, ...newProducts];
        setProducts(updated);
        localStorage.setItem('quotation_products', JSON.stringify(updated));
        alert(`Đã import ${newProducts.length} dịch vụ.`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportExcel = () => {
    const wsData = [
      ['BẢNG BÁO GIÁ DỊCH VỤ'],
      ['Khách hàng:', customerName],
      ['Địa chỉ:', address],
      ['Điện thoại:', phone],
      ['Ngày:', date],
      [],
      ['STT', 'Tên Dịch Vụ', 'ĐVT', 'Số Lượng', 'Đơn Giá (VNĐ)', 'Thành Tiền (VNĐ)', 'Ghi chú']
    ];

    items.forEach((item, index) => {
      wsData.push([
        (index + 1).toString(),
        item.name,
        item.unit,
        item.quantity.toString(),
        item.price.toString(),
        item.total.toString(),
        item.note || ''
      ]);
    });

    wsData.push([]);
    wsData.push(['', '', '', '', 'Cộng tiền hàng:', subtotal.toString()]);
    wsData.push(['', '', '', '', `Thuế GTGT (${vatRate}%):`, vatAmount.toString()]);
    wsData.push(['', '', '', '', 'Chiết khấu:', discount.toString()]);
    wsData.push(['', '', '', '', 'Tổng cộng thanh toán:', grandTotal.toString()]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Báo Giá");
    XLSX.writeFile(wb, `Bao_Gia_${customerName || 'Khach_Hang'}_${date}.xlsx`);
  };

  const t = {
    title: language === 'vi' ? 'BÁO GIÁ DỊCH VỤ' : 'SERVICE QUOTATION',
    customer: language === 'vi' ? 'Tên khách hàng' : 'Customer Name',
    address: language === 'vi' ? 'Địa chỉ' : 'Address',
    phone: language === 'vi' ? 'Điện thoại' : 'Phone',
    taxCode: language === 'vi' ? 'Mã số thuế' : 'Tax Code',
    note: language === 'vi' ? 'Ghi chú' : 'Note',
    date: language === 'vi' ? 'Ngày báo giá' : 'Quotation Date',
    quotationNo: language === 'vi' ? 'Số báo giá' : 'Quotation No',
    service: language === 'vi' ? 'PHƯƠNG ÁN' : 'SERVICE NAME',
    unit: language === 'vi' ? 'ĐVT' : 'UNIT',
    qty: language === 'vi' ? 'SỐ LƯỢNG' : 'QTY',
    price: language === 'vi' ? 'ĐƠN GIÁ' : 'UNIT PRICE',
    total: language === 'vi' ? 'THÀNH TIỀN' : 'TOTAL',
    subtotal: language === 'vi' ? 'Tổng cộng tiền thanh toán:' : 'Total amount:',
    vat: language === 'vi' ? 'Thuế GTGT' : 'VAT',
    discount: language === 'vi' ? 'Chiết khấu:' : 'Discount:',
    grandTotal: language === 'vi' ? 'Tổng cộng thanh toán:' : 'Grand Total:',
    addBtn: language === 'vi' ? 'Thêm dòng' : 'Add row',
    exportPdf: language === 'vi' ? 'In / Xuất PDF' : 'Print / Export PDF',
    exportExcel: language === 'vi' ? 'Xuất Excel' : 'Export Excel',
    tariff: language === 'vi' ? 'Phương án (Tariff)' : 'Tariff Management',
    history: language === 'vi' ? 'Lịch sử báo giá' : 'Quotation History',
    preview: language === 'vi' ? 'Xem trước (A4)' : 'Preview (A4)',
    save: language === 'vi' ? 'Lưu báo giá' : 'Save Quotation',
    update: language === 'vi' ? 'Cập nhật' : 'Update',
    new: language === 'vi' ? 'Tạo mới' : 'Create New',
  };

  return (
    <div className="bg-gray-50 flex flex-col h-full font-sans text-gray-900">
      {/* Sub-Header Toolbar */}
      <div className="bg-white border-b border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setLanguage('vi')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${language === 'vi' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}>VI</button>
            <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${language === 'en' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}>EN</button>
          </div>
          <button onClick={() => setShowTariffModal(true)} className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-slate-200">
            <Settings className="w-3.5 h-3.5" /> {t.tariff}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowMobilePreview(!showMobilePreview)} className="lg:hidden flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-indigo-100">
            {showMobilePreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {showMobilePreview ? 'Ẩn xem trước' : 'Xem trước'}
          </button>
          <button className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-amber-100">
            <History className="w-3.5 h-3.5" /> {t.history}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Inputs */}
        <div className={`w-full lg:w-1/2 p-6 overflow-y-auto border-r border-gray-200 bg-white ${showMobilePreview ? 'hidden lg:block' : 'block'}`}>
          <div className="space-y-8 max-w-3xl mx-auto">
            <section>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Thông tin chung</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setItems([]); setCustomerName(''); setAddress(''); setPhone(''); setTaxCode(''); setNote(''); }} className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors uppercase tracking-widest">{t.new}</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.quotationNo}</label>
                  <input type="text" value={quotationNo} onChange={(e) => setQuotationNo(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.date}</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.customer}</label>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="Tên khách hàng..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.taxCode}</label>
                  <input type="text" value={taxCode} onChange={(e) => setTaxCode(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.address}</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.phone}</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                </div>
                <div />
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.note}</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" placeholder="Nhập ghi chú cho báo giá..." />
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t.service}</h2>
                <div className="flex items-center gap-4">
                  <button onClick={() => quotationImportRef.current?.click()} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-all">
                    <Upload className="w-3 h-3" /> Import Excel
                  </button>
                  <button
                    onClick={() => {
                      const templateData = [
                        ['Tên dịch vụ', 'ĐVT', 'Số lượng', 'Đơn giá', 'Ghi chú'],
                        ['Cước vận chuyển', 'cont', 1, 2000000, 'Tuyến HCM - HP'],
                        ['Phí nâng hạ', 'cont', 1, 500000, 'Nâng hạ bãi'],
                        ['Phí lưu bãi', 'ngày', 5, 100000, 'Lưu bãi 5 ngày']
                      ];
                      const ws = XLSX.utils.aoa_to_sheet(templateData);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Template");
                      XLSX.writeFile(wb, "Template_Bao_Gia.xlsx");
                    }}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-[10px] font-bold transition-all uppercase tracking-widest"
                  >
                    <Download className="w-3 h-3" /> Tải mẫu
                  </button>
                  <input type="file" ref={quotationImportRef} onChange={handleImportQuotationExcel} accept=".xlsx, .xls" className="hidden" />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.vat}</span>
                    <select value={vatRate} onChange={(e) => setVatRate(parseFloat(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none">
                      <option value="0">0%</option>
                      <option value="8">8%</option>
                      <option value="10">10%</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-400 uppercase px-2 tracking-widest">
                  <div className="col-span-4">{t.service}</div>
                  <div className="col-span-2 text-center">{t.qty}</div>
                  <div className="col-span-2 text-right">{t.price}</div>
                  <div className="col-span-3 text-center">Ghi chú</div>
                  <div className="col-span-1"></div>
                </div>

                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl group transition-all hover:bg-indigo-50/30 border border-transparent hover:border-indigo-100">
                    <div className="col-span-4">
                      <input list="products-list" value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} className="w-full bg-transparent border-b border-slate-200 focus:border-indigo-500 outline-none text-sm py-1" />
                    </div>
                    <div className="col-span-2">
                      <input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-b border-slate-200 focus:border-indigo-500 outline-none text-sm text-center py-1" />
                    </div>
                    <div className="col-span-2">
                      <input type="number" value={item.price} onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-b border-slate-200 focus:border-indigo-500 outline-none text-sm text-right py-1" />
                    </div>
                    <div className="col-span-3">
                      <input type="text" value={item.note || ''} onChange={(e) => updateItem(item.id, 'note', e.target.value)} className="w-full bg-transparent border-b border-slate-200 focus:border-indigo-500 outline-none text-[10px] py-1" placeholder="..." />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}

                <button onClick={addItem} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest">
                  <Plus className="w-4 h-4" /> {t.addBtn}
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tổng cộng thanh toán:</span>
                  <span className="text-xl font-black text-indigo-600">{grandTotal.toLocaleString()} đ</span>
                </div>
                <p className="text-[10px] italic text-gray-400 text-right">Bằng chữ: {numberToWords(grandTotal)}</p>
              </div>
            </section>
          </div>
        </div>

        {/* Right Side: Preview */}
        <div className={`w-full lg:w-1/2 p-6 overflow-y-auto bg-slate-100/50 flex flex-col gap-6 ${showMobilePreview ? 'flex' : 'hidden lg:flex'}`}>
          <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.preview}</h2>
              <div className="flex items-center gap-2">
                <button onClick={handleExportExcel} className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-xs font-bold transition-all">
                  <FileSpreadsheet className="w-4 h-4" /> {t.exportExcel}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleSaveQuotation}
                className="bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-2xl shadow-sm border border-slate-200 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> {t.save}
              </button>
              <button onClick={handleExportPDF} disabled={isExporting} className={`bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest ${isExporting ? 'opacity-70 cursor-not-allowed' : ''}`}>
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" /> {t.exportPdf}
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-center">
              <div ref={quotationRef} className="w-[210mm] min-h-[297mm] bg-white shadow-2xl p-[15mm] flex flex-col text-[11pt] leading-relaxed text-black origin-top scale-[0.4] sm:scale-[0.6] md:scale-[0.7] lg:scale-[0.45] xl:scale-[0.65] 2xl:scale-[0.85]">
                {/* Quotation Header */}
                <div className="flex justify-between items-start mb-10">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 flex-shrink-0">
                      <img src="https://picsum.photos/seed/port/200/200" alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-base uppercase">TTĐH KHAI THÁC TÂN THUẬN</h3>
                      <p className="text-[9pt]">Điện thoại: 028 38728546</p>
                      <p className="text-[9pt]">Địa chỉ: 18B Lưu Trọng Lư, Phường Tân Thuận, TP. HCM</p>
                      <p className="text-[9pt]">Email: cms.cont@tanthuanport.vn</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[9pt] font-bold">Số: {quotationNo}</p>
                    <p className="text-[9pt] font-bold">Ngày: {new Date(date).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>

                <div className="text-center mb-10">
                  <h1 className="text-3xl font-black uppercase mb-1">BÁO GIÁ DỊCH VỤ</h1>
                  <p className="text-[10pt] italic">(Đã bao gồm {vatRate}% thuế VAT)</p>
                </div>

                <div className="grid grid-cols-2 gap-x-10 gap-y-2 mb-8 text-[10pt]">
                  <p><span className="font-bold">Tên khách hàng:</span> {customerName}</p>
                  <p><span className="font-bold">Mã số thuế:</span> {taxCode}</p>
                  <p className="col-span-2"><span className="font-bold">Địa chỉ:</span> {address}</p>
                  <p><span className="font-bold">Điện thoại:</span> {phone}</p>
                  <p><span className="font-bold">Ghi chú:</span> {note}</p>
                </div>

                <table className="w-full border-collapse border border-black mb-6 text-[10pt]">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-black py-2 px-1 w-10 text-center">STT</th>
                      <th className="border border-black py-2 px-3 text-left">Phương án</th>
                      <th className="border border-black py-2 px-1 w-14 text-center">ĐVT</th>
                      <th className="border border-black py-2 px-1 w-14 text-center">SL</th>
                      <th className="border border-black py-2 px-3 text-right">Đơn giá</th>
                      <th className="border border-black py-2 px-3 text-right">Thành tiền</th>
                      <th className="border border-black py-2 px-3 text-left">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="border border-black py-2 px-1 text-center">{idx + 1}</td>
                        <td className="border border-black py-2 px-3">{item.name}</td>
                        <td className="border border-black py-2 px-1 text-center">{item.unit}</td>
                        <td className="border border-black py-2 px-1 text-center">{item.quantity}</td>
                        <td className="border border-black py-2 px-3 text-right">{item.price.toLocaleString()}</td>
                        <td className="border border-black py-2 px-3 text-right">{item.total.toLocaleString()}</td>
                        <td className="border border-black py-2 px-3 text-[9pt] italic">{item.note}</td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-slate-50">
                      <td colSpan={5} className="border border-black py-2 px-3 text-left uppercase">Tổng cộng tiền thanh toán:</td>
                      <td colSpan={2} className="border border-black py-2 px-3 text-right text-indigo-700">{grandTotal.toLocaleString()} đ</td>
                    </tr>
                  </tbody>
                </table>

                <p className="text-[10pt] italic mb-10">Số tiền viết bằng chữ: <span className="font-bold">{numberToWords(grandTotal)}</span></p>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-10 space-y-2 text-[9pt]">
                  <p className="font-bold uppercase underline">Lưu ý:</p>
                  <p className="flex gap-2"><span>✓</span> Chúng tôi báo giá theo thông tin khách hàng cung cấp, vui lòng kiểm tra lại phương án.</p>
                  <p className="flex gap-2"><span>✓</span> Đối với phương án đóng/rút/sang container, chúng tôi không chịu trách nhiệm việc tháo gỡ, chằng buộc hàng hoá...</p>
                  <p className="flex gap-2"><span>✓</span> Nếu phát sinh thêm phương án, sẽ căn cứ vào thực tế hiện trường để thu phí bổ sung.</p>
                </div>

                <div className="mt-auto flex justify-between items-end border-t border-slate-100 pt-6">
                  <div className="space-y-1 text-[9pt]">
                    <p className="font-bold uppercase border-b border-black pb-1 mb-2">THÔNG TIN THANH TOÁN</p>
                    <p>Ngân hàng: <span className="font-bold">BIDV - Chau Thanh Sai Gon Branch</span></p>
                    <p>Tên tài khoản: <span className="font-bold">CONG TY CO PHAN CANG SAI GON</span></p>
                    <p>Số tài khoản: <span className="font-bold text-indigo-700">8608393979</span></p>
                  </div>
                  <div className="w-28 h-28 border border-slate-200 p-1 bg-white">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=STK:8608393979|NH:BIDV|CT:${grandTotal}`} alt="QR Code" className="w-full h-full object-contain" />
                  </div>
                </div>

                <p className="mt-8 text-[8pt] italic text-gray-400 text-center uppercase tracking-widest">Cảm ơn Quý khách đã tin tưởng sử dụng dịch vụ của Cảng Tân Thuận</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import Preview Modal */}
      <AnimatePresence>
        {showImportPreviewModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-100">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Xem trước dữ liệu Import</h2>
                    <p className="text-xs text-slate-500 font-medium">Kiểm tra lại các phương án trước khi thêm vào báo giá</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const templateData = [
                        ['Tên dịch vụ', 'ĐVT', 'Số lượng', 'Đơn giá', 'Ghi chú'],
                        ['Cước vận chuyển', 'cont', 1, 2000000, 'Tuyến HCM - HP'],
                        ['Phí nâng hạ', 'cont', 1, 500000, 'Nâng hạ bãi'],
                        ['Phí lưu bãi', 'ngày', 5, 100000, 'Lưu bãi 5 ngày']
                      ];
                      const ws = XLSX.utils.aoa_to_sheet(templateData);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Template");
                      XLSX.writeFile(wb, "Template_Bao_Gia.xlsx");
                    }}
                    className="text-[10px] bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-all text-slate-600 font-bold uppercase tracking-widest shadow-sm"
                  >
                    Tải file mẫu
                  </button>
                  <button onClick={() => setShowImportPreviewModal(false)} className="text-slate-400 hover:text-slate-600 p-2"><X className="w-6 h-6" /></button>
                </div>
              </div>

              <div className="p-8 overflow-y-auto flex-1">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                      <th className="py-4 px-4 w-12 text-center">STT</th>
                      <th className="py-4 px-4">Phương án</th>
                      <th className="py-4 px-4 w-24 text-center">ĐVT</th>
                      <th className="py-4 px-4 w-24 text-center">Số lượng</th>
                      <th className="py-4 px-4 w-32 text-right">Đơn giá</th>
                      <th className="py-4 px-4 w-32 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {importPreviewItems.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4 text-center text-slate-300 font-mono text-xs">{i + 1}</td>
                        <td className="py-4 px-4 font-bold text-slate-700">{item.name}</td>
                        <td className="py-4 px-4 text-center text-slate-500">{item.unit}</td>
                        <td className="py-4 px-4 text-center font-black text-slate-800">{item.quantity}</td>
                        <td className="py-4 px-4 text-right text-slate-500">{item.price.toLocaleString()} đ</td>
                        <td className="py-4 px-4 text-right font-black text-indigo-600">{item.total.toLocaleString()} đ</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-50/30 font-bold">
                      <td colSpan={5} className="py-6 px-4 text-right uppercase text-[10px] tracking-widest text-slate-400">Tổng cộng import:</td>
                      <td className="py-6 px-4 text-right text-xl font-black text-indigo-600">
                        {importPreviewItems.reduce((sum, item) => sum + item.total, 0).toLocaleString()} đ
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-4">
                <button onClick={() => setShowImportPreviewModal(false)} className="px-8 py-3 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-all uppercase tracking-widest">Hủy bỏ</button>
                <button onClick={confirmImport} className="px-10 py-3 rounded-2xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100 transition-all flex items-center gap-2 uppercase tracking-widest">
                  <Check className="w-4 h-4" /> Xác nhận thêm vào báo giá
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tariff Modal */}
      <AnimatePresence>
        {showTariffModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Quản lý phương án (Tariff)</h2>
                <button onClick={() => setShowTariffModal(false)} className="text-slate-400 hover:text-slate-600 p-2"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                <div className="flex flex-wrap gap-4">
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-emerald-100 uppercase tracking-widest">
                    <Download className="w-4 h-4" /> Import Excel
                  </button>
                  <button onClick={() => {
                    const ws = XLSX.utils.json_to_sheet(products);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Tariff");
                    XLSX.writeFile(wb, "Tariff_Export.xlsx");
                  }} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-slate-200 uppercase tracking-widest">
                    <FileSpreadsheet className="w-4 h-4" /> Export Excel
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />
                </div>

                <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 shadow-inner">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-2">Tên dịch vụ</label>
                      <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="Ví dụ: Cước vận chuyển..." className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-2">ĐVT</label>
                      <input type="text" value={newProdUnit} onChange={e => setNewProdUnit(e.target.value)} placeholder="Ví dụ: cont, chuyến..." className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-2">Đơn giá</label>
                      <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                    </div>
                  </div>
                  <button onClick={() => {
                    const priceNum = parseFloat(newProdPrice);
                    if (newProdName && newProdUnit) {
                      const updated = [...products, { name: newProdName, unit: newProdUnit, price: priceNum || 0 }];
                      setProducts(updated);
                      localStorage.setItem('quotation_products', JSON.stringify(updated));
                      setNewProdName('');
                      setNewProdUnit('');
                      setNewProdPrice('');
                    }
                  }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl transition-all shadow-xl shadow-indigo-100 text-xs uppercase tracking-widest">Lưu phương án</button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                        <th className="py-4 px-6">Tên phương án</th>
                        <th className="py-4 px-6 w-24 text-center">ĐVT</th>
                        <th className="py-4 px-6 w-32 text-right">Đơn giá</th>
                        <th className="py-4 px-6 w-24 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {products.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-700">{p.name}</td>
                          <td className="py-4 px-6 text-center text-slate-500">{p.unit}</td>
                          <td className="py-4 px-6 text-right font-black text-indigo-600">{p.price.toLocaleString()} đ</td>
                          <td className="py-4 px-6 text-center">
                            <button onClick={() => {
                              const updated = products.filter((_, idx) => idx !== i);
                              setProducts(updated);
                              localStorage.setItem('quotation_products', JSON.stringify(updated));
                            }} className="text-slate-300 hover:text-rose-500 p-2 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <datalist id="products-list">
        {products.map((p, i) => <option key={i} value={p.name} />)}
      </datalist>
    </div>
  );
}
