import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { SiteContactProvider } from '../../context/SiteContactContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { ToastProvider } from '../../shared/components/feedback/ToastContext';
import WatermarkDownloadGuard from '../../shared/components/media/WatermarkDownloadGuard';
import CompleteProfilePrompt from '../../shared/components/CompleteProfilePrompt';
import { EntitlementProvider } from '../../features/subscription/context/EntitlementContext';

export default function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <EntitlementProvider>
          <SiteContactProvider>
            <NotificationProvider>
              <ToastProvider>
                <WatermarkDownloadGuard />
                <CompleteProfilePrompt />
                {children}
              </ToastProvider>
            </NotificationProvider>
          </SiteContactProvider>
        </EntitlementProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
