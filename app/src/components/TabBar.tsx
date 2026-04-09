export interface TabItem {
  id: string;
  label: string;
}

export function TabBar({
  items,
  activeIndex,
  onChange,
}: {
  items: TabItem[];
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-[5px] px-4 py-2 border-b border-border bg-bg shrink-0 max-h-[100px] overflow-y-auto"
      role="tablist"
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={i === activeIndex}
          onClick={() => onChange(i)}
          className={`font-mono text-[.6rem] px-[11px] py-1.5 rounded-lg border cursor-pointer transition-all whitespace-nowrap active:scale-[.97] ${
            i === activeIndex
              ? "border-accent-pink text-accent-pink bg-accent-pink/4"
              : "border-border bg-card text-txt-muted hover:border-border-hi hover:text-txt"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
