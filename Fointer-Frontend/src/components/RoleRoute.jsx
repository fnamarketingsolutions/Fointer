import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessRoles, getDashboardPathForRole } from '../lib/roles';

export default function RoleRoute({ children, roles = [] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-[#130D08] text-gray-300 text-sm">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessRoles(user.role, roles)) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return children;
}
