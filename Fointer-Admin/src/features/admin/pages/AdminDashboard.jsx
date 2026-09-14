import { Suspense, lazy, useMemo } from 'react';
import {
  useNavigate,
  Routes,
  Route,
  Navigate,
  useLocation,
  Link,
} from 'react-router-dom';
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
  LuShoppingBag as ShoppingBag,
  LuUserCog as UserCog,
  LuTriangleAlert as AlertTriangle,
} from 'react-icons/lu';

import PanelShell from '../../../shared/layouts/PanelShell';
import { useAuth } from '../../../context/AuthContext';

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
const MarketplaceManagement = lazy(() => import('./menus/MarketplaceManagement'));
const AdminListingDetail = lazy(() => import('./menus/AdminListingDetail'));
const AdminManagement = lazy(() => import('./menus/AdminManagement'));
const WarningCenter = lazy(() => import('./menus/WarningCenter'));
const Profile = lazy(() => import('../../profile/pages/Profile'));

const UserNotifications = lazy(() =>
  import('../../communities/pages/dashboard/UserNotifications')
);

const pageFallback = (
  <div className="min-h-[30vh] flex items-center justify-center text-fo-muted text-sm">
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
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  { id: 'analytics', label: 'Reporting & Analytics', icon: BarChart3 },
  { id: 'warnings', label: 'Warnings', icon: AlertTriangle },
  { id: 'support', label: 'Support Tools', icon: LifeBuoy },
  { id: 'admins', label: 'Admin Management', icon: UserCog },
  { id: 'settings', label: 'System Settings', icon: Settings },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

const getPathTab = (pathname) => {
  const segment = pathname.replace(/^\//, '').split('/')[0] || '';
  if (segment === 'subchannels') return 'channels';
  if (segment === 'notifications') return 'notifications';
  return segment;
};

function TabRoute({ tab, fallbackTo, children, soft = false }) {
  const { canAccessTab } = useAuth();
  if (!canAccessTab(tab)) {
    if (soft) {
      return (
        <div className="w-full max-w-md mx-auto py-16 px-4 text-center space-y-3">
          <p className="text-sm text-fo-text font-medium">
            You do not have access to this section.
          </p>
          <p className="text-xs text-fo-subtle">
            Ask a super admin to grant the required tab, or go back to a section
            you can use.
          </p>
          <Link
            to={`/${fallbackTo}`}
            className="inline-flex text-xs font-semibold text-fo-accent hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      );
    }
    return <Navigate to={`/${fallbackTo}`} replace />;
  }
  return children;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessTab } = useAuth();

  const allowedNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => canAccessTab(item.id)),
    [canAccessTab]
  );

  const defaultTab = allowedNavItems[0]?.id || 'profile';
  const pathTab = getPathTab(location.pathname);
  const activeTab =
    allowedNavItems.some((item) => item.id === pathTab) ? pathTab : defaultTab;

  const navItems = useMemo(
    () =>
      allowedNavItems.map((item) => ({
        ...item,
        isActive: activeTab === item.id,
      })),
    [allowedNavItems, activeTab]
  );

  // Deep-link / unknown segment without access → first allowed tab
  if (
    pathTab &&
    pathTab !== 'notifications' &&
    !canAccessTab(pathTab) &&
    NAV_ITEMS.some((item) => item.id === pathTab)
  ) {
    return <Navigate to={`/${defaultTab}`} replace />;
  }

  return (
    <PanelShell
      navItems={navItems}
      onSelectNav={(id) => navigate(`/${id}`)}
      homeTo={`/${defaultTab}`}
      profileTo="/profile"
      notificationsTo="/notifications"
      logoutTo="/login"
    >
      <Suspense fallback={pageFallback}>
        <Routes>
          <Route
            path="/"
            element={<Navigate to={`/${defaultTab}`} replace />}
          />
          <Route
            path="notifications"
            element={
              <UserNotifications onBack={() => navigate(`/${defaultTab}`)} />
            }
          />
          <Route
            path="users"
            element={
              <TabRoute tab="users" fallbackTo={defaultTab}>
                <UserManagement />
              </TabRoute>
            }
          />
          <Route
            path="users/:id"
            element={
              <TabRoute tab="users" fallbackTo={defaultTab}>
                <UserDetail />
              </TabRoute>
            }
          />
          <Route
            path="communities"
            element={
              <TabRoute tab="communities" fallbackTo={defaultTab}>
                <CommunityManagement />
              </TabRoute>
            }
          />
          <Route
            path="communities/:id/posts/:postId"
            element={
              <TabRoute tab="communities" fallbackTo={defaultTab}>
                <AdminCommunityPostPage />
              </TabRoute>
            }
          />
          <Route
            path="communities/:id"
            element={
              <TabRoute tab="communities" fallbackTo={defaultTab}>
                <CommunityDetail />
              </TabRoute>
            }
          />
          <Route
            path="channels"
            element={
              <TabRoute tab="channels" fallbackTo={defaultTab}>
                <ChannelManagement />
              </TabRoute>
            }
          />
          <Route
            path="subchannels"
            element={
              <TabRoute tab="channels" fallbackTo={defaultTab}>
                <Navigate to="/channels?tab=subchannels" replace />
              </TabRoute>
            }
          />
          <Route
            path="moderation"
            element={
              <TabRoute tab="moderation" fallbackTo={defaultTab}>
                <ContentModeration />
              </TabRoute>
            }
          />
          <Route
            path="marketplace/:listingId"
            element={
              <TabRoute tab="marketplace" fallbackTo={defaultTab}>
                <AdminListingDetail />
              </TabRoute>
            }
          />
          <Route
            path="marketplace"
            element={
              <TabRoute tab="marketplace" fallbackTo={defaultTab}>
                <MarketplaceManagement />
              </TabRoute>
            }
          />
          <Route
            path="commentary"
            element={
              <TabRoute tab="commentary" fallbackTo={defaultTab}>
                <LiveEventManagement />
              </TabRoute>
            }
          />
          <Route
            path="watchgroups"
            element={
              <TabRoute tab="watchgroups" fallbackTo={defaultTab}>
                <WatchGroupManagement />
              </TabRoute>
            }
          />
          <Route
            path="analytics"
            element={
              <TabRoute tab="analytics" fallbackTo={defaultTab}>
                <ReportingAnalytics />
              </TabRoute>
            }
          />
          <Route
            path="warnings"
            element={
              <TabRoute tab="warnings" fallbackTo={defaultTab}>
                <WarningCenter />
              </TabRoute>
            }
          />
          <Route
            path="support"
            element={
              <TabRoute tab="support" fallbackTo={defaultTab}>
                <SupportTicketCenter />
              </TabRoute>
            }
          />
          <Route
            path="admins"
            element={
              <TabRoute tab="admins" fallbackTo={defaultTab}>
                <AdminManagement />
              </TabRoute>
            }
          />
          <Route
            path="settings"
            element={
              <TabRoute tab="settings" fallbackTo={defaultTab}>
                <SystemSettings />
              </TabRoute>
            }
          />
          <Route
            path="profile"
            element={
              <TabRoute tab="profile" fallbackTo={defaultTab}>
                <Profile />
              </TabRoute>
            }
          />
          <Route path="*" element={<Navigate to={`/${defaultTab}`} replace />} />
        </Routes>
      </Suspense>
    </PanelShell>
  );
};

export default AdminDashboard;
