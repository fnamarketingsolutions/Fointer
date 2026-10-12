import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { SiteContactProvider } from '../../context/SiteContactContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { ToastProvider } from '../../shared/components/feedback/ToastContext';
import WatermarkDownloadGuard from '../../shared/components/media/WatermarkDownloadGuard';

export default function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SiteContactProvider>
          <NotificationProvider>
            <ToastProvider>
              <WatermarkDownloadGuard />
              {children}
            </ToastProvider>
          </NotificationProvider>
        </SiteContactProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
