import { useState, useEffect } from 'react';
import { useNavigate, Link, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Users,
  UsersRound,
  LifeBuoy,
  X,
  Crown,
  Bell,
  Mail,
  LogOut,
  Home,
  Shield,
  Radio,
  MessageSquare,
  UserRound,
  Layers,
  GitBranch,
} from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import ComingSoon from '../../../shared/components/feedback/ComingSoon';
import UserManagement from './menus/UserManagement';
import CommunityManagement from './menus/CommunityManagement';
import ChannelManagement from './menus/ChannelManagement';
import SubchannelManagement from './menus/SubchannelManagement';
import SupportTicketCenter from './menus/SupportTicketCenter';
import UserDetail from './menus/UserDetail';
import CommunityDetail from './menus/CommunityDetail';
import AdminCommunityPostPage from './menus/AdminCommunityPostPage';
import Profile from '../../profile/pages/Profile';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100';

const navigationItems = [
  { id: 'users', label: 'User Management', icon: Users, type: 'users' },
  { id: 'communities', label: 'Community Management', icon: UsersRound, type: 'communities' },
  { id: 'channels', label: 'Channels', icon: Layers, type: 'channels' },
  { id: 'subchannels', label: 'Subchannels', icon: GitBranch, type: 'subchannels' },
  { id: 'moderation', label: 'Content Moderation', icon: Shield, type: 'soon', title: 'Content Moderation' },
  { id: 'commentary', label: 'Live Commentary', icon: MessageSquare, type: 'soon', title: 'Live Commentary' },
  { id: 'watchgroups', label: 'Watch Groups', icon: Radio, type: 'soon', title: 'Watch Groups' },
  { id: 'analytics', label: 'Reporting & Analytics', icon: BarChart3, type: 'soon', title: 'Reporting & Analytics' },
  { id: 'support', label: 'Support Tools', icon: LifeBuoy, type: 'support' },
  { id: 'profile', label: 'Profile', icon: UserRound, type: 'profile' },
];

const getActiveTabFromPath = (pathname) => {
  const segment = pathname.replace(/^\/admin\/?/, '').split('/')[0] || 'users';
  const match = navigationItems.find((item) => item.id === segment);
  return match ? match.id : 'users';
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() =>
    getActiveTabFromPath(location.pathname)
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setActiveTab(getActiveTabFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    if (logout) {
      await logout();
    }
    navigate('/login');
  };

  const handleProfileOpen = () => {
    setActiveTab('profile');
    setIsMobileMenuOpen(false);
    navigate('/admin/profile');
  };

  const handleNavClick = (itemId) => {
    setActiveTab(itemId);
    setIsMobileMenuOpen(false);
    navigate(`/admin/${itemId}`);
  };

  const avatarSrc = user?.avatar || DEFAULT_AVATAR;

  return (
    <div className="h-screen bg-[#0c0a09] text-stone-300 font-sans flex flex-col md:flex-row overflow-hidden">
      <div className="md:hidden flex items-center justify-between p-4 bg-[#12100e] border-b border-stone-800/60">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Crown className="w-5 h-5 text-amber-500" />
          </div>
          <span className="font-serif font-bold text-lg text-amber-50">Fointer</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500/60"
          title="Open menu"
        >
          <img
            src={avatarSrc}
            alt="Avatar"
            className="w-9 h-9 rounded-full ring-2 ring-amber-500/40 object-cover"
          />
        </button>
      </div>

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-[70%] max-w-[300px] bg-[#12100e] border-l border-stone-800/50 flex flex-col transform transition-transform duration-300 ease-in-out md:static md:right-auto md:w-64 md:max-w-none md:translate-x-0 md:border-l-0 md:border-r md:h-screen ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="md:hidden flex items-center justify-between p-4 border-b border-stone-800/40">
          <button
            type="button"
            onClick={handleProfileOpen}
            className="flex items-center gap-2.5 truncate text-left hover:opacity-80 transition-opacity"
            title="Open profile"
          >
            <img
              src={avatarSrc}
              alt="Avatar"
              className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-500/40 shrink-0"
            />
            <div className="truncate">
              <p className="text-xs font-semibold text-stone-200 truncate">
                {user?.name || user?.username || 'Admin'}
              </p>
              <p className="text-[10px] text-amber-500 font-medium capitalize">
                {user?.role || 'admin'}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1 text-stone-400 hover:text-amber-400 shrink-0"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 hidden md:flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Crown className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-amber-100 text-xl tracking-tight">Fointer</h1>
            <p className="text-[10px] text-amber-500 uppercase tracking-widest font-semibold">Admin Account</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <Link
            to="/"
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-stone-400 hover:text-amber-400 hover:bg-[#181512] mb-2 border-b border-stone-800/40"
          >
            <Home className="w-4 h-4" />
            <span>Go to Home</span>
          </Link>

          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#1e1b18] text-amber-400 border border-amber-500/40 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-[#181512]'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-stone-400'}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-stone-800/40">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-red-400/90 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-xs"
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="hidden md:flex items-center justify-end px-8 py-4 bg-[#0c0a09] border-b border-stone-800/40 space-x-5">
          <button type="button" className="p-2 text-stone-400 hover:text-amber-400 transition-colors relative">
            <Bell className="w-5 h-5" />
          </button>
          <button type="button" className="p-2 text-stone-400 hover:text-amber-400 transition-colors">
            <Mail className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-3 pl-3 border-l border-stone-800/60">
            <div className="text-right">
              <p className="text-xs font-semibold text-stone-200">
                {user?.name || user?.username || 'Admin'}
              </p>
              <p className="text-[10px] text-amber-500 font-medium capitalize">
                {user?.role || 'admin'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleProfileOpen}
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500/60"
              title="Open profile"
            >
              <img
                src={avatarSrc}
                alt="Avatar"
                className="w-8 h-8 rounded-full ring-2 ring-amber-500/40 object-cover"
              />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl w-full mx-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/admin/users" replace />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="users/:id" element={<UserDetail />} />
              <Route path="communities" element={<CommunityManagement />} />
              <Route
                path="communities/:id/posts/:postId"
                element={<AdminCommunityPostPage />}
              />
              <Route path="communities/:id" element={<CommunityDetail />} />
              <Route path="channels" element={<ChannelManagement />} />
              <Route path="subchannels" element={<SubchannelManagement />} />
              <Route path="support" element={<SupportTicketCenter />} />
              <Route path="profile" element={<Profile />} />
              {navigationItems
                .filter((item) => item.type === 'soon')
                .map((item) => (
                  <Route
                    key={item.id}
                    path={item.id}
                    element={<ComingSoon title={item.title || item.label} />}
                  />
                ))}
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
