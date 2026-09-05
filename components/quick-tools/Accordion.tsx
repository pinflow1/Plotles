import { ChevronDown } from "lucide-react";

export function Accordion({
  id,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  value?: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button onClick={() => onToggle(id)} className="flex w-full items-center justify-between py-2.5 text-left">
        <span className="text-sm text-text">{label}</span>
        <span className="flex items-center gap-1.5 text-text-soft">
          {value && <span className="text-sm">{value}</span>}
          <ChevronDown size={14} strokeWidth={1.8} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <div className="overflow-hidden transition-[max-height] duration-200 ease-out" style={{ maxHeight: open ? 140 : 0 }}>
        {children}
      </div>
    </div>
  );
}
