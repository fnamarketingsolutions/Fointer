export const APP_SCROLL_ID = "app-scroll";

/** Reset window and the panel main scroller (feed lives in overflow-y-auto, not the window). */
export function scrollAppToTop({ smooth = false } = {}) {
  window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  const main = document.getElementById(APP_SCROLL_ID);
  if (!main) return;
  if (smooth) main.scrollTo({ top: 0, behavior: "smooth" });
  else main.scrollTop = 0;
}
