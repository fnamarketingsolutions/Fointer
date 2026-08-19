import { Link, Outlet, useLocation } from 'react-router-dom';
import SiteLinksFooter from '../components/SiteLinksFooter';
import { SITE_LINKS } from '../constants/siteLinks';
import { useAuth } from '../../context/AuthContext';

const defaultAvatar =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';

/** Minimal chrome for public/legal pages (outside the dashboard shell). */
export default function PublicSiteLayout() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const isGuest = !loading && !user;
  const activeSegment =
    SITE_LINKS.find((l) => l.to === pathname)?.segment || null;

  return (
    <div className="min-h-screen bg-[#130D08] text-[#E5E0D8] flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[#2A241E]/80 bg-[#130D08]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="font-serif text-lg sm:text-xl text-[#D4AF37] tracking-wide hover:text-[#e0c04a] transition-colors"
          >
            Fointer
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="text-xs text-[#A69B8D] hover:text-[#E5E0D8] transition-colors px-2 py-1"
            >
              Feed
            </Link>
            {loading ? null : isGuest ? (
              <>
                <Link
                  to="/login"
                  state={{ from: pathname }}
                  className="text-xs font-semibold text-[#E5E0D8] border border-[#2A241E] hover:border-[#D4AF37]/40 hover:text-[#D4AF37] px-3 py-1.5 rounded-lg transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="text-xs font-semibold text-[#0E0C0A] bg-[#D4AF37] hover:bg-[#e0c04a] px-3 py-1.5 rounded-lg transition-colors"
                >
                  Sign up
                </Link>
              </>
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
                  src={user?.avatar || defaultAvatar}
                  alt={user?.name || 'Avatar'}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = defaultAvatar;
                  }}
                  className="w-8 h-8 rounded-full object-cover border border-[#D4AF37]/50 shrink-0"
                />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        <Outlet />
      </main>

      <footer className="border-t border-[#2A241E] bg-[#0E0C0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <SiteLinksFooter activeSegment={activeSegment} />
        </div>
      </footer>
    </div>
  );
}
