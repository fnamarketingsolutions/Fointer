import { LuMoon as Moon, LuSun as Sun } from "react-icons/lu";
import { useTheme } from "../../context/ThemeContext";

export default function ThemeToggle({
  className = "",
  iconSize = 18,
  showLabel = false,
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-fo-border p-2 text-fo-muted transition-colors hover:border-fo-accent/40 hover:text-fo-accent ${className}`}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun size={iconSize} /> : <Moon size={iconSize} />}
      {showLabel ? (
        <span className="text-xs font-medium hidden sm:inline">
          {isDark ? "Light" : "Dark"}
        </span>
      ) : null}
    </button>
  );
}
