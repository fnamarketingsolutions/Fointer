import { Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import SignUp from '../../features/auth/components/SignUp';
import Login from '../../features/auth/components/Login';
import ProtectedRoute from '../../guards/ProtectedRoute';
import RoleRoute from '../../guards/RoleRoute';
import Dashboard from '../../features/communities/pages/dashboard/Dashboard';
import UserNotifications from '../../features/communities/pages/dashboard/UserNotifications';
import AdminDashboard from '../../features/admin/pages/AdminDashboard';
import PublicPostPage from '../../features/posts/pages/public/PublicPostPage';

const toDashboard = (path) => (
  <Navigate to={`/dashboard${path}`} replace />
);

function LegacyFeedRedirect() {
  const { postSlug } = useParams();
  const [searchParams] = useSearchParams();
  const q = searchParams.toString();
  const base = postSlug ? `/post/${postSlug}` : '/';
  return <Navigate to={`${base}${q ? `?${q}` : ''}`} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />

      <Route path="/about" element={toDashboard('/about')} />
      <Route path="/services" element={<Navigate to="/" replace />} />
      <Route path="/contact-us" element={toDashboard('/contact-us')} />
      <Route
        path="/communities/*"
        element={<Navigate to="/dashboard/communities" replace />}
      />
      <Route path="/posts" element={<Navigate to="/" replace />} />
      <Route path="/posts/:postId" element={<PublicPostPage />} />
      <Route path="/privacy-policy" element={toDashboard('/privacy-policy')} />
      <Route
        path="/terms-and-conditions"
        element={toDashboard('/terms-and-conditions')}
      />
      <Route path="/how-to-use" element={toDashboard('/how-to-use')} />
      <Route path="/code-of-conduct" element={toDashboard('/code-of-conduct')} />
      <Route
        path="/network-use-cases"
        element={toDashboard('/network-use-cases')}
      />
      <Route path="/user-agreement" element={toDashboard('/user-agreement')} />
      <Route path="/content-policy" element={toDashboard('/content-policy')} />
      <Route path="/cookie-policy" element={toDashboard('/cookie-policy')} />

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
        path="/dashboard/postfeed/:postSlug?"
        element={<LegacyFeedRedirect />}
      />

      <Route path="/*" element={<Dashboard />} />
    </Routes>
  );
}
