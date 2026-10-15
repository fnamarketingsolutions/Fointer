/**
 * Two-column feed/marketplace layout.
 *
 * Uses PanelShell main scrolling + CSS sticky for the rail.
 * items-start keeps the sticky aside from stretching to feed height.
 */
export default function SplitScrollLayout({
  sidebar,
  children,
  sidebarWidthClass = 'lg:grid-cols-[minmax(0,1fr)_280px]',
  bp = 'lg',
  className = '',
}) {
  const showSidebar = bp === 'xl' ? 'xl:block' : 'lg:block';
  const gridCols =
    bp === 'xl'
      ? 'xl:grid-cols-[minmax(0,1fr)_300px]'
      : sidebarWidthClass;
  const sticky =
    bp === 'xl'
      ? 'xl:sticky xl:top-5 xl:self-start xl:z-[1] xl:max-h-[calc(100dvh-5.5rem)] xl:overflow-y-auto'
      : 'lg:sticky lg:top-5 lg:self-start lg:z-[1] lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto';

  return (
    <div
      className={`grid grid-cols-1 gap-4 items-start ${gridCols} ${className}`}
    >
      <div className="min-w-0">{children}</div>
      {sidebar ? (
        <aside className={`hidden ${showSidebar} ${sticky}`}>{sidebar}</aside>
      ) : null}
    </div>
  );
}
