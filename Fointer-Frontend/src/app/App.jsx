import React from 'react';
import { useLocation } from 'react-router-dom';
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
    <AppRoutes />
  </>
);

export default App;
