import { Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_LOADING_CLASS =
  'min-h-[50vh] flex items-center justify-center bg-fo-auth text-fo-muted text-sm';

export default function ProtectedRoute({ children, loadingClassName = DEFAULT_LOADING_CLASS }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) return undefined;
    import('../features/auth/components/Login');
    return undefined;
  }, [loading, user]);

  if (loading) {
    return <div className={loadingClassName}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
