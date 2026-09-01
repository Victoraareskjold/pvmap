"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * The single address search in the app. The landing page uses the "hero"
 * variant, the map header the "compact" one — same component, so a fix to
 * the debounce or the empty state lands on both.
 *
 * Selecting a hit navigates to /map with the coordinates in the URL. That
 * keeps the result page shareable and reloadable, and lets the dashboard
 * deep-link straight into it.
 */
export default function AddressSearch({ variant = "hero", autoFocus = false }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const site = searchParams.get("site");
  const preAdr = searchParams.get("preAdr");
  const aerial = searchParams.get("aerial");

  const [query, setQuery] = useState(preAdr || "");
  const [results, setResults] = useState([]);
  const [state, setState] = useState("idle"); // idle | searching | done | error
  const [open, setOpen] = useState(false);
  const skipNext = useRef(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (query.trim().length < 3) {
      setResults([]);
      setState("idle");
      return;
    }

    setState("searching");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.addresses ?? []);
        setOpen(true);
        setState(data.error ? "error" : "done");
      } catch (e) {
        if (e.name === "AbortError") return;
        setResults([]);
        setState("error");
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close the dropdown when the user clicks elsewhere
  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const select = (address) => {
    skipNext.current = true;
    setQuery(address.text);
    setOpen(false);

    const params = new URLSearchParams({
      lat: String(address.lat),
      lng: String(address.lng),
      address: address.text,
    });
    if (address.id) params.set("addressId", String(address.id));
    if (site) params.set("site", site);
    if (preAdr) params.set("preAdr", preAdr);
    // Søker brukeren på en ny adresse inne i iframen, skal innstillingen
    // følge med — ellers slår flyfotoet seg på igjen ved første søk.
    if (aerial) params.set("aerial", aerial);

    router.push(`/map?${params.toString()}`);
  };

  const compact = variant === "compact";
  const noHits = state === "done" && results.length === 0 && query.length >= 3;

  return (
    <div
      ref={boxRef}
      className={`relative w-full ${compact ? "" : "max-w-xl"}`}
    >
      <div
        className={`card flex items-center gap-3 ${
          compact ? "px-3 py-1.5" : "px-5 py-4"
        }`}
        style={
          compact
            ? undefined
            : {
                borderColor: "var(--accent)",
                borderWidth: 2,
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.10)",
              }
        }
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className={compact ? "h-4 w-4" : "h-6 w-6"}
          style={{ color: "var(--accent)", flexShrink: 0 }}
        >
          <path
            fill="currentColor"
            d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
          />
        </svg>
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) select(results[0]);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Søk på din adresse"
          className={`w-full bg-transparent outline-none ${
            compact ? "text-sm" : "text-lg font-medium"
          }`}
        />
        {state === "searching" && (
          <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
            søker…
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="card absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto p-1">
          {results.map((address) => (
            <li key={`${address.id}-${address.lat}`}>
              <button
                onClick={() => select(address)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--accent-soft)]"
              >
                {address.text}
              </button>
            </li>
          ))}
        </ul>
      )}

      {(noHits || state === "error") && (
        <p className="note mt-2">
          {state === "error"
            ? "Adressesøket svarte ikke. Prøv igjen om et øyeblikk."
            : "Vi fant ikke den adressen. Dobbeltsjekk skrivemåten og prøv igjen."}
        </p>
      )}
    </div>
  );
}
