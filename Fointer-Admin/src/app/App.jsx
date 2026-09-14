import React from 'react';
import { useLocation } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { scrollAppToTop } from '../shared/utils/scroll';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  React.useLayoutEffect(() => {
    scrollAppToTop();
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
