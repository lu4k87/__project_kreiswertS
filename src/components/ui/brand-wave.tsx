"use client";
// Logo wave: the class `kw-wave` (globals.css) runs once when the logo appears; a mouse touching the logo starts it
// again. Touch and pen stay still – a tap follows the link anyway. Reduced motion: the CSS switches the wave off.
import type { PointerEvent, ReactNode } from "react";

function replay(event: PointerEvent<HTMLSpanElement>) {
  if (event.pointerType !== "mouse") return;
  const el = event.currentTarget;
  el.classList.remove("kw-wave");
  void el.offsetWidth; // reflow, so the browser treats the class as new and starts the animation again
  el.classList.add("kw-wave");
}

export function BrandWave({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`kw-wave ${className ?? ""}`} onPointerEnter={replay}>
      {children}
    </span>
  );
}
