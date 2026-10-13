import ProtectedRoute from './ProtectedRoute';

/** Blocks guests from auth-only dashboard sections; keeps return path. */
export default function AuthOnly({ children }) {
  return <ProtectedRoute loadingClassName="">{children}</ProtectedRoute>;
}
