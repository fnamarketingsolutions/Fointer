import { DEFAULT_AVATAR } from '../constants/avatars';

export default function ProfileAvatar({
  src,
  alt,
  name,
  className = 'w-9 h-9 rounded-full object-cover border border-fo-border shrink-0',
}) {
  return (
    <img
      src={src || DEFAULT_AVATAR}
      alt={alt || name || 'User'}
      referrerPolicy="no-referrer"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = DEFAULT_AVATAR;
      }}
      className={className}
    />
  );
}
