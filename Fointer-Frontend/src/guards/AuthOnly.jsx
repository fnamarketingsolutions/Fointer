import React from 'react';
import ProtectedRoute from './ProtectedRoute';

const AUTH_ONLY_LOADING_CLASS =
  'min-h-[40vh] flex items-center justify-center text-[#A69B8D] text-sm';

/** Blocks guests from auth-only dashboard sections; keeps return path. */
export default function AuthOnly({ children }) {
  return (
    <ProtectedRoute loadingClassName={AUTH_ONLY_LOADING_CLASS}>
      {children}
    </ProtectedRoute>
  );
}
