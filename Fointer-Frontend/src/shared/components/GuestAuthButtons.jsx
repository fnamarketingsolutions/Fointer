import { Link, useLocation } from 'react-router-dom';
import { LuLogIn as LogIn, LuUserPlus as UserPlus } from 'react-icons/lu';

const LOGIN_CLASS =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2A241E] text-xs font-semibold text-[#E5E0D8] hover:border-[#D4AF37]/40 hover:text-[#D4AF37]';

const SIGNUP_CLASS =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold hover:bg-[#e0c04a]';

/** Guest Log in / Sign up — same look as the explore panel. */
export default function GuestAuthButtons({ from, className = '' }) {
  const location = useLocation();
  const fromPath = from ?? location.pathname;

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <Link to="/login" state={{ from: fromPath }} className={LOGIN_CLASS}>
        <LogIn size={14} /> Log in
      </Link>
      <Link to="/signup" className={SIGNUP_CLASS}>
        <UserPlus size={14} /> Sign up
      </Link>
    </div>
  );
}
