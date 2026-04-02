// ─── Root Container ─────────────────────────────────────────────────────────
export const sidebarBase =
  "h-screen bg-slate-900 text-white transition-all duration-300 flex flex-col border-r border-slate-800 z-50";
export const sidebarMobileOpen = "fixed inset-y-0 left-0 w-72 translate-x-0";
export const sidebarMobileClosed = "fixed inset-y-0 left-0 w-72 -translate-x-full";
export const sidebarExpanded = "w-64";
export const sidebarCollapsed = "w-20";

// ─── Backdrop ───────────────────────────────────────────────────────────────
export const backdrop = "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40";

// ─── Logo Section ───────────────────────────────────────────────────────────
export const logoSection = "p-4 flex items-center justify-between";
export const logoRow = "flex items-center gap-3";
export const logoIconBox = "bg-indigo-600 p-2 rounded-md";
export const logoIcon = "w-6 h-6 text-white";
export const logoTextCol = "flex flex-col";
export const logoTitle = "font-bold text-lg tracking-tight";
export const logoSubtitle = "text-[10px] text-slate-400 font-medium tracking-wide";
export const logoCollapsed = "bg-indigo-600 p-2 rounded-md mx-auto";
export const closeBtnMobile = "p-2 text-slate-400 hover:text-white transition-colors";
export const closeIcon = "w-6 h-6";

// ─── Navigation ─────────────────────────────────────────────────────────────
export const nav = "flex-1 px-3 space-y-1 mt-3";
export const navBtnBase = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group";
export const navBtnActive = "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20";
export const navBtnIdle = "text-slate-400 hover:bg-slate-800 hover:text-white";
export const navIconBase = "w-5 h-5 flex-shrink-0";
export const navIconActive = "text-white";
export const navIconIdle = "group-hover:text-white";
export const navLabel = "font-medium text-sm";

// ─── Footer / User Section ──────────────────────────────────────────────────
export const footer = "p-3 border-t border-slate-800";
export const userCardBase = "flex items-center gap-3 p-2 rounded-lg bg-slate-800/50";
export const userCardCollapsed = "justify-center";
export const avatar = "w-8 h-8 rounded-full border border-slate-700";
export const userInfo = "flex-1 min-w-0";
export const userName = "text-xs font-bold truncate";
export const userEmail = "text-[10px] text-slate-500 truncate";
export const logoutBtn = "text-slate-500 hover:text-rose-400 transition-colors";
export const logoutIcon = "w-4 h-4";

// ─── Login Button (guest) ───────────────────────────────────────────────────
export const loginBtnBase =
  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all group";
export const loginBtnCollapsed = "justify-center";
export const loginIcon = "w-5 h-5 group-hover:text-white";
export const loginLabel = "font-medium text-sm text-left";

// ─── Language Toggle ────────────────────────────────────────────────────────
export const langBtn =
  "mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all text-xs font-bold";
export const langBtnCollapsed = "justify-center";
export const langIcon = "w-4 h-4 flex-shrink-0";

// ─── Collapse Toggle ────────────────────────────────────────────────────────
export const collapseBtn =
  "mt-2 w-full flex items-center justify-center p-2 text-slate-500 hover:text-white transition-colors";
export const collapseIcon = "w-5 h-5";
