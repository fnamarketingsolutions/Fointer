import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LuMenu as Menu, LuX as X } from 'react-icons/lu';
import SiteLinksFooter from '../components/SiteLinksFooter';
import BrandLogo from '../components/BrandLogo';
import GuestAuthButtons from '../components/GuestAuthButtons';
import { SITE_LINKS } from '../constants/siteLinks';
import { DEFAULT_AVATAR } from '../constants/avatars';
import { EXPLORE_PATH } from '../constants/paths';
import { useAuth } from '../../context/AuthContext';

function navLinkClass(active, mobile = false) {
  if (mobile) {
    return `flex items-center min-h-11 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-[#251E17] text-[#D4AF37]'
        : 'text-[#A69B8D] hover:text-[#E5E0D8] hover:bg-[#1C1612]'
    }`;
  }
  return `text-xs font-medium whitespace-nowrap transition-colors ${
    active ? 'text-[#D4AF37]' : 'text-[#A69B8D] hover:text-[#E5E0D8]'
  }`;
}

/** Public/legal chrome — same theme and auth buttons as the explore panel. */
export default function PublicSiteLayout({ children }) {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isGuest = !loading && !user;
  const activeSegment =
    SITE_LINKS.find((l) => l.to === pathname)?.segment || null;
  const exploreTo = isGuest ? EXPLORE_PATH : '/';
  const exploreActive =
    pathname === EXPLORE_PATH || (!isGuest && pathname === '/');
  const profileTo = user?.role === 'admin' ? '/admin/profile' : '/profile';

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#E5E0D8] font-sans flex flex-col antialiased selection:bg-[#D4AF37] selection:text-black">
      <header className="sticky top-0 z-50 border-b border-[#2A241E] bg-[#14100D]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3 min-w-0">
          <div className="justify-self-start min-w-0 shrink-0">
            <BrandLogo />
          </div>

          <nav className="hidden md:flex items-center justify-center gap-8">
            <Link to={exploreTo} className={navLinkClass(exploreActive)}>
              Explore
            </Link>
            <Link to="/about" className={navLinkClass(pathname === '/about')}>
              About
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {loading ? null : isGuest ? (
              <>
                <div className="hidden md:block">
                  <GuestAuthButtons />
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen((open) => !open)}
                  className="md:hidden p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40"
                  aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={mobileOpen}
                >
                  {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </>
            ) : (
              <Link
                to={profileTo}
                className="flex items-center gap-2.5 pl-3 border-l border-[#2A241E] hover:opacity-80 transition-opacity"
                title="Profile"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-[#E5E0D8]">
                    {user?.name || user?.username || 'User'}
                  </p>
                  <p className="text-[10px] text-[#D4AF37] capitalize font-mono">
                    {user?.role || 'Member'}
                  </p>
                </div>
                <img
                  src={user?.avatar || DEFAULT_AVATAR}
                  alt={user?.name || 'Avatar'}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                  className="w-9 h-9 rounded-full object-cover border border-[#D4AF37]/50 shrink-0"
                />
              </Link>
            )}
          </div>
        </div>

        {mobileOpen ? (
          <div className="md:hidden border-t border-[#2A241E] bg-[#14100D]">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
              <nav className="flex flex-col gap-1">
                <Link
                  to={exploreTo}
                  onClick={closeMobileMenu}
                  className={navLinkClass(exploreActive, true)}
                >
                  Explore
                </Link>
                <Link
                  to="/about"
                  onClick={closeMobileMenu}
                  className={navLinkClass(pathname === '/about', true)}
                >
                  About
                </Link>
              </nav>

              {loading ? null : isGuest ? (
                <GuestAuthButtons className="flex-col [&>a]:w-full [&>a]:justify-center [&>a]:min-h-11" />
              ) : (
                <Link
                  to={profileTo}
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1C1612] transition-colors"
                >
                  <img
                    src={user?.avatar || DEFAULT_AVATAR}
                    alt={user?.name || 'Avatar'}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                    className="w-9 h-9 rounded-full object-cover border border-[#D4AF37]/50 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#E5E0D8] truncate">
                      {user?.name || user?.username || 'User'}
                    </p>
                    <p className="text-[10px] text-[#D4AF37] capitalize font-mono">
                      {user?.role || 'Member'}
                    </p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <main className="flex-1 w-full min-w-0 overflow-x-hidden">
        {children ?? <Outlet />}
      </main>

      <footer className="border-t border-[#2A241E] bg-[#0E0C0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <SiteLinksFooter variant="site" activeSegment={activeSegment} />
        </div>
      </footer>
    </div>
  );
}
