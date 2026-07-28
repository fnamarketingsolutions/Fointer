import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';

import Navbar from './components/Navbar';
import SignUp from './components/SignUp';
import Login from './components/Login';
import VerifyEmail from './components/VerifyEmail';
import HeroSection from './pages/homePage/HeroSection';
import AboutHero from './pages/aboutPage/AboutHero';
import Footer from './components/Footer';
import ServiceHero from './pages/servicePage/ServiceHero';
import ContactHero from './pages/contactPage/ContactInfo';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import PrivacyPolicy from './pages/policies/PrivacyPolicy';
import TermsAndConditions from './pages/policies/TermsAndConditions';
import Dashboard from './pages/dashboard/Dashboard';
import UserNotifications from './pages/dashboard/UserMenus/UserNotifications';
import AdminDashboard from './features/adminDashboard/AdminDashboard';
import HowToUse from './pages/policies/HowToUse';
import NetworkUseCase from './pages/policies/NetworkUseCase';
import UserAgreement from './pages/policies/UserAgreement';
import ContentPolicy from './pages/policies/ContentPolicy';
import CookiePolicy from './pages/policies/CookiePolicy';
import CodeOfConduct from './pages/policies/CodeofConduct';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const App = () => {
  const location = useLocation();

  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isLoginRoute = location.pathname.startsWith('/login');
  const isSignupRoute = location.pathname.startsWith('/signup');
  const isVerifyRoute = location.pathname.startsWith('/verify-email');

  return (
    <>
      <ScrollToTop />

      {!isDashboardRoute && !isAdminRoute && !isLoginRoute && !isSignupRoute && !isVerifyRoute && <Navbar />}

      <Routes>
        <Route path="/" element={<HeroSection />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route path="/about" element={<AboutHero />} />
        <Route path="/services" element={<ServiceHero />} />
        <Route path="/contact-us" element={<ContactHero />} />


         {/* policy pages */}
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
          path="/admin"
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
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RoleRoute roles={['user']}>
                <Dashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
      </Routes>

      {!isDashboardRoute && !isAdminRoute && !isLoginRoute && !isSignupRoute && !isVerifyRoute && <Footer />}
    </>
  );
};

export default App;
