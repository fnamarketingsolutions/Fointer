/**
 * Circular loader that follows Fointer theme tokens (dark + light).
 * size: "sm" | "md" | "lg"
 */
export default function ThemeSpinner({
  size = "md",
  className = "",
  label = "Loading",
}) {
  const dims =
    size === "sm"
      ? "h-5 w-5 border-[2px]"
      : size === "lg"
        ? "h-10 w-10 border-[3px]"
        : "h-8 w-8 border-[2.5px]";

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block shrink-0 rounded-full border-fo-border border-t-fo-accent animate-spin ${dims} ${className}`}
    />
  );
}

/** Centered page / section loader — replaces "Loading..." text blocks. */
export function PageLoader({
  minHeight = "min-h-[30vh]",
  size = "md",
  className = "",
  label = "Loading",
}) {
  return (
    <div
      className={`${minHeight} w-full flex items-center justify-center ${className}`}
    >
      <ThemeSpinner size={size} label={label} />
    </div>
  );
}
