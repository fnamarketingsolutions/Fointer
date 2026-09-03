import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { SiteContactProvider } from '../../context/SiteContactContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { ToastProvider } from '../../shared/components/feedback/ToastContext';

export default function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SiteContactProvider>
          <NotificationProvider>
            <ToastProvider>{children}</ToastProvider>
          </NotificationProvider>
        </SiteContactProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
