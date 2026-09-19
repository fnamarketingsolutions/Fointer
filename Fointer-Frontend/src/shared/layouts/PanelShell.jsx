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
import ScrollToTopButton from '../components/ScrollToTopButton';
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

function NavList({ items, onSelect }) {
  return items.map((item) => {
    const Icon = item.icon;
    const isActive = Boolean(item.isActive);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelect(item.id)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors duration-150 ${
          isActive
            ? 'bg-fo-accent/12 text-fo-accent'
            : 'text-fo-muted hover:text-fo-text hover:bg-fo-surface-hover'
        }`}
      >
        <Icon
          size={16}
          className={`shrink-0 ${isActive ? 'text-fo-accent' : 'text-fo-subtle'}`}
        />
        <span className="truncate whitespace-nowrap">{item.label}</span>
        {item.badge ? (
          <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-fo-accent text-black text-[10px] font-semibold leading-[18px] text-center">
            {item.badge}
          </span>
        ) : null}
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
          className="w-full flex items-center justify-center gap-2 min-h-9 px-3 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold"
        >
          <UserPlus size={14} /> Sign up
        </Link>
        <Link
          to="/login"
          state={{ from: fromPath }}
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 min-h-9 px-3 py-2 rounded-lg border border-fo-border text-xs text-fo-text hover:text-fo-accent"
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
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-red-500 hover:text-red-600 hover:bg-red-500/8 transition-colors whitespace-nowrap"
    >
      <LogOut size={15} className="shrink-0" />
      <span className="truncate">Logout</span>
    </button>
  );
}

/** Shared member chrome: header + sidebar + mobile drawer. */
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
    <div className="h-dvh overflow-hidden bg-fo-bg text-fo-text font-sans flex flex-col antialiased selection:bg-fo-accent selection:text-black">
      <header className="h-16 shrink-0 border-b border-fo-border/80 bg-fo-surface/90 backdrop-blur-md z-40 px-4 sm:px-6 flex items-center gap-3 sm:gap-5">
        <BrandLogo to={homeTo} />

        <HeaderSearch className="flex-1 max-w-2xl mx-auto hidden sm:block" />

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
                  className={`p-2 rounded-full transition-colors ${
                    notificationsActive
                      ? 'text-fo-accent bg-fo-accent/10'
                      : 'text-fo-muted hover:text-fo-accent hover:bg-fo-surface-hover'
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
                className="flex items-center gap-3 pl-3 border-l border-fo-border/80 focus:outline-none hover:opacity-80 transition-opacity"
                title="Profile"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-[13px] font-semibold text-fo-text leading-tight">
                    {user?.name || user?.username || 'User'}
                  </p>
                  {user?.username ? (
                    <p className="text-[11px] text-fo-subtle">
                      @{String(user.username).replace(/^@+/, '')}
                    </p>
                  ) : null}
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

      <div className="sm:hidden shrink-0 px-4 py-2 border-b border-fo-border bg-fo-surface/95">
        <HeaderSearch />
      </div>

      <div className="flex-1 min-h-0 flex max-w-[1600px] w-full mx-auto relative">
        <aside className={`w-[236px] border-r border-fo-border/80 bg-fo-surface/70 flex-col justify-between shrink-0 hidden md:flex h-full overflow-y-auto ${showGuestPromo ? 'p-0' : 'px-3 py-4'}`}>
          <div className={showGuestPromo ? '' : 'space-y-4'}>
            {navItems?.length ? (
              <nav className="space-y-1">
                <NavList items={navItems} onSelect={handleSelectNav} />
              </nav>
            ) : isGuest ? (
              <GuestJoinPromo />
            ) : null}
          </div>

          <div className={`mt-4 ${showGuestPromo ? 'p-4 border-t border-fo-border' : 'pt-3 mt-auto'}`}>
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
                    <NavList items={navItems} onSelect={handleSelectNav} />
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
          className="flex-1 min-h-0 px-3 py-3 sm:px-6 sm:py-5 overflow-y-auto w-full"
        >
          {children}
        </main>
      </div>
      <ScrollToTopButton />
    </div>
  );
}
