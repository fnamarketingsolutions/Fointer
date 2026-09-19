import { useEffect, useState } from "react";
import { LuArrowUp as ArrowUp } from "react-icons/lu";
import { APP_SCROLL_ID, scrollAppToTop } from "../utils/scroll";

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(APP_SCROLL_ID);
    if (!el) return undefined;

    const onScroll = () => setVisible(el.scrollTop > 360);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => scrollAppToTop({ smooth: true })}
      className="fixed bottom-5 right-4 z-40 w-10 h-10 rounded-full bg-fo-surface border border-fo-border text-fo-text shadow-[0_8px_24px_rgba(26,22,18,0.16)] hover:border-fo-accent/40 hover:text-fo-accent flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
      aria-label="Back to top"
      title="Back to top"
    >
      <ArrowUp size={18} aria-hidden />
    </button>
  );
}