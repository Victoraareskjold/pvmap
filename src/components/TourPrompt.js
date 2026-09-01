"use client";

/**
 * Invitasjonen som møter brukeren første gang kartet åpnes.
 *
 * Ligger midt på skjermen fordi den skal være umulig å overse — men den er
 * lett å avvise, og valget huskes, så den aldri blir en dør man må lukke hver
 * gang. Videoknappen hører hjemme her ved siden av «Start veiledning» når
 * opptaket finnes.
 */
export default function TourPrompt({ onStart, onDismiss }) {
  return (
    <>
      <div className="overlay" onClick={onDismiss} />
      <div className="modal card flex w-[min(24rem,92vw)] flex-col gap-4 p-6 text-center">
        <h2 className="text-xl font-semibold">
          Vil du ha hjelp til å komme i gang?
        </h2>
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          Veiledningen tar deg gjennom hele prosjekteringen steg for steg — du
          gjør handlingen, og den går videre av seg selv.
        </p>
        <button className="btn btn-primary w-full" onClick={onStart}>
          Start veiledning
        </button>
        <button
          className="text-sm underline"
          style={{ color: "var(--ink-soft)" }}
          onClick={onDismiss}
        >
          Nei takk, jeg finner ut av det selv
        </button>
      </div>
    </>
  );
}
