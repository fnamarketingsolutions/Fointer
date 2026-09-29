import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminUser } from '../shared/lib/roles';

const DEFAULT_LOADING_CLASS =
  'min-h-[50vh] flex items-center justify-center bg-fo-auth text-fo-muted text-sm';

/**
 * Admin SPA gate — UI-only; every admin API must still use
 * isAuthenticated + authorize("admin") (+ tab gates) on the server.
 */
export default function ProtectedRoute({
  children,
  loadingClassName = DEFAULT_LOADING_CLASS,
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className={loadingClassName}>Loading...</div>;
  }

  if (!user || !isAdminUser(user)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
