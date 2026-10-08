import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  useNavigate,
  Routes,
  Route,
  Navigate,
  useLocation,
  Link,
} from 'react-router-dom';
import { fetchAdminNavBadges } from '../services/adminService';
import {
  LuChartColumn as BarChart3,
  LuUsers as Users,
  LuUsersRound as UsersRound,
  LuLifeBuoy as LifeBuoy,
  LuHeadset as Headset,
  LuShield as Shield,
  LuRadio as Radio,
  LuMessageSquare as MessageSquare,
  LuUserRound as UserRound,
  LuLayers as Layers,
  LuSettings as Settings,
  LuShoppingBag as ShoppingBag,
  LuUserCog as UserCog,
  LuTriangleAlert as AlertTriangle,
  LuImage as ImageIcon,
  LuSparkles as Sparkles,
  LuUserPlus as UserPlus,
} from 'react-icons/lu';

import PanelShell from '../../../shared/layouts/PanelShell';
import { useAuth } from '../../../context/AuthContext';

const UserManagement = lazy(() => import('./menus/UserManagement'));
const CommunityManagement = lazy(() => import('./menus/CommunityManagement'));
const ChannelManagement = lazy(() => import('./menus/ChannelManagement'));
const SupportTicketCenter = lazy(() => import('./menus/SupportTicketCenter'));
const UserSupportManagement = lazy(() => import('./menus/UserSupportManagement'));
const LiveEventManagement = lazy(() => import('./menus/LiveEventManagement'));
const WatchGroupManagement = lazy(() => import('./menus/WatchGroupManagement'));
const ContentModeration = lazy(() => import('./menus/ContentModeration'));
const ReportingAnalytics = lazy(() => import('./menus/ReportingAnalytics'));
const UserDetail = lazy(() => import('./menus/UserDetail'));
const CommunityDetail = lazy(() => import('./menus/CommunityDetail'));
const AdminCommunityPostPage = lazy(() => import('./menus/AdminCommunityPostPage'));
const SystemSettings = lazy(() => import('./menus/SystemSettings'));
const BannerManagement = lazy(() => import('./menus/BannerManagement'));
const MarketplaceManagement = lazy(() => import('./menus/MarketplaceManagement'));
const SponsorshipManagement = lazy(() => import('./menus/SponsorshipManagement'));
const ReferralManagement = lazy(() => import('./menus/ReferralManagement'));
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
  { id: 'sponsorships', label: 'Sponsorships Management', icon: Sparkles },
  { id: 'referrals', label: 'Referrals', icon: UserPlus },
  { id: 'analytics', label: 'Reporting & Analytics', icon: BarChart3 },
  { id: 'warnings', label: 'Warnings', icon: AlertTriangle },
  { id: 'support', label: 'Support Tools', icon: LifeBuoy },
  { id: 'usersupport', label: 'User Support Management', icon: Headset },
  { id: 'banners', label: 'Banner Management', icon: ImageIcon },
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

const BADGE_TABS = new Set(['support', 'usersupport', 'analytics']);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessTab } = useAuth();
  const [navBadges, setNavBadges] = useState({});

  const allowedNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => canAccessTab(item.id)),
    [canAccessTab]
  );

  const defaultTab = allowedNavItems[0]?.id || 'profile';
  const pathTab = getPathTab(location.pathname);
  const activeTab =
    allowedNavItems.some((item) => item.id === pathTab) ? pathTab : defaultTab;

  useEffect(() => {
    let active = true;
    const needsBadges = allowedNavItems.some((item) => BADGE_TABS.has(item.id));
    if (!needsBadges) {
      setNavBadges({});
      return undefined;
    }

    const loadBadges = async () => {
      try {
        const data = await fetchAdminNavBadges();
        if (active) setNavBadges(data?.badges || {});
      } catch {
        if (active) setNavBadges({});
      }
    };

    loadBadges();
    const timer = setInterval(loadBadges, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [allowedNavItems, location.pathname]);

  const navItems = useMemo(
    () =>
      allowedNavItems.map((item) => ({
        ...item,
        isActive: activeTab === item.id,
        badge: BADGE_TABS.has(item.id) ? Number(navBadges[item.id]) || 0 : 0,
      })),
    [allowedNavItems, activeTab, navBadges]
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
            path="sponsorships"
            element={
              <TabRoute tab="sponsorships" fallbackTo={defaultTab}>
                <SponsorshipManagement />
              </TabRoute>
            }
          />
          <Route
            path="referrals"
            element={
              <TabRoute tab="referrals" fallbackTo={defaultTab}>
                <ReferralManagement />
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
            path="usersupport"
            element={
              <TabRoute tab="usersupport" fallbackTo={defaultTab}>
                <UserSupportManagement />
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
            path="banners"
            element={
              <TabRoute tab="banners" fallbackTo={defaultTab}>
                <BannerManagement />
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
