import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LuArrowRight as ArrowRight } from "react-icons/lu";

function isInternalPath(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//");
}

function BannerCard({ banner }) {
  const hasText = Boolean(banner?.title || banner?.subtitle);
  const hasCta = Boolean(banner?.ctaLabel && banner?.ctaUrl);
  const ctaClass =
    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-fo-accent text-black text-[11px] font-semibold hover:bg-fo-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

  const cta = hasCta ? (
    isInternalPath(banner.ctaUrl) ? (
      <Link to={banner.ctaUrl} className={ctaClass}>
        {banner.ctaLabel}
        <ArrowRight size={12} aria-hidden />
      </Link>
    ) : (
      <a
        href={banner.ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={ctaClass}
      >
        {banner.ctaLabel}
        <ArrowRight size={12} aria-hidden />
      </a>
    )
  ) : null;

  return (
    <article className="relative min-w-0 w-full overflow-hidden rounded-xl border border-fo-border bg-fo-surface-2">
      <div className="relative w-full pt-[56.25%]">
        <div className="absolute inset-0">
          {banner?.imageUrl ? (
            <img
              src={banner.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-fo-surface-3 via-fo-surface-2 to-fo-accent/40" />
          )}
          {hasText || hasCta ? (
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          ) : null}
          {(hasText || hasCta) && (
            <div className="absolute inset-x-0 bottom-0 z-10 px-3 py-2.5 pointer-events-none">
              {banner.title ? (
                <h2 className="text-sm font-semibold tracking-tight text-white leading-snug line-clamp-1">
                  {banner.title}
                </h2>
              ) : null}
              {banner.subtitle ? (
                <p className="mt-0.5 text-xs text-white/80 leading-snug line-clamp-1">
                  {banner.subtitle}
                </p>
              ) : null}
              {cta ? (
                <div className="mt-1.5 pointer-events-auto">{cta}</div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function FeedHeroBanner({ banners = [], loading = false }) {
  const items = Array.isArray(banners)
    ? banners.filter(Boolean).slice(0, 3)
    : [];
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (loading || items.length === 0) return null;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const slideWidth = el.clientWidth;
    if (slideWidth <= 0) return;
    const index = Math.round(el.scrollLeft / slideWidth);
    setActiveIndex(Math.min(Math.max(index, 0), items.length - 1));
  };

  const goTo = (idx) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    setActiveIndex(idx);
  };

  return (
    <div className="w-full min-w-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((banner, i) => (
          <div
            key={banner.id || i}
            className="min-w-full shrink-0 snap-center"
          >
            <BannerCard banner={banner} />
          </div>
        ))}
      </div>
      {items.length > 1 ? (
        <div className="flex items-center justify-center gap-1.5 pt-2 md:hidden">
          {items.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to banner ${idx + 1}`}
              onClick={() => goTo(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === activeIndex
                  ? "w-4 bg-fo-accent"
                  : "w-1.5 bg-fo-border hover:bg-fo-subtle"
              }`}
            />
          ))}
        </div>
      ) : null}

      <div className="hidden md:grid grid-cols-3 gap-2.5 w-full min-w-0 items-start">
        {items.map((banner, i) => (
          <BannerCard key={banner.id || i} banner={banner} />
        ))}
      </div>
    </div>
  );
}
