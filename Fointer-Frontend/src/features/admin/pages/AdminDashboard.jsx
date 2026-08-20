import { Suspense, lazy, useMemo } from 'react';
import { useNavigate, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import {
  LuChartColumn as BarChart3,
  LuUsers as Users,
  LuUsersRound as UsersRound,
  LuLifeBuoy as LifeBuoy,
  LuShield as Shield,
  LuRadio as Radio,
  LuMessageSquare as MessageSquare,
  LuUserRound as UserRound,
  LuLayers as Layers,
  LuSettings as Settings,
} from 'react-icons/lu';

import PanelShell from '../../../shared/layouts/PanelShell';

const UserManagement = lazy(() => import('./menus/UserManagement'));
const CommunityManagement = lazy(() => import('./menus/CommunityManagement'));
const ChannelManagement = lazy(() => import('./menus/ChannelManagement'));
const SupportTicketCenter = lazy(() => import('./menus/SupportTicketCenter'));
const LiveEventManagement = lazy(() => import('./menus/LiveEventManagement'));
const WatchGroupManagement = lazy(() => import('./menus/WatchGroupManagement'));
const ContentModeration = lazy(() => import('./menus/ContentModeration'));
const ReportingAnalytics = lazy(() => import('./menus/ReportingAnalytics'));
const UserDetail = lazy(() => import('./menus/UserDetail'));
const CommunityDetail = lazy(() => import('./menus/CommunityDetail'));
const AdminCommunityPostPage = lazy(() => import('./menus/AdminCommunityPostPage'));
const SystemSettings = lazy(() => import('./menus/SystemSettings'));
const Profile = lazy(() => import('../../profile/pages/Profile'));

const pageFallback = (
  <div className="min-h-[30vh] flex items-center justify-center text-[#A69B8D] text-sm">
    Loading...
  </div>
);

const NAV_ITEMS = [
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'communities', label: 'Community Management', icon: UsersRound },
  { id: 'channels', label: 'Channels Management', icon: Layers },
  { id: 'commentary', label: 'Live Events Management', icon: MessageSquare },
  { id: 'watchgroups', label: 'Watch Groups Management', icon: Radio },
  { id: 'moderation', label: 'Content Moderation', icon: Shield },
  { id: 'analytics', label: 'Reporting & Analytics', icon: BarChart3 },
  { id: 'support', label: 'Support Tools', icon: LifeBuoy },
  { id: 'settings', label: 'System Settings', icon: Settings },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

const getActiveTabFromPath = (pathname) => {
  const segment = pathname.replace(/^\/admin\/?/, '').split('/')[0] || 'users';
  return NAV_ITEMS.some((item) => item.id === segment) ? segment : 'users';
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = getActiveTabFromPath(location.pathname);

  const navItems = useMemo(
    () => NAV_ITEMS.map((item) => ({ ...item, isActive: activeTab === item.id })),
    [activeTab]
  );

  return (
    <PanelShell
      navItems={navItems}
      onSelectNav={(id) => navigate(`/admin/${id}`)}
      homeTo="/admin"
      profileTo="/admin/profile"
      logoutTo="/login"
    >
      <Suspense fallback={pageFallback}>
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
          <Route
            path="subchannels"
            element={<Navigate to="/admin/channels?tab=subchannels" replace />}
          />
          <Route path="moderation" element={<ContentModeration />} />
          <Route path="commentary" element={<LiveEventManagement />} />
          <Route path="watchgroups" element={<WatchGroupManagement />} />
          <Route path="analytics" element={<ReportingAnalytics />} />
          <Route path="support" element={<SupportTicketCenter />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="profile" element={<Profile />} />
        </Routes>
      </Suspense>
    </PanelShell>
  );
};

export default AdminDashboard;
