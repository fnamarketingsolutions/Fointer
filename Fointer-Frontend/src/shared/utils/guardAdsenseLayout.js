/**
 * AdSense detects ads inside overflow:auto/scroll ancestors and injects
 * `height: auto !important` (and often `min-height: 0px !important`) on
 * flex/grid shells. That collapses h-dvh app chrome so the whole page —
 * including sidebars — scrolls together and CSS sticky dies.
 *
 * Inline !important cannot be overridden by stylesheets; strip it.
 */
function stripInjectedHeight(el) {
  if (!el?.style) return false;
  let changed = false;
  const height = el.style.getPropertyValue('height');
  const heightPri = el.style.getPropertyPriority('height');
  if (heightPri === 'important' && (height === 'auto' || height === '')) {
    el.style.removeProperty('height');
    changed = true;
  }
  const minHeight = el.style.getPropertyValue('min-height');
  const minPri = el.style.getPropertyPriority('min-height');
  if (
    minPri === 'important' &&
    (minHeight === '0px' || minHeight === '0' || minHeight === '')
  ) {
    el.style.removeProperty('min-height');
    changed = true;
  }
  return changed;
}

/**
 * @param {Array<Element | null | undefined>} elements
 * @returns {() => void} disconnect
 */
export function guardAdsenseLayout(elements) {
  const targets = [...new Set(elements.filter(Boolean))];
  if (!targets.length || typeof MutationObserver === 'undefined') {
    return () => {};
  }

  const fixAll = () => {
    for (const el of targets) stripInjectedHeight(el);
  };

  fixAll();

  const observer = new MutationObserver((mutations) => {
    let dirty = false;
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        if (stripInjectedHeight(mutation.target)) dirty = true;
      }
    }
    // AdSense sometimes re-applies in the same tick after we clear.
    if (dirty) queuePromise.resolve().then(fixAll);
  });

  for (const el of targets) {
    observer.observe(el, { attributes: true, attributeFilter: ['style'] });
  }

  return () => observer.disconnect();
}
