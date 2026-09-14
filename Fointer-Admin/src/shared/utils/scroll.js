export const APP_SCROLL_ID = 'app-scroll';

export function scrollAppToTop() {
  window.scrollTo(0, 0);
  const main = document.getElementById(APP_SCROLL_ID);
  if (main) main.scrollTop = 0;
}
