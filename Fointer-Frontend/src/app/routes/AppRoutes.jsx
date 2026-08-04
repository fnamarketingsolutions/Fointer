import { Routes, Route, Navigate } from 'react-router-dom';
import SignUp from '../../features/auth/components/SignUp';
import Login from '../../features/auth/components/Login';
import HeroSection from '../../features/public/pages/home/HeroSection';
import AboutHero from '../../features/public/pages/about/AboutHero';
import ServiceHero from '../../features/public/pages/services/ServiceHero';
import ContactHero from '../../features/public/pages/contact/ContactHero';
import ProtectedRoute from '../../guards/ProtectedRoute';
import RoleRoute from '../../guards/RoleRoute';
import PrivacyPolicy from '../../features/public/pages/policies/PrivacyPolicy';
import TermsAndConditions from '../../features/public/pages/policies/TermsAndConditions';
import Dashboard from '../../features/communities/pages/dashboard/Dashboard';
import UserNotifications from '../../features/communities/pages/dashboard/UserNotifications';
import AdminDashboard from '../../features/admin/pages/AdminDashboard';
import HowToUse from '../../features/public/pages/policies/HowToUse';
import NetworkUseCase from '../../features/public/pages/policies/NetworkUseCase';
import UserAgreement from '../../features/public/pages/policies/UserAgreement';
import ContentPolicy from '../../features/public/pages/policies/ContentPolicy';
import CookiePolicy from '../../features/public/pages/policies/CookiePolicy';
import CodeOfConduct from '../../features/public/pages/policies/CodeofConduct';
import AllCommunities from '../../features/communities/pages/public/AllCommunities';
import CommunityBrowsePage from '../../features/communities/pages/public/CommunityBrowsePage';
import CommunityPostPage from '../../features/communities/pages/public/CommunityPostPage';
import AllPosts from '../../features/posts/pages/public/AllPosts';
import PublicPostPage from '../../features/posts/pages/public/PublicPostPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HeroSection />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />

      <Route path="/about" element={<AboutHero />} />
      <Route path="/services" element={<ServiceHero />} />
      <Route path="/contact-us" element={<ContactHero />} />
      <Route path="/communities" element={<AllCommunities />} />
      <Route path="/communities/:communityId/posts/:postId" element={<CommunityPostPage />} />
      <Route path="/communities/:id" element={<CommunityBrowsePage />} />
      <Route path="/posts" element={<AllPosts />} />
      <Route path="/posts/:postId" element={<PublicPostPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/how-to-use" element={<HowToUse />} />
      <Route path="/code-of-conduct" element={<CodeOfConduct />} />
      <Route path="/network-use-cases" element={<NetworkUseCase />} />
      <Route path="/user-agreement" element={<UserAgreement />} />
      <Route path="/content-policy" element={<ContentPolicy />} />
      <Route path="/cookie-policy" element={<CookiePolicy />} />

      <Route path="/admin-check" element={<Navigate to="/admin" replace />} />

      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['admin']}>
              <AdminDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/notifications"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['user']}>
              <UserNotifications />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['user', 'moderator']}>
              <Dashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
