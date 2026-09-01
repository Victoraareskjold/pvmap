"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Interaktiv veiledning i Figma-stil.
 *
 * Hvert steg peker på et element i siden og venter på at brukeren faktisk
 * gjør handlingen — `done` kommer fra appens egen tilstand, ikke fra en
 * «Neste»-knapp. Da kan ikke veiledningen komme ut av synk med det brukeren
 * har foran seg.
 *
 * Overlegget er `pointer-events: none` med vilje: brukeren skal kunne klikke
 * hvor som helst, også utenfor det uthevede feltet. En veiledning som låser
 * skjermen er en felle når noen vil hoppe litt fram og tilbake.
 */

const PAD = 10;
const GAP = 14;
const CARD_W = 320;
const CARD_H_EST = 190;

function sameRect(a, b) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

export default function Tour({ steps, index, onIndex, onClose }) {
  const step = steps[index];
  const selector = step?.selector;
  const isLast = index === steps.length - 1;

  const [rect, setRect] = useState(null);
  const rectRef = useRef(null);
  const doneAtEntry = useRef(false);

  /* Følg målet. Kartet panorerer, sidepanelet scroller og takflater dukker
     opp underveis, så posisjonen måles per frame framfor å lytte på et utvalg
     hendelser vi uansett ikke ville truffet alle. */
  useEffect(() => {
    if (!selector) {
      rectRef.current = null;
      setRect(null);
      return;
    }
    let frame;
    const tick = () => {
      const el = document.querySelector(selector);
      const next = el?.getBoundingClientRect() ?? null;
      if (!sameRect(next, rectRef.current)) {
        rectRef.current = next;
        setRect(next);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [selector]);

  /* Rull målet inn i synsfeltet når steget starter. Elementet finnes ikke
     alltid med én gang — sidepanelet kan være scrollet et helt annet sted —
     så dette prøver på nytt hver gang målet blir målt, til det traff. */
  const scrolledFor = useRef(null);
  useEffect(() => {
    if (!selector || scrolledFor.current === selector) return;
    const el = document.querySelector(selector);
    if (!el) return;
    scrolledFor.current = selector;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selector, rect]);

  /* Var steget allerede oppfylt da vi kom hit? I så fall skal det ikke hoppe
     videre av seg selv — brukeren rakk ikke å lese det. */
  useEffect(() => {
    doneAtEntry.current = !!steps[index]?.done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  /* Noen steg går videre av seg selv når handlingen er gjort. Der brukeren
     skal lese og vurdere — velge taktekke, sette himmelretning — venter vi
     på «Neste» i stedet, ellers rives kortet vekk før det er lest. */
  useEffect(() => {
    if (!step?.done || doneAtEntry.current || step.autoAdvance === false) return;
    const timer = setTimeout(() => onIndex(index + 1), 750);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.done, step?.autoAdvance, index]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!step) return null;

  const spotlight = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  let card;
  if (!spotlight) {
    card = {
      top: window.innerHeight / 2 - CARD_H_EST / 2,
      left: window.innerWidth / 2 - CARD_W / 2,
    };
  } else {
    const below = spotlight.top + spotlight.height + GAP;
    const fitsBelow = below + CARD_H_EST < window.innerHeight;
    card = {
      top: fitsBelow ? below : Math.max(12, spotlight.top - GAP - CARD_H_EST),
      left: Math.min(
        Math.max(12, spotlight.left),
        Math.max(12, window.innerWidth - CARD_W - 12)
      ),
    };
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[1500]">
      {/* Uthevingen. Skyggen dekker resten av skjermen, så det trengs ikke
          noe eget bakteppe-element. Steg med `dim: false` beholder rammen,
          men lar sidene ligge klare — man kan ikke tegne i et dimmet kart. */}
      {spotlight && (
        <div
          className="absolute rounded-xl transition-all duration-300"
          style={{
            ...spotlight,
            boxShadow:
              step.dim === false
                ? "0 0 0 2px var(--accent)"
                : "0 0 0 9999px rgba(20, 16, 12, 0.55), 0 0 0 2px var(--accent)",
          }}
        />
      )}
      {!spotlight && step.dim !== false && (
        <div
          className="absolute inset-0"
          style={{ background: "rgba(20, 16, 12, 0.55)" }}
        />
      )}

      <div
        className="card pointer-events-auto absolute flex flex-col gap-3 p-4"
        style={{ ...card, width: CARD_W }}
        role="dialog"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="card-title">
            Steg {index + 1} av {steps.length}
          </span>
          <button
            onClick={onClose}
            className="text-sm underline"
            style={{ color: "var(--ink-soft)" }}
          >
            Avslutt
          </button>
        </div>

        <h3 className="text-base font-semibold">{step.title}</h3>
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          {step.body}
        </p>

        <div className="flex items-center gap-2">
          {index > 0 && (
            <button
              className="btn btn-secondary !px-3 !py-1.5 !text-xs"
              onClick={() => onIndex(index - 1)}
            >
              Tilbake
            </button>
          )}
          <div className="flex-1" />

          {/* Hinten forteller hva vi venter på, men steget kan alltid hoppes
              over — ingen skal stå fast fordi de ikke vil gjøre handlingen. */}
          {!step.done && step.waitFor && (
            <span
              className="text-xs font-medium"
              style={{ color: "var(--accent-dark)" }}
            >
              {step.waitFor}
            </span>
          )}
          <button
            className={`btn !px-3 !py-1.5 !text-xs ${
              step.done ? "btn-primary" : "btn-secondary"
            }`}
            onClick={() => (isLast ? onClose() : onIndex(index + 1))}
          >
            {isLast ? "Ferdig" : step.done ? "Neste" : "Hopp over"}
          </button>
        </div>
      </div>
    </div>
  );
}
