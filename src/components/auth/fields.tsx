"use client";
// Shared form fields of the auth pages: framed input styles and a password input with show/hide toggle.
import { useState, type InputHTMLAttributes } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

const frame =
  "flex h-12 items-center rounded-lg border border-line focus-within:border-ink focus-within:ring-1 focus-within:ring-ink";
/** Field frame on the page background (login) … */
export const fieldClass = `${frame} bg-surface`;
/** … and inside a white card (register): fields take the page colour, as in Figma. */
export const cardFieldClass = `${frame} bg-canvas`;
export const inputClass = "h-full min-w-0 flex-1 rounded-lg bg-transparent px-4 text-[15px] outline-none";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  id: string;
  showLabel: string;
  hideLabel: string;
  frameClass?: string;
};

export function PasswordInput({ id, showLabel, hideLabel, frameClass = fieldClass, ...input }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={frameClass}>
      <input id={id} type={visible ? "text" : "password"} className={inputClass} {...input} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        aria-controls={id}
        className="mr-1.5 grid size-9 flex-none place-items-center rounded-md text-muted hover:text-ink"
      >
        {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
      </button>
    </div>
  );
}
