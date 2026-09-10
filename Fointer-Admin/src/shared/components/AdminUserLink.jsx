import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from './feedback/ToastContext';

/**
 * Link to User Management detail when the admin has the users tab.
 * Without access: non-navigating control + toast (no hard bounce).
 */
export default function AdminUserLink({
  userId,
  children,
  className = '',
  fallbackLabel,
}) {
  const { canAccessTab } = useAuth();
  const { showToast } = useToast();
  const id = userId ? String(userId) : '';

  if (!id) return children || null;

  if (canAccessTab('users')) {
    return (
      <Link to={`/users/${id}`} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`${className} text-left cursor-default opacity-80`}
      title="User Management access required"
      onClick={() =>
        showToast(
          fallbackLabel ||
            'You do not have User Management access for this profile.'
        )
      }
    >
      {children}
    </button>
  );
}
