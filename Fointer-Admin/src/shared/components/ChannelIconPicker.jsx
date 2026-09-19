import { CHANNEL_ICONS, ChannelIconGlyph } from "../constants/channelIcons.jsx";

export default function ChannelIconPicker({
  value = "",
  onChange,
  disabled = false,
}) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1.5">
        Icon
      </label>
      <div className="grid grid-cols-7 gap-1.5 max-h-[168px] overflow-y-auto pr-0.5">
        {CHANNEL_ICONS.map((item) => {
          const active = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              disabled={disabled}
              onClick={() => onChange?.(active ? "" : item.id)}
              className={`h-9 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-50 ${
                active
                  ? "border-fo-accent bg-fo-accent/15 text-fo-accent"
                  : "border-fo-border text-fo-muted hover:text-fo-text hover:border-fo-accent/40"
              }`}
            >
              <item.Icon size={16} />
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-fo-subtle">
        {value ? (
          <span className="inline-flex items-center gap-1.5">
            <ChannelIconGlyph icon={value} size={12} />
            Selected
          </span>
        ) : (
          "Optional. Select an icon for the Feed."
        )}
      </p>
    </div>
  );
}
