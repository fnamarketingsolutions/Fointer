import { Suspense } from "react";
import { PageLoader } from "./ThemeSpinner";

/** Shown the moment a lazy route mounts — circle loader, theme-aware. */
export const routePageFallback = <PageLoader minHeight="min-h-[30vh]" size="md" />;

/** Wrap only lazy route elements so a tab switch can show Loading immediately. */
export default function RouteSuspense({ children, fallback = routePageFallback }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
