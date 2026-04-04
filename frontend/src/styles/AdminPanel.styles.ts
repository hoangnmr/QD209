import {
  pageWrapper, pageSubtitle, labelSm,
  pageTitleUppercase, headerCol as _headerCol,
  sectionTitle, cardLgOverflow, inputLgBold,
  fieldGroup as _fieldGroup, btnIconDanger,
} from './shared';

// ─── Page ───────────────────────────────────────────────────────────────────
export const wrapper = pageWrapper;
export const headerCol = _headerCol;
export const title = pageTitleUppercase;
export const subtitle = pageSubtitle;

// ─── Error Banner ───────────────────────────────────────────────────────────
export const errorBanner =
  "bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-lg flex items-center gap-2 text-rose-700";
export const errorText = "text-sm font-bold";

// ─── Section Card ───────────────────────────────────────────────────────────
export const sectionCard = cardLgOverflow;
export const sectionHeader =
  "bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center gap-5 overflow-x-auto";
export const sectionIcon = "bg-indigo-600 p-1.5 rounded-md text-white flex-shrink-0";
export const tabRow = "flex gap-5 whitespace-nowrap";
export const tab = (active: boolean) =>
  `font-black uppercase tracking-widest text-xs transition-all pb-1.5 ${active ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"}`;
export const sectionBody = "p-5";

// ─── Prices Tab ─────────────────────────────────────────────────────────────
export const pricesSpace = "space-y-4";
export const pricesHeaderRow = "flex items-center justify-between";
export const pricesSectionTitle = "text-sm font-bold text-slate-500 uppercase tracking-widest";
export const syncRow = "flex items-center gap-2";
export const syncMsg = "text-xs font-bold text-indigo-600";
export const syncBtn =
  "flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-indigo-600 font-bold py-1.5 px-3 rounded-lg text-xs transition-all disabled:opacity-50";
export const priceForm = "grid grid-cols-1 md:grid-cols-4 gap-4 items-end";

// ─── Form Fields (shared across tabs) ───────────────────────────────────────
export const fieldGroup = _fieldGroup;
export const label = labelSm;
export const input = inputLgBold;
export const submitBtn =
  "w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-lg transition-all shadow-sm disabled:opacity-50";

// ─── Stats Table ────────────────────────────────────────────────────────────
export const statsWrapper = "mt-6 space-y-3";
export const statsHeaderRow = "flex justify-between items-end border-b border-slate-200 pb-3";
export const statsTitle = sectionTitle;
export const statsSubtitle = "text-sm text-slate-500 mt-1";
export const excelBtn =
  "flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold py-2 px-4 rounded-lg text-sm transition-all";
export const tableCard =
  "bg-white border border-slate-200 rounded-lg overflow-hidden overflow-x-auto shadow-sm";
export const table = "w-full text-left text-sm whitespace-nowrap";
export const thead = "bg-slate-50/80 border-b border-slate-200";
export const thBase = "px-4 py-2.5 font-black uppercase tracking-wider text-[11px]";
export const thSlate = `${thBase} text-slate-500`;
export const thIndigo = `${thBase} text-indigo-600 text-right`;
export const thIndigoCenter = `${thBase} text-indigo-600 text-center`;
export const thRose = `${thBase} text-rose-500 text-right`;
export const thOrange = `${thBase} text-orange-500 text-right`;
export const thSlateCenter = `${thBase} text-slate-400 text-center`;
export const tbody = "divide-y divide-slate-100";
export const row = "hover:bg-slate-50/50 transition";
export const tdDate = "px-4 py-2.5 font-bold text-slate-700";
export const tdPrice = "px-4 py-2.5 font-bold text-indigo-600 text-right";
export const tdDeltaCenter = "px-4 py-2.5 font-bold text-center";
export const deltaUp = "text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded text-[11px]";
export const deltaDown = "text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]";
export const deltaNone = "text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded text-[11px]";
export const tdRose = "px-4 py-2.5 font-bold text-rose-500 text-right bg-rose-50/30";
export const tdOrange = "px-4 py-2.5 font-bold text-orange-500 text-right bg-orange-50/30";
export const tdActionCenter = "px-4 py-2.5 text-center";
export const deleteIconBtn = btnIconDanger;

// ─── Edit / Publish buttons ─────────────────────────────────────────────────
export const editIconBtn =
  "p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all";
export const pinIconBtn =
  "p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all";
export const pinActiveBtn =
  "p-1.5 rounded-md text-amber-500 bg-amber-50 hover:text-amber-700 hover:bg-amber-100 transition-all";
export const publishedBadge =
  "ml-2 inline-flex items-center text-[10px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full";
export const inlineEditInput =
  "w-28 bg-white border border-indigo-300 rounded px-2 py-1 text-right text-sm font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";
export const inlineEditSaveBtn =
  "p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-all";
export const inlineEditCancelBtn =
  "p-1 rounded text-slate-400 hover:bg-slate-100 transition-all";

export const emptyRow = "px-4 py-6 text-center text-slate-400 font-medium";

// ─── Expand / Tier badge ─────────────────────────────────────────────────────
export const tdExpandIcon = "px-2 py-2.5 w-8 text-center";
export const tdTierCenter = "px-4 py-2.5 text-center";
export const tierBadge =
  "inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-600";

// ─── Expanded Detail Row ──────────────────────────────────────────────────────
export const expandedRow = "bg-slate-50/60";
export const expandedCell = "px-4 py-3";
export const expandedGrid = "grid grid-cols-2 gap-4 max-w-lg ml-10";
export const expandedSection = "space-y-1.5";
export const expandedSectionTitle = "text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1";
export const expandedDetailRow = "flex items-center justify-between text-sm";
export const expandedLabel = "text-slate-500 font-medium";
export const expandedValueRose = "font-bold text-rose-600";
export const expandedValueOrange = "font-bold text-orange-500";

// ─── Tiers Tab ──────────────────────────────────────────────────────────────
export const tierForm = "space-y-5";
export const tierGrid2 = "grid grid-cols-1 md:grid-cols-2 gap-4";
export const tierGrid4 = "grid grid-cols-2 md:grid-cols-4 gap-4";
export const tierSubmitRow = "flex justify-end";
export const tierSubmitBtn =
  "flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all shadow-sm disabled:opacity-50";

// ─── Bulk Tiers Tab ─────────────────────────────────────────────────────────
export const bulkGrid3 = "grid grid-cols-1 md:grid-cols-3 gap-4";

// ─── Backup Tab ─────────────────────────────────────────────────────────────
export const backupSpace = "space-y-5";
export const warningBox =
  "bg-amber-50 rounded-lg p-4 border border-amber-100 flex gap-3";
export const warningTitle = "font-bold text-slate-800";
export const warningText = "text-sm text-slate-600 mt-1 leading-relaxed";
export const backupGrid = "grid grid-cols-1 md:grid-cols-2 gap-4";
export const backupCard =
  "bg-slate-50 rounded-lg border border-slate-200 p-5 text-center flex flex-col items-center";
export const backupIconIndigo = "bg-indigo-100 p-3 rounded-full mb-3 text-indigo-600";
export const backupIconRose = "bg-rose-100 p-3 rounded-full mb-3 text-rose-600";
export const backupCardTitle = "font-bold text-slate-800 text-base";
export const backupCardText = "text-sm text-slate-500 mt-1.5 mb-4";
export const exportBackupBtn =
  "w-full bg-white hover:bg-slate-100 border border-slate-200 text-indigo-600 font-bold py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2";
export const importBackupBtn =
  "w-full bg-rose-50 text-rose-600 font-bold py-2.5 hover:bg-rose-100 rounded-lg transition-all border border-rose-200 shadow-sm flex items-center justify-center gap-2";

// ─── Fallback Tab ───────────────────────────────────────────────────────────
export const fallbackSpace = "space-y-4 max-w-xl";
export const fallbackWarning =
  "bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg flex items-start gap-3 text-amber-800";
export const fallbackWarningTitle = "font-bold";
export const fallbackWarningText = "text-sm mt-1";
export const fallbackForm =
  "grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200";
export const fallbackLabel = "text-xs font-bold text-slate-500 uppercase tracking-widest flex gap-1";
export const fallbackInput =
  "w-full bg-white border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-700";
export const fallbackSubmitRow = "md:col-span-2 flex flex-col gap-2 pt-1";
export const fallbackSubmitBtn =
  "w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-6 rounded-lg transition-all shadow-sm";
export const fallbackMsg = (ok: boolean) =>
  `font-bold text-sm ${ok ? "text-emerald-600" : "text-rose-600"}`;

// ─── Audit Tab ──────────────────────────────────────────────────────────────
export const auditSpace = "space-y-4";
export const auditTitle = "font-bold text-slate-800 text-base flex items-center gap-2";
export const auditCard =
  "bg-slate-50 border border-slate-200 rounded-lg overflow-hidden max-h-[600px] overflow-y-auto";
export const auditTable = "w-full text-left text-sm whitespace-nowrap";
export const auditThead = "bg-slate-100/50 sticky top-0";
export const auditTh = "px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[11px]";
export const auditTbody = "divide-y divide-slate-100 bg-white";
export const auditRow = "hover:bg-slate-50/50";
export const auditTdTime = "px-4 py-2.5 font-medium text-slate-600";
export const auditTdAction = "px-4 py-2.5 font-bold text-indigo-600";
export const auditTdDetail = "px-4 py-2.5 text-slate-600 truncate max-w-sm";
export const auditEmpty = "px-4 py-6 text-center font-medium text-slate-400";
