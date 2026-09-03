import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../guards/ProtectedRoute';
import RoleRoute from '../../guards/RoleRoute';
import PublicSiteLayout from '../../shared/layouts/PublicSiteLayout';
import HomePage from '../../features/public/pages/home/HomePage';
import { SITE_LINKS } from '../../shared/constants/siteLinks';

const SignUp = lazy(() => import('../../features/auth/components/SignUp'));
const Login = lazy(() => import('../../features/auth/components/Login'));
const Dashboard = lazy(() =>
  import('../../features/communities/pages/dashboard/Dashboard')
);
const AdminDashboard = lazy(() =>
  import('../../features/admin/pages/AdminDashboard')
);

const AboutHero = lazy(() =>
  import('../../features/public/pages/about/AboutHero')
);
const ContactHero = lazy(() =>
  import('../../features/public/pages/contact/ContactHero')
);
const HowToUse = lazy(() =>
  import('../../features/public/pages/policies/HowToUse')
);
const NetworkUseCase = lazy(() =>
  import('../../features/public/pages/policies/NetworkUseCase')
);
const PrivacyPolicy = lazy(() =>
  import('../../features/public/pages/policies/PrivacyPolicy')
);
const TermsAndConditions = lazy(() =>
  import('../../features/public/pages/policies/TermsAndConditions')
);
const UserAgreement = lazy(() =>
  import('../../features/public/pages/policies/UserAgreement')
);
const ContentPolicy = lazy(() =>
  import('../../features/public/pages/policies/ContentPolicy')
);
const CookiePolicy = lazy(() =>
  import('../../features/public/pages/policies/CookiePolicy')
);
const CodeOfConduct = lazy(() =>
  import('../../features/public/pages/policies/CodeofConduct')
);

const PUBLIC_PAGE_ELEMENTS = {
  about: <AboutHero />,
  'contact-us': <ContactHero />,
  'how-to-use': <HowToUse />,
  'code-of-conduct': <CodeOfConduct />,
  'network-use-cases': <NetworkUseCase />,
  'privacy-policy': <PrivacyPolicy />,
  'terms-and-conditions': <TermsAndConditions />,
  'user-agreement': <UserAgreement />,
  'content-policy': <ContentPolicy />,
  'cookie-policy': <CookiePolicy />,
};

function RootHome() {
  return (
    <PublicSiteLayout>
      <HomePage />
    </PublicSiteLayout>
  );
}

export default function AppRoutes() {
  return (
    <Suspense>
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RootHome />} />

        <Route element={<PublicSiteLayout />}>
          {SITE_LINKS.map((link) => (
            <Route
              key={link.segment}
              path={link.to}
              element={PUBLIC_PAGE_ELEMENTS[link.segment]}
            />
          ))}
        </Route>

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

        <Route path="/*" element={<Dashboard />} />
      </Routes>
    </Suspense>
  );
}
