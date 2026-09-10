import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { userProfilePath } from "../services/profileLinks";

export default function UserProfileLink({
  author,
  children,
  className = "",
  stopPropagation = true,
  onClick,
}) {
  const { user } = useAuth();
  const to = userProfilePath(author, user);

  if (!to) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      to={to}
      className={className}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}
