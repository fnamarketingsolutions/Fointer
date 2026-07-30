import { useLocation } from 'react-router-dom';
import Navbar from '../../shared/components/navigation/Navbar';
import Footer from '../../shared/components/navigation/Footer';

export default function PublicLayout({ children }) {
  const location = useLocation();
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isLoginRoute = location.pathname.startsWith('/login');
  const isSignupRoute = location.pathname.startsWith('/signup');
  const showChrome = !isDashboardRoute && !isAdminRoute && !isLoginRoute && !isSignupRoute;

  return (
    <>
      {showChrome && <Navbar />}
      {children}
      {showChrome && <Footer />}
    </>
  );
}
