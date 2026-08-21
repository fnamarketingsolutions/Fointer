import { Link } from 'react-router-dom';
import logoSrc from '../../assets/fointer-logo.png';

export default function BrandLogo({ to = '/' }) {
  const mark = (
    <img
      src={logoSrc}
      alt="Fointer"
      className="h-10 w-8 sm:h-16 sm:w-14 object-contain rounded shrink-0"
    />
  );

  if (!to) return mark;

  return (
    <Link
      to={to}
      className="inline-flex items-center shrink-0"
      title="Fointer"
      aria-label="Fointer home"
    >
      {mark}
    </Link>
  );
}