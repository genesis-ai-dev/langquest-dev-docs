import { useRef } from "react";
import { cn } from "../../cn";

export function PanelResizeHandle({
  edge,
  width,
  onWidth,
}: {
  edge: "start" | "end";
  width: number;
  onWidth: (width: number) => void;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={cn(
        "absolute top-0 bottom-0 w-1.5 z-10 cursor-col-resize hover:bg-accent-purple/35",
        edge === "end" ? "right-0" : "left-0",
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        start.current = { x: e.clientX, w: width };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* automation / synthetic pointers */
        }
        const onMove = (ev: PointerEvent) => {
          if (!start.current) return;
          const dx = ev.clientX - start.current.x;
          onWidth(edge === "end" ? start.current.w + dx : start.current.w - dx);
        };
        const onUp = () => {
          start.current = null;
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }}
    />
  );
}
