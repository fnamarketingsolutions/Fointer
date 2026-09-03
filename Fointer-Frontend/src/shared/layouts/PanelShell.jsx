import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LuBell as Bell,
  LuLogIn as LogIn,
  LuLogOut as LogOut,
  LuMenu as Menu,
  LuUserPlus as UserPlus,
  LuX as X,
} from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { APP_SCROLL_ID } from '../utils/scroll';
import BrandLogo from '../components/BrandLogo';
import GuestAuthButtons from '../components/GuestAuthButtons';
import HeaderSearch from '../components/HeaderSearch';
import ThemeToggle from '../components/ThemeToggle';
import ProfileAvatar from '../components/ProfileAvatar';
import guestJoinDarkSrc from '../../assets/guest-join-fointer.png';
import guestJoinLightSrc from '../../assets/guest-join-fointer-light.png';
import { useNotifications } from '../../context/NotificationContext';

function GuestJoinPromo({ onClose }) {
  const { isDark } = useTheme();
  const guestJoinSrc = isDark ? guestJoinDarkSrc : guestJoinLightSrc;

  return (
    <Link
      to="/signup"
      onClick={onClose}
      className="block overflow-hidden bg-fo-surface"
    >
      <img
        src={guestJoinSrc}
        alt="Join Fointer. Be part of something meaningful."
        className="block w-full h-auto"
      />
    </Link>
  );
}

function NavList({ items, onSelect, mobile = false }) {
  return items.map((item) => {
    const Icon = item.icon;
    const isActive = Boolean(item.isActive);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelect(item.id)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
          isActive
            ? `bg-fo-surface-3 text-fo-accent border-l-2 border-fo-accent ${
                mobile ? '' : 'shadow-lg shadow-black/20'
              }`
            : 'text-fo-muted hover:text-fo-text hover:bg-fo-surface-hover'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-1">
          <Icon
            size={16}
            className={`shrink-0 ${isActive ? 'text-fo-accent' : 'text-fo-subtle'}`}
          />
          <span className="truncate whitespace-nowrap">{item.label}</span>
        </div>
      </button>
    );
  });
}

function AuthFooter({ isGuest, onLogout, onClose, fromPath }) {
  if (isGuest) {
    return (
      <div className="space-y-2">
        <Link
          to="/signup"
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold"
        >
          <UserPlus size={14} /> Sign up
        </Link>
        <Link
          to="/login"
          state={{ from: fromPath }}
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-fo-border text-xs text-fo-text hover:text-fo-accent"
        >
          <LogIn size={14} /> Log in
        </Link>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors whitespace-nowrap text-xs"
    >
      <LogOut size={15} className="shrink-0" />
      <span className="truncate">Logout</span>
    </button>
  );
}

/** Shared user/admin chrome: header + sidebar + mobile drawer. */
export default function PanelShell({
  navItems,
  onSelectNav,
  homeTo = '/',
  profileTo,
  notificationsTo,
  logoutTo = '/',
  allowGuest = false,
  children,
}) {
  const { user, loading, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isGuest = allowGuest && !loading && !user;
  const showGuestPromo = isGuest && !navItems?.length;

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleLogout = async () => {
    if (logout) await logout();
    closeMobileMenu();
    navigate(logoutTo);
  };

  const handleSelectNav = (id) => {
    onSelectNav(id);
    closeMobileMenu();
  };

  const requireLogin = (fromPath) => {
    navigate('/login', { state: { from: fromPath || location.pathname } });
  };

  const openProfile = () => {
    if (isGuest) {
      requireLogin(profileTo);
      closeMobileMenu();
      return;
    }
    navigate(profileTo);
    closeMobileMenu();
  };

  const handleAvatarClick = () => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      if (isGuest) requireLogin(profileTo);
      else navigate(profileTo);
    } else {
      setIsMobileMenuOpen(true);
    }
  };

  const notificationsActive =
    Boolean(notificationsTo) &&
    (location.pathname === notificationsTo ||
      location.pathname.startsWith(`${notificationsTo}/`));

  return (
    <div className="min-h-screen bg-fo-bg text-fo-text font-sans flex flex-col antialiased selection:bg-fo-accent selection:text-black">
      <header className="h-16 sm:h-20 border-b border-fo-border bg-fo-surface/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 flex items-center gap-3 sm:gap-4">
        <BrandLogo to={homeTo} />

        <HeaderSearch className="flex-1 max-w-xl mx-auto hidden sm:block" />

        <div className="flex items-center gap-2 sm:gap-4 shrink-0 ml-auto">
          <ThemeToggle />
          {isGuest ? (
            <div className="flex items-center gap-2">
              <div className="hidden md:block">
                <GuestAuthButtons />
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {notificationsTo ? (
                <button
                  type="button"
                  onClick={() => navigate(notificationsTo)}
                  className={`p-2 rounded-lg border transition-colors ${
                    notificationsActive
                      ? 'border-fo-accent/40 text-fo-accent bg-fo-accent/10'
                      : 'border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40'
                  }`}
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <span className="relative inline-flex">
                    <Bell size={16} />
                    {unreadCount > 0 ? (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-fo-accent text-black text-[9px] font-bold leading-4 text-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : null}
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleAvatarClick}
                className="flex items-center gap-3 pl-3 border-l border-fo-border focus:outline-none hover:opacity-80 transition-opacity"
                title="Profile"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-fo-text">
                    {user?.name || user?.username || 'User'}
                  </p>
                  <p className="text-[10px] text-fo-accent capitalize font-mono">
                    {user?.role || 'Member'}
                  </p>
                </div>
                <ProfileAvatar
                  src={user?.avatar}
                  alt={user?.name}
                  className="w-9 h-9 rounded-full object-cover border border-fo-accent/50 shrink-0"
                />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="sm:hidden sticky top-16 z-30 px-4 py-2 border-b border-fo-border bg-fo-surface/95">
        <HeaderSearch />
      </div>

      <div className="flex-1 flex max-w-[1600px] w-full mx-auto relative">
        <aside className={`w-64 border-r border-fo-border bg-fo-surface flex-col justify-between shrink-0 hidden md:flex max-h-[calc(100vh-5rem)] overflow-y-auto ${showGuestPromo ? 'p-0' : 'p-4'}`}>
          <div className={showGuestPromo ? '' : 'space-y-6'}>
            {navItems?.length ? (
              <nav className="space-y-1">
                <NavList items={navItems} onSelect={handleSelectNav} />
              </nav>
            ) : isGuest ? (
              <GuestJoinPromo />
            ) : null}
          </div>

          <div className={`space-y-4 border-t border-fo-border ${showGuestPromo ? 'p-4' : 'pt-4 mt-4'}`}>
            <AuthFooter
              isGuest={isGuest}
              onLogout={handleLogout}
              fromPath={location.pathname}
            />
          </div>
        </aside>

        {isMobileMenuOpen ? (
          <div className="fixed inset-0 z-50 md:hidden flex justify-end">
            <div
              className="fixed inset-0 bg-[var(--theme-overlay)] backdrop-blur-sm transition-opacity"
              onClick={closeMobileMenu}
            />

            <aside className="relative w-[70%] max-w-[300px] bg-fo-surface h-full border-l border-fo-border p-4 flex flex-col justify-between z-10 overflow-y-auto shadow-2xl">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-fo-border">
                  <button
                    type="button"
                    onClick={openProfile}
                    className="flex items-center gap-2.5 truncate text-left hover:opacity-80 transition-opacity"
                  >
                    <ProfileAvatar
                      src={user?.avatar}
                      alt="Avatar"
                      className="w-9 h-9 rounded-full object-cover border border-fo-accent/50 shrink-0"
                    />
                    <div className="truncate">
                      <p className="text-xs font-bold text-fo-text truncate">
                        {user?.name || user?.username || 'Guest'}
                      </p>
                      <p className="text-[10px] text-fo-accent capitalize font-mono">
                        {user?.role || 'Browse'}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={closeMobileMenu}
                    className="p-1 text-fo-muted hover:text-fo-text shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                {navItems?.length ? (
                  <nav className="space-y-1">
                    <NavList items={navItems} onSelect={handleSelectNav} mobile />
                  </nav>
                ) : null}

                <div className="flex items-center justify-between rounded-lg border border-fo-border px-3 py-2">
                  <span className="text-sm text-fo-muted">Theme</span>
                  <ThemeToggle />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-fo-border mt-auto">
                <AuthFooter
                  isGuest={isGuest}
                  onLogout={handleLogout}
                  onClose={closeMobileMenu}
                  fromPath={location.pathname}
                />
              </div>
            </aside>
          </div>
        ) : null}

        <main
          id={APP_SCROLL_ID}
          className="flex-1 px-3 py-3 sm:p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-5rem)] w-full"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
