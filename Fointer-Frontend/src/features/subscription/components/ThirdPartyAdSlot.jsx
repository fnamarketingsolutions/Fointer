import { useEffect, useRef, useState } from 'react';
import { useEntitlement } from '../context/EntitlementContext';

/**
 * Removable third-party display advertisement.
 * Distinct from Sponsored Marketplace Listings and first-party banners.
 *
 * Fixed slot sizes + overflow:clip (not hidden/auto) so AdSense does not
 * treat the wrapper as a scroll container and mutate PanelShell height.
 */
let adsenseScriptPromise = null;

const SLOT_SIZE = {
  rectangle: { width: '100%', height: 250, adFormat: 'rectangle' },
  horizontal: { width: '100%', height: 90, adFormat: 'horizontal' },
  auto: { width: '100%', height: 250, adFormat: 'rectangle' },
};

const loadAdsenseScript = (clientId) => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.adsbygoogle && document.getElementById('fointer-adsense')) {
    return Promise.resolve();
  }
  if (adsenseScriptPromise) return adsenseScriptPromise;

  adsenseScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('fointer-adsense');
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'fointer-adsense';
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('AdSense script failed to load'));
    document.head.appendChild(script);
  });
  return adsenseScriptPromise;
};

export default function ThirdPartyAdSlot({
  placement,
  className = '',
  format = 'rectangle',
}) {
  const { ads, shouldShowPlacement } = useEntitlement();
  const slotRef = useRef(null);
  const pushAttempted = useRef(false);
  const [status, setStatus] = useState('idle');

  const show = shouldShowPlacement(placement);
  const clientId = ads?.adsenseClientId || '';
  const slotId = ads?.slots?.[placement] || '';
  const provider = ads?.provider || 'none';
  const size = SLOT_SIZE[format] || SLOT_SIZE.rectangle;

  useEffect(() => {
    pushAttempted.current = false;
    setStatus('idle');
  }, [placement, clientId, slotId, show]);

  useEffect(() => {
    if (!show || provider === 'none' || !clientId || !slotId) {
      setStatus(show ? 'unconfigured' : 'hidden');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        setStatus('loading');
        await loadAdsenseScript(clientId);
        if (cancelled || pushAttempted.current) return;
        const node = slotRef.current;
        if (!node || node.getAttribute('data-adsbygoogle-status')) {
          if (!cancelled) setStatus('ready');
          return;
        }
        pushAttempted.current = true;
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [show, provider, clientId, slotId]);

  if (!show) return null;
  if (provider === 'none' || !clientId || !slotId) return null;

  return (
    <aside
      className={`fointer-third-party-ad w-full max-w-full min-w-0 border border-dashed border-fo-border/80 rounded-xl bg-fo-surface/60 ${className}`}
      aria-label="Advertisement"
      data-ad-placement={placement}
      data-ad-category="third_party_display"
      data-ad-status={status}
    >
      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-fo-subtle border-b border-fo-border/60">
        Advertisement
      </div>
      <div className="fointer-third-party-ad__frame w-full max-w-full min-w-0 overflow-clip">
        <ins
          ref={slotRef}
          className="adsbygoogle"
          style={{
            display: 'block',
            width: size.width,
            height: size.height,
            maxWidth: '100%',
          }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format={size.adFormat}
          data-full-width-responsive="false"
        />
      </div>
    </aside>
  );
}
