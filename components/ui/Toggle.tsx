export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[23px] w-10 shrink-0 rounded-full transition-colors duration-150 ${
        checked ? "bg-strong" : "bg-active"
      }`}
    >
      <div
        className="absolute top-[3.5px] h-4 w-4 rounded-full bg-paper shadow-sm transition-transform duration-150"
        style={{ transform: checked ? "translateX(21px)" : "translateX(4px)" }}
      />
    </button>
  );
}
