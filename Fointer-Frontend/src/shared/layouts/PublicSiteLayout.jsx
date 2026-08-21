import { Link, Outlet, useLocation } from 'react-router-dom';
import SiteLinksFooter from '../components/SiteLinksFooter';
import BrandLogo from '../components/BrandLogo';
import GuestAuthButtons from '../components/GuestAuthButtons';
import { SITE_LINKS } from '../constants/siteLinks';
import { DEFAULT_AVATAR } from '../constants/avatars';
import { EXPLORE_PATH } from '../constants/paths';
import { useAuth } from '../../context/AuthContext';

/** Public/legal chrome — same theme and auth buttons as the explore panel. */
export default function PublicSiteLayout({ children }) {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const isGuest = !loading && !user;
  const activeSegment =
    SITE_LINKS.find((l) => l.to === pathname)?.segment || null;
  const exploreTo = isGuest ? EXPLORE_PATH : '/';
  const exploreActive =
    pathname === EXPLORE_PATH || (!isGuest && pathname === '/');

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#E5E0D8] font-sans flex flex-col antialiased selection:bg-[#D4AF37] selection:text-black">
      <header className="sticky top-0 z-40 border-b border-[#2A241E] bg-[#14100D]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 grid grid-cols-3 items-center gap-3">
          <div className="justify-self-start min-w-0">
            <BrandLogo />
          </div>
          <nav className="flex items-center justify-center gap-5 sm:gap-8">
            <Link
              to={exploreTo}
              className={`text-xs font-medium transition-colors ${
                exploreActive
                  ? 'text-[#D4AF37]'
                  : 'text-[#A69B8D] hover:text-[#E5E0D8]'
              }`}
            >
              Explore
            </Link>
            <Link
              to="/about"
              className={`text-xs font-medium transition-colors ${
                pathname === '/about'
                  ? 'text-[#D4AF37]'
                  : 'text-[#A69B8D] hover:text-[#E5E0D8]'
              }`}
            >
              About
            </Link>
          </nav>
          <div className="justify-self-end flex items-center gap-2 sm:gap-3">
            {loading ? null : isGuest ? (
              <GuestAuthButtons />
            ) : (
              <Link
                to={user?.role === 'admin' ? '/admin/profile' : '/profile'}
                className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-[#2A241E] hover:opacity-80 transition-opacity"
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
      </header>

      <main className="flex-1 w-full">
        {children ?? <Outlet />}
      </main>

      <footer className="border-t border-[#2A241E] bg-[#0E0C0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <SiteLinksFooter variant="site" activeSegment={activeSegment} />
        </div>
      </footer>
    </div>
  );
}
