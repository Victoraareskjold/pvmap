"use client";

import React, { useState } from "react";
import { compassLabel } from "@/lib/roofs";

const DIRECTIONS = [
  { label: "N", deg: 0 },
  { label: "NØ", deg: 45 },
  { label: "Ø", deg: 90 },
  { label: "SØ", deg: 135 },
  { label: "S", deg: 180 },
  { label: "SV", deg: 225 },
  { label: "V", deg: 270 },
  { label: "NV", deg: 315 },
];

const nb = (n) => new Intl.NumberFormat("nb-NO").format(Math.round(n));

/**
 * One list for both sources. Roofs from Google come with a fixed geometry —
 * pitch and direction are measured, so they are shown, not edited. Roofs the
 * user drew are missing exactly those two, so there they are inputs.
 */
function RoofList({
  roofs,
  checked,
  panelCounts,
  minPanels,
  onToggle,
  onCount,
  onCountCommit,
  onAngleCommit,
  onUpdate,
  onDelete,
}) {
  const [openInfo, setOpenInfo] = useState(null);

  /* Skyveknappene fyrer `onChange` for hvert eneste steg mens man drar.
     Veiledningen skal ikke reagere på det — den venter til draget er
     sluppet, ellers hopper den videre idet man så vidt tar på knappen. */
  const commitProps = (commit) => ({
    onPointerUp: commit,
    onTouchEnd: commit,
    onKeyUp: commit,
  });

  return (
    <ul className="flex flex-col gap-3" data-tour="roof-list">
      {roofs.map((roof, i) => {
        const on = !!checked[roof.id];
        const count = panelCounts[roof.id] ?? roof.maxPanels;
        const production = (roof.efficiencyPerPanel || 0) * count;
        const tooSmall = roof.maxPanels < minPanels;

        return (
          <li
            key={roof.id}
            className="card overflow-hidden"
            style={{ opacity: tooSmall ? 0.6 : 1 }}
          >
            <div className="flex items-start gap-3 p-4">
              {/* En for liten flate er ikke et valg brukeren kan ta — den
                  vises som utkrysset i stedet for som en avslått boks man
                  lurer på hvorfor ikke lar seg hake av. */}
              {tooSmall ? (
                <span
                  aria-hidden
                  title="For liten flate — ikke med i beregningen"
                  className="mt-1 flex h-4 w-4 items-center justify-center rounded border text-[11px] font-bold leading-none"
                  style={{
                    borderColor: "var(--line)",
                    color: "var(--ink-soft)",
                  }}
                >
                  ×
                </span>
              ) : (
                <input
                  type="checkbox"
                  id={`roof-${roof.id}`}
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  checked={on}
                  onChange={(e) => onToggle(roof.id, e.target.checked)}
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: roof.rating.color }}
                  />
                  <label
                    htmlFor={tooSmall ? undefined : `roof-${roof.id}`}
                    className="text-sm font-semibold"
                    style={{
                      cursor: tooSmall ? "default" : "pointer",
                      textDecoration: tooSmall ? "line-through" : "none",
                    }}
                  >
                    Tak {i + 1}
                  </label>
                  <span className="text-sm" style={{ color: "var(--ink-soft)" }}>
                    {compassLabel(roof.direction)} · {Math.round(roof.angle)}°
                    helning · {nb(roof.area)} m²
                  </span>
                  <span className="tag whitespace-nowrap">
                    {tooSmall ? "Ikke med i beregningen" : roof.rating.label}
                  </span>
                </div>

                <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                  {tooSmall
                    ? `For liten flate — bare plass til ${roof.maxPanels} paneler, og minst ${minPanels} skal til. Panelene her telles ikke med.`
                    : on
                      ? `${count} av ${roof.maxPanels} paneler · ${
                          roof.efficiencyPerPanel
                            ? `${nb(production)} kWh/år`
                            : "beregner produksjon…"
                        }`
                      : `Plass til ${roof.maxPanels} paneler`}
                </p>
              </div>

              {roof.source === "drawn" && (
                <button
                  onClick={() => onDelete(roof.id)}
                  title="Slett takflate"
                  className="px-1 text-lg leading-none"
                  style={{ color: "var(--ink-soft)" }}
                >
                  ×
                </button>
              )}
            </div>

            {on && !tooSmall && (
              <div
                className="flex flex-col gap-4 border-t px-4 py-4"
                style={{ borderColor: "var(--line)" }}
              >
                {/* Antall paneler */}
                <div className="flex items-center gap-3" data-tour="roof-panels">
                  <div className="relative">
                    <button
                      type="button"
                      className="hint-btn"
                      onClick={() =>
                        setOpenInfo((p) => (p === roof.id ? null : roof.id))
                      }
                    >
                      i
                    </button>
                    {openInfo === roof.id && (
                      <div className="hint-bubble">
                        <p>Areal: {nb(roof.area)} m²</p>
                        <p>
                          Retning: {compassLabel(roof.direction)} (
                          {Math.round(roof.direction)}°)
                        </p>
                        <p>Helning: {Math.round(roof.angle)}°</p>
                        <p>
                          Produksjon:{" "}
                          {roof.efficiencyPerPanel
                            ? `${roof.efficiencyPerPanel.toFixed(0)} kWh per panel`
                            : "beregnes"}
                        </p>
                        {roof.source === "google" && (
                          <p className="mt-1 opacity-70">
                            Geometrien er målt av Googles takanalyse.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <input
                    type="range"
                    min={Math.min(minPanels, roof.maxPanels)}
                    max={roof.maxPanels}
                    value={count}
                    onChange={(e) => onCount(roof.id, Number(e.target.value))}
                    {...commitProps(() => onCountCommit?.(roof.id))}
                  />
                  <span
                    className="shrink-0 rounded-md px-2 py-1 text-center text-sm font-semibold"
                    style={{
                      background: "var(--accent-soft)",
                      color: "var(--accent-dark)",
                      minWidth: "5.5rem",
                    }}
                  >
                    {count} paneler
                  </span>
                </div>

                {/* Retning og helning settes bare for tegnede flater */}
                {roof.source === "drawn" && (
                  <>
                    <div className="flex flex-col gap-1.5" data-tour="roof-direction">
                      <p className="card-title">Himmelretning</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {DIRECTIONS.map(({ label, deg }) => {
                          const active = roof.direction === deg;
                          return (
                            <button
                              key={label}
                              onClick={() => onUpdate(roof.id, { direction: deg })}
                              className="rounded-lg border py-1.5 text-sm font-medium transition-colors"
                              style={{
                                background: active ? "var(--accent)" : "#fff",
                                color: active ? "#3b2400" : "var(--ink)",
                                borderColor: active
                                  ? "var(--accent-dark)"
                                  : "var(--line)",
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5" data-tour="roof-angle">
                      <p className="card-title">Helning: {roof.angle}°</p>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        value={roof.angle}
                        onChange={(e) =>
                          onUpdate(roof.id, { angle: Number(e.target.value) })
                        }
                        {...commitProps(() => onAngleCommit?.(roof.id))}
                      />
                      <div
                        className="flex justify-between text-xs"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        <span>0° flatt</span>
                        <span>30°</span>
                        <span>60° bratt</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default React.memo(RoofList);
