import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminUser } from '../shared/lib/roles';
import { PageLoader } from '../shared/components/ThemeSpinner';

const DEFAULT_LOADING_CLASS = 'bg-fo-auth';

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
    return (
      <PageLoader
        minHeight="min-h-[50vh]"
        size="md"
        className={loadingClassName}
      />
    );
  }

  if (!user || !isAdminUser(user)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
