import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../../guards/ProtectedRoute';
import { PageLoader } from '../../shared/components/ThemeSpinner';

const AdminLogin = lazy(() =>
  import('../../features/auth/components/AdminLogin')
);
const AdminDashboard = lazy(() =>
  import('../../features/admin/pages/AdminDashboard')
);

export default function AppRoutes() {
  return (
    <Suspense
      fallback={
        <PageLoader minHeight="min-h-screen" size="md" className="bg-fo-auth" />
      }
    >
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
