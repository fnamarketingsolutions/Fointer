import { Suspense } from "react";

/** Shown the moment a lazy route mounts — not while the previous page is kept. */
export const routePageFallback = (
  <div className="min-h-[30vh] flex items-center justify-center text-fo-muted text-sm">
    Loading...
  </div>
);

/** Wrap only lazy route elements so a tab switch can show Loading immediately. */
export default function RouteSuspense({ children, fallback = routePageFallback }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
