"use client";
// Menu of the platform header ("Create", account): a button that opens a small panel right below it (disclosure
// pattern – the panel holds links and buttons, so it is no ARIA "menu"). Keyboard: Enter / Space toggle, Arrow down /
// up open and move through the entries, Home / End jump, Escape closes and returns to the button, Tab walks on and
// closes when the focus leaves. A click outside or on a link closes it too.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type Props = {
  /** Content of the button (text and / or icons). */
  button: ReactNode;
  /** Accessible name when the button shows no text. */
  label?: string;
  buttonClassName: string;
  /** The entries: links and buttons. */
  children: ReactNode;
};

const ENTRIES = "a[href], button:not([disabled])";

export function HeaderMenu({ button, label, buttonClassName, children }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  /** Which entry gets the focus once the panel is shown (opened with an arrow key). */
  const focusOnOpen = useRef<"first" | "last" | null>(null);
  const panelId = useId();

  const entries = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(ENTRIES) ?? []);

  useEffect(() => {
    if (!open) return;
    if (focusOnOpen.current) {
      const list = entries();
      (focusOnOpen.current === "first" ? list[0] : list[list.length - 1])?.focus();
      focusOnOpen.current = null;
    }
    // a click or tap anywhere else closes the panel
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const onTrigger = event.target === trigger.current;
    if (!open) {
      if (!onTrigger || event.key === "Home" || event.key === "End") return;
      event.preventDefault();
      focusOnOpen.current = event.key === "ArrowDown" ? "first" : "last";
      setOpen(true);
      return;
    }
    const list = entries();
    if (list.length === 0) return;
    event.preventDefault();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home" ? 0
      : event.key === "End" ? list.length - 1
      : event.key === "ArrowDown" ? (index + 1) % list.length
      : index <= 0 ? list.length - 1 : index - 1;
    list[next].focus();
  }

  return (
    <div
      ref={root}
      // below 640 px the panel hangs on the row of header actions (its parent, `relative` there) instead of on its own
      // button: right-aligned to the content edge it always stays inside the screen, whichever button opened it
      className="relative flex-none max-sm:static"
      onKeyDown={onKeyDown}
      // the focus moved on to another element (Tab) → close; a click on empty space inside has no related target
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={panelId} aria-label={label} title={label} onClick={() => setOpen((value) => !value)} className={buttonClassName}>
        {button}
      </button>
      {/* Lies on the page on purpose (overlay below its button); max width keeps it inside a 360 px screen. */}
      <div
        ref={panel}
        id={panelId}
        data-audit-ignore
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a[href]")) setOpen(false);
        }}
        className={`${open ? "grid" : "hidden"} absolute top-full right-0 z-30 mt-2 w-max max-w-[calc(100vw-2.5rem)] min-w-[15.5rem] gap-0.5 rounded-xl border border-line bg-surface p-2 text-left shadow-[0_8px_24px_rgb(0_0_0/0.22)]`}
      >
        {children}
      </div>
    </div>
  );
}
