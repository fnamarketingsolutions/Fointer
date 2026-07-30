import React from 'react';
import { useLocation } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AppRoutes from './routes/AppRoutes';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const App = () => (
  <>
    <ScrollToTop />
    <PublicLayout>
      <AppRoutes />
    </PublicLayout>
  </>
);

export default App;
