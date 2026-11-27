// Form primitives of the platform: labelled field with hint and inline error, input / select / textarea styles.
// No state of their own → usable in server pages (GET filter forms) and client forms alike.
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { ChevronDownIcon } from "./icons";

const frame = "rounded-lg border border-line bg-canvas text-[15px] focus-within:border-ink focus-within:ring-1 focus-within:ring-ink";
const invalid = "border-danger";

export function Field({
  id,
  label,
  required = false,
  hint,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid min-w-0 content-start gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[15px] font-medium">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[13px] leading-normal text-pretty text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[13px] leading-normal font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** aria wiring shared by the controls: describe by hint or error, mark invalid. */
function described(id: string, error?: string, hint?: boolean) {
  return { "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined };
}

type ControlExtras = { id: string; error?: string; hasHint?: boolean };

export function TextInput({ id, error, hasHint, className = "", ...input }: ControlExtras & Omit<InputHTMLAttributes<HTMLInputElement>, "id">) {
  return (
    <div className={`${frame} ${error ? invalid : ""} ${className}`}>
      <input id={id} className="h-11 w-full min-w-0 rounded-lg bg-transparent px-3.5 outline-none" {...described(id, error, hasHint)} {...input} />
    </div>
  );
}

export function Select({ id, error, hasHint, children, className = "", ...select }: ControlExtras & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">) {
  return (
    <div className={`${frame} relative flex items-center ${error ? invalid : ""} ${className}`}>
      <select
        id={id}
        className="h-11 w-full min-w-0 cursor-pointer appearance-none rounded-lg bg-canvas pr-10 pl-3.5 text-ink outline-none disabled:cursor-default"
        {...described(id, error, hasHint)}
        {...select}
      >
        {children}
      </select>
      <ChevronDownIcon size={18} className="pointer-events-none absolute right-3 flex-none" />
    </div>
  );
}

export function TextArea({ id, error, hasHint, className = "", ...textarea }: ControlExtras & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">) {
  return (
    <div className={`${frame} ${error ? invalid : ""} ${className}`}>
      <textarea
        id={id}
        className="scroll-thin block min-h-24 w-full min-w-0 resize-y rounded-lg bg-transparent px-3.5 py-2.5 leading-relaxed outline-none"
        {...described(id, error, hasHint)}
        {...textarea}
      />
    </div>
  );
}

/** Checkbox or radio with its label as one hit target. */
export function Choice({
  id,
  label,
  hint,
  type = "checkbox",
  ...input
}: { id: string; label: ReactNode; hint?: ReactNode; type?: "checkbox" | "radio" } & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type">) {
  return (
    <label htmlFor={id} className="flex min-h-9 cursor-pointer items-start gap-3 rounded-lg py-1 text-[15px]">
      <input id={id} type={type} className="mt-0.5 size-5 flex-none accent-brand" aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      <span className="min-w-0">
        <span className="font-medium">{label}</span>
        {hint && (
          <span id={`${id}-hint`} className="block text-[13px] leading-normal text-muted">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

/** Group of fields with a legend that reads like a sub-heading. */
export function FieldGroup({ legend, hint, children, error }: { legend: string; hint?: ReactNode; children: ReactNode; error?: string }) {
  return (
    <fieldset className="grid min-w-0 gap-2">
      <legend className="float-left w-full text-[15px] font-medium">{legend}</legend>
      {hint && <p className="clear-both text-[13px] leading-normal text-pretty text-muted">{hint}</p>}
      <div className="clear-both grid gap-1">{children}</div>
      {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
    </fieldset>
  );
}
