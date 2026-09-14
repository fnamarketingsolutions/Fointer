import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import logoDarkTheme from '../../assets/fointer-logo.png';
import logoLightTheme from '../../assets/logo-dark.png';

export default function BrandLogo({ to = '/' }) {
  const { isDark } = useTheme();
  const logoSrc = isDark ? logoDarkTheme : logoLightTheme;

  const mark = (
    <img
      src={logoSrc}
      alt="Fointer"
      className="h-12 sm:h-16 w-auto max-w-[7.5rem] object-contain shrink-0"
    />
  );

  if (!to) return mark;

  return (
    <Link
      to={to}
      className="inline-flex items-center shrink-0"
      title="Fointer Admin"
      aria-label="Fointer Admin home"
    >
      {mark}
    </Link>
  );
}
