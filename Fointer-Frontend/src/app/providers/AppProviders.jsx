import { AuthProvider } from '../../context/AuthContext';
import { SiteContactProvider } from '../../context/SiteContactContext';
import { ToastProvider } from '../../shared/components/feedback/ToastContext';

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <SiteContactProvider>
        <ToastProvider>{children}</ToastProvider>
      </SiteContactProvider>
    </AuthProvider>
  );
}
