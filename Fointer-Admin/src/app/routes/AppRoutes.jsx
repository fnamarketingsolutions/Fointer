import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../../guards/ProtectedRoute';

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
        <div className="min-h-screen flex items-center justify-center bg-fo-auth text-fo-muted text-sm">
          Loading...
        </div>
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
