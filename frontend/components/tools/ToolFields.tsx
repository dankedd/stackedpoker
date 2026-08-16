"use client";

import { useId, useRef, type ReactNode, type RefObject } from "react";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";

/**
 * Shared form controls for the tools.
 *
 * Every field is a real `<label for>` + `<input>` pair — no placeholder-only
 * labelling, which disappears the moment somebody types and is invisible to a
 * screen reader.
 *
 * Input-change analytics fire ONCE per field per mount. Reporting every
 * keystroke would drown the GA4 property in events and tell you nothing
 * beyond "somebody typed".
 */

function useChangeReporter(toolSlug: string, field: string) {
  const reported = useRef(false);
  return () => {
    if (reported.current) return;
    reported.current = true;
    trackEvent(SEO_EVENTS.toolInputChange, { tool_slug: toolSlug, field });
  };
}

export function NumberField({
  toolSlug,
  label,
  value,
  onChange,
  min = 0,
  step = "any",
  unit,
  hint,
  invalid = false,
  inputRef,
}: {
  toolSlug: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  step?: number | "any";
  unit?: string;
  hint?: string;
  invalid?: boolean;
  /** Lets a caller move focus here — used by "add missing information". */
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const report = useChangeReporter(toolSlug, label);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          ref={inputRef}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => {
            report();
            onChange(event.target.value);
          }}
          className={`h-11 w-full rounded-md border bg-input px-3 text-sm tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            unit ? "pr-12" : ""
          } ${invalid ? "border-amber-500/60" : "border-border"}`}
        />
        {unit && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
          >
            {unit}
          </span>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextField({
  toolSlug,
  label,
  value,
  onChange,
  placeholder,
  hint,
  invalid = false,
  autoCapitalize = "characters",
  inputRef,
}: {
  toolSlug: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  invalid?: boolean;
  autoCapitalize?: "none" | "characters";
  /** Lets a caller move focus here — used by "add missing information". */
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const report = useChangeReporter(toolSlug, label);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => {
          report();
          onChange(event.target.value);
        }}
        className={`mt-1.5 h-11 w-full rounded-md border bg-input px-3 font-mono text-sm uppercase text-foreground placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          invalid ? "border-amber-500/60" : "border-border"
        }`}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * A group of mutually exclusive choices.
 *
 * `role="radiogroup"` with roving `aria-checked` rather than a `<select>`:
 * these are 2–5 short options that benefit from being visible at once, and
 * this keeps them operable by keyboard and announced correctly.
 */
export function ChoiceGroup<T extends string>({
  toolSlug,
  label,
  value,
  options,
  onChange,
}: {
  toolSlug: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  const report = useChangeReporter(toolSlug, label);

  return (
    <div>
      <span id={id} className="block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="mt-1.5 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                report();
                onChange(option.value);
              }}
              className={`h-9 rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Two-to-four column responsive grid — one column on a phone. */
export function FieldGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const className =
    cols === 2
      ? "sm:grid-cols-2"
      : cols === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-3";
  return <div className={`grid grid-cols-1 gap-4 ${className}`}>{children}</div>;
}
