/**
 * Shared compact action button used across admin list pages.
 */
export default function AdminActionBtn({
  onClick,
  disabled,
  tone = 'ghost',
  children,
  type = 'button',
  className = '',
  ...rest
}) {
  const tones = {
    ghost:
      'border border-fo-border text-fo-muted hover:text-fo-text hover:border-fo-accent/30',
    success:
      'border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10',
    danger: 'border border-red-500/30 text-red-400 hover:bg-red-500/10',
    accent:
      'border border-fo-accent/35 text-fo-accent hover:bg-fo-accent/10',
    primary:
      'border border-fo-accent/35 text-fo-accent hover:bg-fo-accent/10',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${tones[tone] || tones.ghost} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
