export type SegmentedOption<T extends string> = {
  value: T;
  label?: string;
  icon?: React.ReactNode;
  "aria-label"?: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-active p-[3px]">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-label={opt["aria-label"] ?? opt.label}
            aria-pressed={active}
            className={`flex h-7 min-w-7 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors duration-150 ${
              active ? "bg-strong text-on-strong" : "text-text-soft"
            }`}
          >
            {opt.icon ?? opt.label}
          </button>
        );
      })}
    </div>
  );
}
