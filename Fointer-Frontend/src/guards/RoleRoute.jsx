import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessRoles, getDashboardPathForRole } from '../shared/lib/roles';

export default function RoleRoute({ children, roles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-fo-auth text-fo-muted text-sm">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessRoles(user.role, roles)) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return children;
}
