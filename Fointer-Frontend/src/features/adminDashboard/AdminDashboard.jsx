import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BarChart3,
  Users,
  UsersRound,
  LifeBuoy,
  Menu,
  X,
  Crown,
  Bell,
  Mail,
  LogOut,
  Home,
  Shield,
  Radio,
  MessageSquare,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import ComingSoon from '../../components/ComingSoon';
// import UserManagement from './adminMenus/UserManagement';
// import CommunityManagement from './adminMenus/CommunityManagement';

const navigationItems = [
  { id: 'users', label: 'User Management', icon: Users, type: 'users' },
  { id: 'communities', label: 'Community Management', icon: UsersRound, type: 'communities' },
  { id: 'moderation', label: 'Content Moderation', icon: Shield, type: 'soon', title: 'Content Moderation' },
  { id: 'commentary', label: 'Live Commentary', icon: MessageSquare, type: 'soon', title: 'Live Commentary' },
  { id: 'watchgroups', label: 'Watch Groups', icon: Radio, type: 'soon', title: 'Watch Groups' },
  { id: 'analytics', label: 'Reporting & Analytics', icon: BarChart3, type: 'soon', title: 'Reporting & Analytics' },
  { id: 'support', label: 'Support Tools', icon: LifeBuoy, type: 'soon', title: 'Support Tools' },
];

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeItem = navigationItems.find((item) => item.id === activeTab) || navigationItems[0];

  const handleLogout = async () => {
    if (logout) {
      await logout();
    }
    navigate('/login');
  };

  const renderPanel = () => {
    // if (activeItem.type === 'users') return <UserManagement />;
    // if (activeItem.type === 'communities') return <CommunityManagement />;
    return <ComingSoon title={activeItem.title || activeItem.label} />;
  };

  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-300 font-sans flex flex-col md:flex-row">
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
          className="p-2 text-stone-400 hover:text-amber-400 rounded-lg bg-[#1a1714]"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#12100e] border-r border-stone-800/50 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:inset-auto md:flex md:flex-col ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
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
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
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

      <div className="flex-1 flex flex-col min-w-0">
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
            <img
              src={
                user?.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'
              }
              alt="Avatar"
              className="w-8 h-8 rounded-full ring-2 ring-amber-500/40 object-cover"
            />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-6xl w-full mx-auto">
          {renderPanel()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
