import React from 'react';
import {
  LayoutDashboard, Calculator, FileText, Users, Settings,
  LogOut, LogIn, ChevronLeft, ChevronRight,
  Package, History, GitCompare, ClipboardList, X, Globe
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import * as S from '../styles/Sidebar.styles';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  user: any;
  onLogout: () => void;
  onLoginClick?: () => void;
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab, setActiveTab, collapsed, setCollapsed,
  user, onLogout, onLoginClick, isMobile, isOpen, onClose
}) => {
  const { t } = useTranslation();
  const currentLang = i18n.language === 'en' ? 'EN' : 'VI';
  const toggleLang = () => i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi');

  const role = (user?.role as string) || 'guest';
  const allMenuItems = [
    { id: 'dashboard',     label: t('nav.dashboard'),     icon: LayoutDashboard },
    { id: 'calculator',    label: t('nav.calculator'),    icon: Calculator },
    { id: 'quotation',     label: t('nav.quotation'),     icon: FileText },
    { id: 'registration',  label: t('nav.registration'),  icon: ClipboardList },
    { id: 'customers',     label: t('nav.customers'),     icon: Users,     hideFor: ['guest'] },
    { id: 'services',      label: t('nav.services'),      icon: Package },
    { id: 'history',       label: t('nav.history'),       icon: History,   hideFor: ['guest'] },
    { id: 'reconciliation',label: t('nav.reconciliation'),icon: GitCompare },
    ...(user && role === 'admin' ? [{ id: 'admin', label: t('nav.admin'), icon: Settings }] : []),
  ];
  const menuItems = allMenuItems.filter(
    (item) => !('hideFor' in item) || !(item.hideFor as string[]).includes(role)
  );

  return (
    <>
    {isMobile && isOpen && <div className={S.backdrop} onClick={onClose} />}
    <div className={cn(
      S.sidebarBase,
      isMobile
        ? (isOpen ? S.sidebarMobileOpen : S.sidebarMobileClosed)
        : (collapsed ? S.sidebarCollapsed : S.sidebarExpanded)
    )}>

      {/* Logo */}
      <div className={S.logoSection}>
        {(!collapsed || isMobile) && (
          <div className={S.logoRow}>
            <div className={S.logoIconBox}><Calculator className={S.logoIcon} /></div>
            <div className={S.logoTextCol}>
              <span className={S.logoTitle}>TAN THUAN</span>
              <span className={S.logoSubtitle}>TienNM-Container Manager</span>
            </div>
          </div>
        )}
        {collapsed && !isMobile && (
          <div className={S.logoCollapsed}><Calculator className={S.logoIcon} /></div>
        )}
        {isMobile && (
          <button onClick={onClose} className={S.closeBtnMobile}><X className={S.closeIcon} /></button>
        )}
      </div>

      {/* Navigation */}
      <nav className={S.nav}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(S.navBtnBase, activeTab === item.id ? S.navBtnActive : S.navBtnIdle)}
          >
            <item.icon className={cn(S.navIconBase, activeTab === item.id ? S.navIconActive : S.navIconIdle)} />
            {(!collapsed || isMobile) && <span className={S.navLabel}>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className={S.footer}>
        {user ? (
          <div className={cn(S.userCardBase, collapsed && S.userCardCollapsed)}>
            <img
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}`}
              alt="Avatar" className={S.avatar}
            />
            {(!collapsed || isMobile) && (
              <div className={S.userInfo}>
                <p className={S.userName}>{user.displayName || 'User'}</p>
                <p className={S.userEmail}>{user.email}</p>
              </div>
            )}
            {(!collapsed || isMobile) && (
              <button onClick={onLogout} className={S.logoutBtn}><LogOut className={S.logoutIcon} /></button>
            )}
          </div>
        ) : (
          <button onClick={onLoginClick} className={cn(S.loginBtnBase, collapsed && S.loginBtnCollapsed)} title="Đăng nhập">
            <LogIn className={S.loginIcon} />
            {(!collapsed || isMobile) && <span className={S.loginLabel}>Đăng nhập</span>}
          </button>
        )}

      { /* <button onClick={toggleLang} className={cn(S.langBtn, collapsed && S.langBtnCollapsed)} title="Switch language">
          <Globe className={S.langIcon} />
          {(!collapsed || isMobile) && <span>{currentLang}</span>}
        </button>*/}

        {!isMobile && (
          <button onClick={() => setCollapsed(!collapsed)} className={S.collapseBtn}>
            {collapsed ? <ChevronRight className={S.collapseIcon} /> : <ChevronLeft className={S.collapseIcon} />}
          </button>
        )}
      </div>
    </div>
    </>
  );
};

export default Sidebar;
