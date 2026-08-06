import { AuthProvider } from '../../context/AuthContext';
import { ToastProvider } from '../../shared/components/feedback/ToastContext';

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
