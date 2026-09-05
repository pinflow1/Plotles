export function Stepper({
  value,
  onDecrease,
  onIncrease,
  min,
  max,
  unit = "",
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  min: number;
  max: number;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onDecrease}
        disabled={value <= min}
        aria-label="Decrease"
        className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] border-divider text-text transition-transform active:scale-90 disabled:opacity-30"
      >
        –
      </button>
      <span className="w-7 text-center text-sm tabular-nums text-text">
        {value}
        {unit}
      </span>
      <button
        onClick={onIncrease}
        disabled={value >= max}
        aria-label="Increase"
        className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] border-divider text-text transition-transform active:scale-90 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
