import React, { useState, useEffect } from "react";
import { AlertCircle, RefreshCw, Lock, X, LogOut } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import SurchargeCalculator from "./components/SurchargeCalculator";
import CustomerList from "./components/CustomerList";
import ServiceCatalog from "./components/ServiceCatalog";
import AdminPanel from "./components/AdminPanel";
import History from "./components/History";
import QuotationModule from "./components/QuotationModule";
import ReconciliationModule from "./components/ReconciliationModule";
import ServiceRegistrationModule from "./components/ServiceRegistrationModule";
import { useAppContext } from "./context/AppContext";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE } from "./lib/apiBase";
import * as S from "./styles/App.styles";
import { motionFadeIn, motionScaleIn } from "./styles/shared";

export default function App() {
  const {
    isAdminMode, setIsAdminMode, userRole, setUserRole, userDisplayName, setUserDisplayName,
    loading, error,
    setPendingSurcharge, setPendingCustomer
  } = useAppContext();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "calculator" | "quotation" | "registration" | "customers" | "services" | "history" | "admin" | "reconciliation">("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setIsMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setIsAdminMode(true);
        setUserRole(json.role || null);
        setUserDisplayName(json.displayName || json.username || loginUsername);
        sessionStorage.setItem("logipro_token", json.token);
        setShowLoginModal(false);
        setLoginUsername("");
        setLoginPassword("");
      } else {
        setLoginError(json.message || "Tên đăng nhập hoặc mật khẩu không đúng.");
      }
    } catch {
      setLoginError("Không kết nối được server. Vui lòng thử lại.");
    }
  };

  const handleLogout = () => {
    setIsAdminMode(false);
    setUserRole(null);
    setUserDisplayName('');
    sessionStorage.removeItem("logipro_token");
    if (activeTab === "admin") setActiveTab("dashboard");
  };

  const handleAddToQuotation = (surcharge: { amount: number; quantity: number; cargoType: string }) => {
    setPendingSurcharge(surcharge);
    setActiveTab("quotation");
  };

  const handleCustomerToQuote = (customer: any) => {
    setPendingCustomer(customer);
    setActiveTab("quotation");
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className={S.loadingWrapper}>
          <RefreshCw className={S.loadingIcon} />
          <p className={S.loadingText}>Đang tải dữ liệu hệ thống...</p>
        </div>
      );
    }

    if (error && activeTab !== "admin") {
      return (
        <div className={S.errorWrapper}>
          <AlertCircle className={S.errorIcon} />
          <p className={S.errorText}>{error}</p>
        </div>
      );
    }

    switch (activeTab) {
      case "dashboard":    return <Dashboard />;
      case "calculator":   return <SurchargeCalculator onAddToQuotation={handleAddToQuotation} />;
      case "quotation":    return <QuotationModule />;
      case "customers":    return isAdminMode && userRole !== 'guest' ? <CustomerList onCustomerToQuote={handleCustomerToQuote} /> : <Dashboard />;
      case "services":     return <ServiceCatalog />;
      case "history":      return isAdminMode && userRole !== 'guest' ? <History /> : <Dashboard />;
      case "reconciliation": return <ReconciliationModule />;
      case "registration": return <ServiceRegistrationModule />;
      case "admin":        return isAdminMode && userRole === 'admin' ? <AdminPanel /> : <Dashboard />;
      default:             return <Dashboard />;
    }
  };

  return (
    <div className={S.root}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); if (isMobile) setIsMobileMenuOpen(false); }}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        user={isAdminMode ? { displayName: userDisplayName || 'User', email: `${userRole}@local`, role: userRole } : null}
        onLogout={handleLogout}
        onLoginClick={() => setShowLoginModal(true)}
        isMobile={isMobile}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <div className={S.mainColumn}>
        {isMobile && (
          <header className={S.mobileHeader}>
            <div className={S.mobileHeaderLeft}>
              <button onClick={() => setIsMobileMenuOpen(true)} className={S.hamburgerBtn}>
                <div className={S.hamburgerLines}>
                  <span className={S.hamburgerLine} />
                  <span className={S.hamburgerLine} />
                  <span className={S.hamburgerLine} />
                </div>
              </button>
              <span className={S.mobileTitle}>TAN THUAN</span>
            </div>
            {isAdminMode
              ? <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span className={S.adminBadge}>{userDisplayName || 'Admin'}</span>
                  <button onClick={handleLogout} style={{cursor:'pointer',background:'#dc2626',color:'#fff',fontWeight:600,border:'none',borderRadius:6,padding:'4px 10px',fontSize:12,display:'flex',alignItems:'center',gap:4}}><LogOut style={{width:14,height:14}} /> Thoat</button>
                </div>
              : <button onClick={() => setShowLoginModal(true)} style={{cursor:'pointer',background:'#ea580c',color:'#fff',fontWeight:600,border:'none',borderRadius:6,padding:'4px 12px',fontSize:13}}>Dang nhap</button>
            }
          </header>
        )}

        <main className={S.mainContent}>{renderContent()}</main>
      </div>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div {...motionFadeIn} className={S.loginBackdrop}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={S.loginPanel}
            >
              <div className={S.loginHeader}>
                <div className={S.loginHeaderLeft}>
                  <div className={S.loginIconBox}><Lock className="w-5 h-5" /></div>
                  <h3 className={S.loginTitle}>Đăng nhập Quản trị</h3>
                </div>
                <button onClick={() => setShowLoginModal(false)} className={S.loginCloseBtn}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleLoginSubmit} className={S.loginForm}>
                {loginError && (
                  <div className={S.loginError}><AlertCircle className="w-4 h-4" />{loginError}</div>
                )}
                <div className={S.loginFieldGroup}>
                  <label className={S.loginLabel}>Tên đăng nhập</label>
                  <input type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className={S.loginInput} placeholder="admin" />
                </div>
                <div className={S.loginFieldGroup}>
                  <label className={S.loginLabel}>Mật khẩu</label>
                  <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className={S.loginInput} placeholder="••••••••" />
                </div>
                <button type="submit" className={S.loginSubmit}>Truy cập</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
