import { Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../shared/components/ThemeSpinner';

const DEFAULT_LOADING_CLASS = 'bg-fo-auth';

export default function ProtectedRoute({ children, loadingClassName = DEFAULT_LOADING_CLASS }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) return undefined;
    import('../features/auth/components/Login');
    return undefined;
  }, [loading, user]);

  if (loading) {
    return (
      <PageLoader
        minHeight="min-h-[50vh]"
        size="md"
        className={loadingClassName}
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
