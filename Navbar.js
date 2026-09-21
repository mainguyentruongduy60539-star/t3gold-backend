'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '@/config/api';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [theme, setTheme] = useState('system');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }

    // Auto-sync user role and approval state with server
    const fetchLatestUser = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${storedToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));

            if (data.user.role === 'admin' || data.user.role === 'staff_admin') {
              fetchPendingCount(storedToken);
            }
          }
        }
      } catch (e) {
        console.error('Error auto-syncing Navbar user state:', e);
      }
    };

    const fetchPendingCount = async (authToken) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/members`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
          const membersList = await res.json();
          const pCount = membersList.filter(m => m.status === 'pending' || (m.role === 'member' && !m.isApproved)).length;
          setPendingCount(pCount);
        }
      } catch (err) {
        console.error('Error fetching pending members count:', err);
      }
    };

    fetchLatestUser();
    const syncInterval = setInterval(fetchLatestUser, 30000);

    // Load theme preference
    const savedTheme = localStorage.getItem('theme') || 'system';
    setTheme(savedTheme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (localStorage.getItem('theme') === 'system' || !localStorage.getItem('theme')) {
        const root = document.documentElement;
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => {
      clearInterval(syncInterval);
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  // Scroll, Hash, and Route active section tracking
  useEffect(() => {
    if (pathname !== '/') {
      setActiveSection('');
      return;
    }

    let prevSection = '';
    const updateActiveSection = () => {
      const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';

      if (hash === 'lien-he') {
        if (prevSection !== 'lien-he') {
          prevSection = 'lien-he';
          setActiveSection('lien-he');
        }
        return;
      }

      const lienHeSec = document.getElementById('lien-he');
      const scrollPos = window.scrollY + 150;

      const nextSection = (lienHeSec && scrollPos >= lienHeSec.offsetTop) ? 'lien-he' : 'top';
      if (nextSection !== prevSection) {
        prevSection = nextSection;
        setActiveSection(nextSection);
      }
    };

    updateActiveSection();

    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('hashchange', updateActiveSection);
    window.addEventListener('popstate', updateActiveSection);

    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('hashchange', updateActiveSection);
      window.removeEventListener('popstate', updateActiveSection);
    };
  }, [pathname]);

  // Close mobile drawer on route change, Escape key, or desktop resize
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setShowThemeMenu(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setShowThemeMenu(false);
      }
    };
    const handleResize = () => {
      if (window.innerWidth > 991) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobileMenuOpen]);

  const applyTheme = (t) => {
    const root = document.documentElement;
    if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
    setShowThemeMenu(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/';
  };

  // Normalize pathname to strip trailing slashes (except root '/')
  const normalizedPath = (pathname || '/').replace(/\/+$/, '') || '/';

  // Active States
  const isTrangChuActive = normalizedPath === '/';
  const isTinhNangActive = normalizedPath === '/tinh-nang' || normalizedPath.startsWith('/tinh-nang/');
  const isPhanMemActive = normalizedPath === '/cac-goi-phan-mem' || normalizedPath.startsWith('/cac-goi-phan-mem/');
  const isLienHeActive = normalizedPath === '/lien-he' || normalizedPath.startsWith('/lien-he/');

  // Dynamic Gold Price URL with SSO for Logged-In T3Gold Users
  const goldPriceUrl = user
    ? `https://cap-nhat-bang-gia-t3-gold.vercel.app/?sso=true&user=${encodeURIComponent(user.name || 'Thành viên T3Gold')}`
    : 'https://cap-nhat-bang-gia-t3-gold.vercel.app/';

  const handleLogoClick = (e) => {
    setIsMobileMenuOpen(false);
    if (pathname === '/') {
      if (typeof window !== 'undefined' && window.scrollY > 30) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.location.href = '/';
      }
    } else {
      window.location.href = '/';
    }
  };

  const handleHomeClick = (e) => {
    setIsMobileMenuOpen(false);
    if (pathname === '/') {
      if (typeof window !== 'undefined' && window.scrollY > 30) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <>
      <nav className={`main-navbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container nav-container">
        {/* LOGO */}
        <a href="/" className="nav-logo" onClick={handleLogoClick} title="Về trang chủ T3Gold">
          <img src="/navbar-logo.png" alt="T3Gold Logo" className="logo-img" />
        </a>

        {/* DESKTOP NAV LINKS */}
        <ul className="nav-links desktop-only">
          <li>
            <Link
              href="/"
              className={isTrangChuActive ? 'active' : ''}
              aria-current={isTrangChuActive ? 'page' : undefined}
              onClick={handleHomeClick}
            >
              Trang chủ
            </Link>
          </li>
          <li>
            <Link
              href="/tinh-nang"
              className={isTinhNangActive ? 'active' : ''}
              aria-current={isTinhNangActive ? 'page' : undefined}
            >
              Tính năng
            </Link>
          </li>
          <li>
            <Link
              href="/cac-goi-phan-mem"
              className={isPhanMemActive ? 'active' : ''}
              aria-current={isPhanMemActive ? 'page' : undefined}
            >
              Phần mềm
            </Link>
          </li>
          <li>
            <Link
              href="/lien-he"
              className={isLienHeActive ? 'active' : ''}
              aria-current={isLienHeActive ? 'page' : undefined}
            >
              Liên hệ
            </Link>
          </li>
          <li>
            <a
              href={goldPriceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gold-price-nav-link"
              title="Xem bảng giá vàng SJC, 9999, 18K cập nhật mới nhất"
            >
              <span className="gold-price-badge">🏆 Giá vàng hôm nay</span>
            </a>
          </li>
        </ul>

        {/* DESKTOP ACTIONS */}
        <div className="nav-actions desktop-only">
          {user ? (
            <div className="user-profile-menu">
              <span className="welcome-text">
                Chào, <strong className="text-gradient">{user.name ? user.name.split(' ').pop() : 'Thành viên'}</strong>
              </span>

              {(user.role === 'admin' || user.role === 'shareholder' || user.role === 'staff_admin' || user.role === 'manager' || user.role === 'staff') && (
                <Link
                  href="/so-do-to-chuc"
                  className="btn-sm user-dashboard-btn"
                  title={user.role === 'manager' ? 'Xem sơ đồ tổ chức bộ phận' : 'Xem sơ đồ bộ máy tổ chức'}
                  style={{
                    padding: '7px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    zIndex: 10,
                    pointerEvents: 'auto',
                    background: pathname === '/so-do-to-chuc' ? 'linear-gradient(135deg, #f59e0b, #dca018)' : 'linear-gradient(135deg, #1e293b, #0f172a)',
                    color: pathname === '/so-do-to-chuc' ? '#000000' : '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    boxShadow: pathname === '/so-do-to-chuc' ? '0 0 12px rgba(245, 158, 11, 0.4)' : 'none'
                  }}
                >
                  {(user.role === 'manager' || user.role === 'staff') ? '📁 Trang Quản Lý' : '⚙️ Bộ Máy Tổ Chức'}
                </Link>
              )}

              <Link
                href={
                  (user.role === 'admin' || user.role === 'staff_admin')
                    ? '/admin'
                    : '/dashboard'
                }
                className="btn-sm user-dashboard-btn"
                title={`Vai trò & Quyền: ${user.name}`}
                style={{
                  padding: '7px 14px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  zIndex: 10,
                  pointerEvents: 'auto',
                  background: (pathname === '/dashboard' || pathname === '/admin') ? 'linear-gradient(135deg, #f59e0b, #dca018)' : 'linear-gradient(135deg, #1e293b, #0f172a)',
                  color: (pathname === '/dashboard' || pathname === '/admin') ? '#000000' : '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  boxShadow: (pathname === '/dashboard' || pathname === '/admin') ? '0 0 12px rgba(245, 158, 11, 0.4)' : 'none'
                }}
              >
                {user.role === 'admin' && '👑 Admin Tối Cao'}
                {user.role === 'staff_admin' && '👑 Thành Viên Quản Trị'}
                {user.role === 'shareholder' && '💼 Cổ Đông'}
                {user.role === 'manager' && '📁 Quản Lý Bộ Phận'}
                {user.role === 'staff' && '👨‍💻 Nhân Sự Cấp Dưới'}
                {user.role === 'member' && '👤 Thành Viên Tiệm Vàng'}
                {(user.role === 'admin' || user.role === 'staff_admin') && pendingCount > 0 && (
                  <span
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 900,
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 10px rgba(239, 68, 68, 0.8)',
                      border: '2px solid #06373a',
                      marginLeft: '6px'
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>

              <button onClick={handleLogout} className="btn-logout">
                Đăng xuất
              </button>
            </div>
          ) : (
            <>
              <Link href="/login" className="btn-login-link">Đăng nhập</Link>
              <Link href="/register" className="btn-gold">Đăng ký dùng thử</Link>
            </>
          )}

          <div className="theme-switcher-container">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="theme-switcher-btn"
              aria-label="Chọn giao diện"
            >
              {theme === 'light' && '☀️'}
              {theme === 'dark' && '🌙'}
              {theme === 'system' && '💻'}
            </button>
            {showThemeMenu && (
              <ul className="theme-dropdown-menu">
                <li className={theme === 'light' ? 'active' : ''} onClick={() => handleThemeChange('light')}>☀️ Sáng</li>
                <li className={theme === 'dark' ? 'active' : ''} onClick={() => handleThemeChange('dark')}>🌙 Tối</li>
                <li className={theme === 'system' ? 'active' : ''} onClick={() => handleThemeChange('system')}>💻 Hệ thống</li>
              </ul>
            )}
          </div>
        </div>

        {/* MOBILE COMPACT HEADER CONTROLS */}
        <div className="mobile-header-controls mobile-only">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="theme-switcher-btn mobile-theme-btn"
            aria-label="Chọn giao diện"
          >
            {theme === 'light' && '☀️'}
            {theme === 'dark' && '🌙'}
            {theme === 'system' && '💻'}
          </button>
          {showThemeMenu && (
            <ul className="theme-dropdown-menu mobile-header-theme-dropdown">
              <li className={theme === 'light' ? 'active' : ''} onClick={() => handleThemeChange('light')}>☀️ Sáng</li>
              <li className={theme === 'dark' ? 'active' : ''} onClick={() => handleThemeChange('dark')}>🌙 Tối</li>
              <li className={theme === 'system' ? 'active' : ''} onClick={() => handleThemeChange('system')}>💻 Hệ thống</li>
            </ul>
          )}

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="mobile-hamburger-btn"
            aria-label={isMobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu-drawer"
          >
            <div className={`hamburger-lines ${isMobileMenuOpen ? 'open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </button>
        </div>
      </div>

      {/* MOBILE MENU BACKDROP */}
      {isMobileMenuOpen && (
        <div
          className="mobile-menu-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* MOBILE MENU DRAWER */}
      <div
        id="mobile-menu-drawer"
        className={`mobile-menu-drawer ${isMobileMenuOpen ? 'is-open' : ''}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="mobile-drawer-content">
          <ul className="mobile-nav-list">
            <li>
              <Link
                href="/"
                className={`mobile-nav-link ${isTrangChuActive ? 'active' : ''}`}
                onClick={handleHomeClick}
              >
                Trang chủ
              </Link>
            </li>
            <li>
              <Link
                href="/tinh-nang"
                className={`mobile-nav-link ${isTinhNangActive ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Tính năng
              </Link>
            </li>
            <li>
              <Link
                href="/cac-goi-phan-mem"
                className={`mobile-nav-link ${isPhanMemActive ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Phần mềm
              </Link>
            </li>
            <li>
              <Link
                href="/lien-he"
                className={`mobile-nav-link ${isLienHeActive ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Liên hệ
              </Link>
            </li>
            <li>
              <a
                href={goldPriceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mobile-nav-link mobile-gold-price-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                🏆 Giá vàng hôm nay
              </a>
            </li>
          </ul>

          <div className="mobile-drawer-divider"></div>

          <div className="mobile-drawer-actions">
            {user ? (
              <div className="mobile-user-container">
                <div className="mobile-welcome-badge">
                  Chào, <strong className="text-gradient">{user.name ? user.name.split(' ').pop() : 'Thành viên'}</strong>
                </div>

                {(user.role === 'admin' || user.role === 'shareholder' || user.role === 'staff_admin' || user.role === 'manager' || user.role === 'staff') && (
                  <Link
                    href="/so-do-to-chuc"
                    className="mobile-user-action-btn"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {(user.role === 'manager' || user.role === 'staff') ? '📁 Trang Quản Lý' : '⚙️ Bộ Máy Tổ Chức'}
                  </Link>
                )}

                <Link
                  href={(user.role === 'admin' || user.role === 'staff_admin') ? '/admin' : '/dashboard'}
                  className="mobile-user-action-btn"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {user.role === 'admin' && '👑 Admin Tối Cao'}
                  {user.role === 'staff_admin' && '👑 Thành Viên Quản Trị'}
                  {user.role === 'shareholder' && '💼 Cổ Đông'}
                  {user.role === 'manager' && '📁 Quản Lý Bộ Phận'}
                  {user.role === 'staff' && '👨‍💻 Nhân Sự Cấp Dưới'}
                  {user.role === 'member' && '👤 Thành Viên Tiệm Vàng'}
                  {(user.role === 'admin' || user.role === 'staff_admin') && pendingCount > 0 && (
                    <span
                      style={{
                        background: '#ef4444',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 900,
                        minWidth: '20px',
                        height: '20px',
                        padding: '0 6px',
                        borderRadius: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 10px rgba(239, 68, 68, 0.8)',
                        border: '2px solid #06373a',
                        marginLeft: '8px'
                      }}
                    >
                      {pendingCount}
                    </span>
                  )}
                </Link>

                <button
                  onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                  className="mobile-logout-btn"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className="mobile-auth-wrapper">
                <Link
                  href="/login"
                  className="mobile-login-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="btn-gold mobile-full-cta"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Đăng ký dùng thử
                </Link>
              </div>
            )}

            {/* Mobile Theme Selector inside Drawer */}
            <div className="mobile-theme-row">
              <span className="mobile-theme-label">Giao diện:</span>
              <div className="mobile-theme-chips">
                <button
                  className={`theme-chip ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('light')}
                >
                  ☀️ Sáng
                </button>
                <button
                  className={`theme-chip ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('dark')}
                >
                  🌙 Tối
                </button>
                <button
                  className={`theme-chip ${theme === 'system' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('system')}
                >
                  💻 Hệ thống
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STYLES */}
      <style jsx>{`
        .main-navbar {
          background: rgba(6, 55, 58, 0.98);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          z-index: 9999 !important;
          padding: 8px 0;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 20px rgba(0, 50, 50, 0.2);
          overflow: visible;
        }
        .main-navbar.scrolled {
          background: rgba(4, 38, 40, 0.96) !important;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          padding: 6px 0;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 10px rgba(245, 158, 11, 0.25);
          border-bottom: 1px solid rgba(245, 158, 11, 0.35);
        }
        .navbar-spacer {
          height: 72px;
          width: 100%;
          pointer-events: none;
          flex-shrink: 0;
        }
        .nav-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          overflow: visible;
          width: 100%;
        }
        .nav-logo {
          width: 220px;
          height: 52px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          flex-shrink: 0;
          cursor: pointer !important;
          z-index: 10;
          text-decoration: none;
          transition: transform 150ms ease, opacity 150ms ease;
        }
        .nav-logo:hover {
          opacity: 0.92;
        }
        .nav-logo:active {
          transform: scale(0.96);
        }
        .logo-img {
          width: 220px;
          height: auto;
          max-width: none;
          position: absolute;
          left: 0;
          top: 2px;
          transform: none;
          display: block;
          pointer-events: none;
        }
        .nav-links {
          display: flex;
          list-style: none;
          gap: 28px;
          font-size: 16px;
          font-weight: 600;
          align-items: center;
          overflow: visible;
          margin: 0;
          padding: 0;
          flex-shrink: 0;
        }
        .nav-links > li > :global(a) {
          position: relative;
          color: #dca018 !important;
          padding: 4px 0;
          transition: color 250ms ease, text-shadow 250ms ease;
          display: inline-flex;
          align-items: center;
          text-decoration: none;
          font-size: 16px;
          font-weight: 600;
          background: transparent;
          border: none;
          cursor: pointer;
          font-family: inherit;
        }
        .nav-links > li > :global(a)::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0%;
          height: 2px;
          background: #F7D977;
          border-radius: 1px;
          box-shadow: 0 0 8px rgba(247, 217, 119, 0.6);
          transition: width 250ms ease-out;
        }
        .nav-links > li > :global(a):hover {
          color: #FFF3B0 !important;
        }
        .nav-links > li > :global(a):hover::after {
          width: 100%;
        }
        .nav-links > li > :global(a.active) {
          color: #FFF3B0 !important;
          text-shadow: 0 0 10px rgba(247, 217, 119, 0.45);
        }
        .nav-links > li > :global(a.active)::after {
          width: 100%;
        }
        .nav-links > li > :global(a.gold-price-nav-link) {
          text-decoration: none !important;
        }
        .nav-links > li > :global(a.gold-price-nav-link)::after {
          display: none !important;
        }
        .gold-price-badge {
          background: linear-gradient(135deg, #f59e0b 0%, #dca018 50%, #b45309 100%);
          color: #000000 !important;
          font-weight: 800 !important;
          font-size: 13.5px !important;
          padding: 6px 13px !important;
          border-radius: 20px !important;
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 230, 150, 0.6);
          transition: all 0.25s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .gold-price-badge:hover {
          transform: translateY(-1px) scale(1.03);
          box-shadow: 0 0 18px rgba(255, 200, 50, 0.7), 0 4px 12px rgba(0, 0, 0, 0.4);
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
          color: #000000 !important;
        }
        :global(.mobile-gold-price-link) {
          color: #f59e0b !important;
          font-weight: 700 !important;
          background: rgba(245, 158, 11, 0.1) !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          border: 1px solid rgba(245, 158, 11, 0.25) !important;
        }
        .nav-actions {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;
        }
        .theme-switcher-container {
          position: relative;
          display: inline-block;
        }
        .theme-switcher-btn {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #ffffff;
          width: 36px;
          height: 36px;
          min-width: 36px;
          min-height: 36px;
          border-radius: 50%;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition-fast);
        }
        .theme-switcher-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: var(--gold-primary);
          color: var(--gold-primary);
        }
        .theme-dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          list-style: none;
          padding: 6px 0;
          min-width: 130px;
          z-index: 1010;
        }
        :global(.dark) .theme-dropdown-menu {
          background: #1c1c19;
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        .theme-dropdown-menu li {
          padding: 8px 16px;
          font-size: 13px;
          color: #333333;
          cursor: pointer;
          transition: var(--transition-fast);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        :global(.dark) .theme-dropdown-menu li {
          color: #b3b3a9;
        }
        .theme-dropdown-menu li:hover {
          background: #f3f4f6;
          color: var(--gold-primary);
        }
        :global(.dark) .theme-dropdown-menu li:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--gold-primary);
        }
        .theme-dropdown-menu li.active {
          color: var(--gold-primary);
          font-weight: 600;
        }
        :global(.btn-login-link) {
          font-size: 17px;
          font-weight: 600;
          color: #dca018 !important;
          transition: var(--transition-fast);
        }
        :global(.btn-login-link):hover,
        :global(.btn-login-link):focus,
        :global(.btn-login-link):active {
          color: #ffffff !important;
        }
        .btn-sm {
          padding: 8px 16px;
          font-size: 13px;
        }
        .user-profile-menu {
          display: flex;
          align-items: center;
          gap: 15px;
          font-size: 14px;
        }
        .welcome-text {
          color: rgba(255, 255, 255, 0.9);
        }
        .btn-logout {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          font-size: 14px;
          transition: var(--transition-fast);
        }
        .btn-logout:hover {
          color: #ff6b6b;
        }

        /* MOBILE HEADER & DRAWER STYLES */
        .desktop-only {
          display: flex;
        }
        .mobile-only {
          display: none;
        }

        .mobile-header-controls {
          position: relative;
          align-items: center;
          gap: 10px;
        }

        .mobile-theme-btn {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
        }

        .mobile-header-theme-dropdown {
          right: 0;
          top: 48px;
        }

        .mobile-hamburger-btn {
          width: 44px;
          height: 44px;
          min-width: 44px;
          min-height: 44px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease, border-color 0.2s ease;
          padding: 0;
        }

        .mobile-hamburger-btn:hover,
        .mobile-hamburger-btn:focus {
          background: rgba(255, 255, 255, 0.16);
          border-color: #dca018;
        }

        .hamburger-lines {
          width: 20px;
          height: 14px;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .hamburger-lines span {
          display: block;
          width: 100%;
          height: 2px;
          background-color: #dca018;
          border-radius: 2px;
          transition: transform 250ms ease, opacity 250ms ease;
        }

        .hamburger-lines.open span:nth-child(1) {
          transform: translateY(6px) rotate(45deg);
        }
        .hamburger-lines.open span:nth-child(2) {
          opacity: 0;
        }
        .hamburger-lines.open span:nth-child(3) {
          transform: translateY(-6px) rotate(-45deg);
        }

        .mobile-menu-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 998;
          animation: fadeInBackdrop 200ms ease forwards;
        }

        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .mobile-menu-drawer {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #06373a;
          border-bottom: 1px solid rgba(247, 217, 119, 0.3);
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
          z-index: 999;
          max-height: 0;
          opacity: 0;
          transform: translateY(-10px);
          pointer-events: none;
          overflow: hidden;
          transition: max-height 320ms cubic-bezier(0.22, 1, 0.36, 1),
                      transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
                      opacity 280ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .mobile-menu-drawer.is-open {
          max-height: 85vh;
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
          overflow-y: auto;
        }

        .mobile-drawer-content {
          padding: 20px 20px 28px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .mobile-nav-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        :global(.mobile-nav-link) {
          display: flex;
          align-items: center;
          min-height: 46px;
          padding: 10px 16px;
          border-radius: 10px;
          color: #dca018 !important;
          font-size: 16px;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.2s ease, color 0.2s ease;
        }

        :global(.mobile-nav-link:hover),
        :global(.mobile-nav-link.active) {
          background: rgba(255, 255, 255, 0.08);
          color: #FFF3B0 !important;
        }

        .mobile-drawer-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 4px 0;
        }

        .mobile-drawer-actions {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .mobile-user-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .mobile-welcome-badge {
          font-size: 15px;
          color: #ffffff;
          padding: 4px 8px;
        }

        :global(.mobile-user-action-btn) {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          color: #f59e0b;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          border: 1px solid rgba(245, 158, 11, 0.4);
          text-decoration: none;
        }

        .mobile-logout-btn {
          min-height: 44px;
          background: transparent;
          border: 1px solid rgba(255, 107, 107, 0.4);
          border-radius: 10px;
          color: #ff6b6b;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .mobile-auth-wrapper {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        :global(.mobile-login-link) {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          padding: 10px 16px;
          border-radius: 10px;
          color: #dca018 !important;
          font-size: 16px;
          font-weight: 600;
          border: 1px solid rgba(220, 160, 24, 0.4);
          text-decoration: none;
          text-align: center;
          transition: background 0.2s ease;
        }

        :global(.mobile-login-link:hover) {
          background: rgba(220, 160, 24, 0.1);
          color: #ffffff !important;
        }

        :global(.mobile-full-cta) {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 100% !important;
          min-height: 48px !important;
          font-size: 16px !important;
          font-weight: 700 !important;
          border-radius: 12px !important;
          text-align: center !important;
          box-shadow: 0 4px 16px rgba(220, 160, 24, 0.3) !important;
        }

        .mobile-theme-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 4px;
        }

        .mobile-theme-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 600;
        }

        .mobile-theme-chips {
          display: flex;
          gap: 8px;
        }

        .theme-chip {
          flex: 1;
          min-height: 44px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .theme-chip.active {
          border-color: #dca018;
          background: rgba(220, 160, 24, 0.18);
          color: #FFF3B0;
        }

        @media (max-width: 1200px) {
          .nav-logo {
            width: 180px;
            height: 44px;
            flex: 0 0 180px;
          }
          .logo-img {
            width: 180px;
          }
          .nav-links {
            gap: 16px;
            font-size: 14.5px;
          }
          .nav-links > li > :global(a) {
            font-size: 14.5px;
          }
          .nav-actions {
            gap: 10px;
          }
          .user-profile-menu {
            gap: 8px;
            font-size: 13px;
          }
          .welcome-text {
            font-size: 13px;
          }
        }

        /* MEDIA QUERIES FOR COMPACT MOBILE & TABLET LAYOUT */
        @media (max-width: 991px) {
          .nav-container {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
          }
          .desktop-only {
            display: none !important;
          }
          .mobile-only {
            display: flex !important;
          }

          .main-navbar {
            padding: 6px 0;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
          }
          .navbar-spacer {
            height: 52px;
          }

          .nav-logo {
            width: 160px;
            height: 40px;
            flex: 0 0 160px;
          }

          .logo-img {
            width: 160px;
            top: 1px;
          }

          .nav-brand-group {
            gap: 8px;
          }

          .navbar-back-btn {
            height: 36px;
            padding: 0 10px;
            font-size: 13px;
          }
        }

        @media (max-width: 600px) {
          .navbar-back-text {
            display: none;
          }
          .navbar-back-btn {
            width: 36px;
            height: 36px;
            padding: 0;
            justify-content: center;
            border-radius: 50%;
          }
        }

        @media (max-width: 380px) {
          .nav-logo {
            width: 135px;
            height: 36px;
            flex: 0 0 135px;
          }
          .logo-img {
            width: 135px;
          }
          .mobile-theme-btn {
            width: 36px;
            height: 36px;
            min-width: 36px;
            min-height: 36px;
          }
        /* ================= LIGHT THEME OVERRIDES FOR NAVBAR ================= */
        :global(html.light) .main-navbar {
          background: rgba(255, 255, 255, 0.95) !important;
          border-bottom: 1px solid rgba(184, 115, 0, 0.18) !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06) !important;
        }

        :global(html.light) .main-navbar.scrolled {
          background: rgba(255, 255, 255, 0.98) !important;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08), 0 2px 10px rgba(184, 115, 0, 0.12) !important;
          border-bottom: 1px solid rgba(184, 115, 0, 0.28) !important;
        }

        :global(html.light) .nav-links > li > :global(a) {
          color: #4b3800 !important;
        }

        :global(html.light) .nav-links > li > :global(a:hover),
        :global(html.light) .nav-links > li > :global(a.active) {
          color: #b87300 !important;
        }

        :global(html.light) .nav-links > li > :global(a.active)::after {
          background: #b87300 !important;
          box-shadow: 0 0 10px rgba(184, 115, 0, 0.6) !important;
        }

        :global(html.light) .welcome-text {
          color: #374151 !important;
        }

        :global(html.light) .user-dashboard-btn {
          background: rgba(184, 115, 0, 0.1) !important;
          border-color: rgba(184, 115, 0, 0.35) !important;
          color: #8b5a00 !important;
        }

        :global(html.light) .user-dashboard-btn:hover {
          background: rgba(184, 115, 0, 0.18) !important;
          color: #633f00 !important;
        }

        :global(html.light) .theme-switcher-btn {
          background: rgba(0, 0, 0, 0.05) !important;
          border-color: rgba(0, 0, 0, 0.12) !important;
          color: #1f2937 !important;
        }

        :global(html.light) .theme-switcher-btn:hover {
          background: rgba(184, 115, 0, 0.1) !important;
          border-color: rgba(184, 115, 0, 0.3) !important;
        }

        :global(html.light) .theme-dropdown-menu {
          background: #ffffff !important;
          border-color: rgba(0, 0, 0, 0.12) !important;
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.15) !important;
        }

        :global(html.light) .theme-dropdown-menu li {
          color: #374151 !important;
        }

        :global(html.light) .theme-dropdown-menu li:hover {
          background: rgba(184, 115, 0, 0.08) !important;
          color: #b87300 !important;
        }

        :global(html.light) .theme-dropdown-menu li.active {
          background: rgba(184, 115, 0, 0.15) !important;
          color: #8b5a00 !important;
        }

        :global(html.light) .mobile-hamburger-btn span {
          background: #1e293b !important;
        }

        :global(html.light) .mobile-menu-drawer {
          background: #ffffff !important;
          border-left: 1px solid rgba(0, 0, 0, 0.08) !important;
          box-shadow: -10px 0 35px rgba(0, 0, 0, 0.15) !important;
        }

        :global(html.light) .mobile-nav-link {
          color: #334155 !important;
        }

        :global(html.light) .mobile-nav-link.active,
        :global(html.light) .mobile-nav-link:hover {
          color: #b87300 !important;
          background: rgba(184, 115, 0, 0.08) !important;
        }

        :global(html.light) .mobile-welcome-badge {
          background: rgba(0, 0, 0, 0.04) !important;
          border-color: rgba(0, 0, 0, 0.08) !important;
          color: #1e293b !important;
        }

        :global(html.light) .mobile-user-action-btn {
          background: rgba(184, 115, 0, 0.08) !important;
          border-color: rgba(184, 115, 0, 0.25) !important;
          color: #8b5a00 !important;
        }

        :global(html.light) .mobile-login-link {
          color: #475569 !important;
          border-color: rgba(0, 0, 0, 0.15) !important;
        }

        :global(html.light) .mobile-drawer-divider {
          background: rgba(0, 0, 0, 0.08) !important;
        }

        :global(html.light) .mobile-theme-label {
          color: #64748b !important;
        }

        :global(html.light) .theme-chip {
          background: rgba(0, 0, 0, 0.04) !important;
          border-color: rgba(0, 0, 0, 0.12) !important;
          color: #334155 !important;
        }

        :global(html.light) .theme-chip.active {
          border-color: #b87300 !important;
          background: rgba(184, 115, 0, 0.15) !important;
          color: #8b5a00 !important;
        }
      `}</style>
    </nav>
    <div className="navbar-spacer" aria-hidden="true" />
    </>
  );
}
