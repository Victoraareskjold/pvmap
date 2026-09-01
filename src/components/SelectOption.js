"use client";

/**
 * Controlled dropdown.
 *
 * Valgene kommer fra Supabase og er tomme ved første render. En intern
 * useState ville låst seg til den tomme lista og aldri tatt igjen — derfor
 * eier forelderen verdien.
 */
export default function SelectOption({ title, options = [], value, onSelect }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="card-title">{title}</span>
      <select
        className="field"
        value={value ?? ""}
        disabled={options.length === 0}
        onChange={(event) => onSelect?.(event.target.value)}
      >
        {options.length === 0 && <option value="">Henter…</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
