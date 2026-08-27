"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AddressSearch from "@/components/AddressSearch";
import PanelMengde from "@/components/PanelMengde";
import PriceEstimator from "@/components/PriceEstimator";
import RoofList from "@/components/RoofList";
import SelectOption from "@/components/SelectOption";
import SendModal from "@/components/SendModal";
import {
  FALLBACK_TEXT,
  MIN_PANELS,
  panelWatts,
  pvgisAspect,
  roofFromDrawing,
  roofsFromGoogle,
  updateDrawnRoof,
} from "@/lib/roofs";
import { rateSegment } from "@/lib/solar";

const SolarMap = dynamic(() => import("@/components/SolarMap"), { ssr: false });
const DrawMap = dynamic(() => import("@/components/DrawMap"), { ssr: false });

const ROOF_TYPES = [
  "Takstein (Dobbelkrummet)",
  "Takstein (Enkeltkrummet)",
  "Glassert takstein",
  "Flat takstein",
  "Shingel/Takpapp",
  "Trapes",
  "Flatt tak",
  "Integrert i taket",
  "Decra",
  "Bølgeblikk",
];
const PANEL_TYPES = [
  "Premium all black, 430W",
  "Performance all black, 460W Bifacial",
];

const LEGEND = [
  rateSegment(30, 180),
  rateSegment(30, 90),
  rateSegment(0, 180),
  rateSegment(30, 135),
  rateSegment(30, 0),
];

const nb = (n) => new Intl.NumberFormat("nb-NO").format(Math.round(n || 0));

export default function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const address = searchParams.get("address");
  const site = searchParams.get("site");
  const forceDraw = searchParams.get("draw") === "1";

  const center = useMemo(
    () =>
      lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
    [lat, lng]
  );

  // --- Roofs and source -------------------------------------------------
  const [mode, setMode] = useState("loading"); // loading | google | draw
  const [fallbackReason, setFallbackReason] = useState(null);
  const [building, setBuilding] = useState(null);
  const [googleRoofs, setGoogleRoofs] = useState([]);
  const [drawnRoofs, setDrawnRoofs] = useState([]);

  const [checked, setChecked] = useState({});
  const [panelCounts, setPanelCounts] = useState({});
  const [efficiency, setEfficiency] = useState({});

  // --- Choices ----------------------------------------------------------
  const [roofType, setRoofType] = useState(ROOF_TYPES[0]);
  const [panelType, setPanelType] = useState(PANEL_TYPES[0]);
  const [elPrice, setElPrice] = useState(1.5);

  // --- Economy ----------------------------------------------------------
  const [yearlyCost, setYearlyCost] = useState(0);
  const [yearlyCost2, setYearlyCost2] = useState(0);
  const [priceLoading, setPriceLoading] = useState(false);

  const [desiredKwh, setDesiredKwh] = useState("");
  const [coveragePercentage, setCoveragePercentage] = useState(40);
  const [errors, setErrors] = useState({ kwh: "", calculation: "" });
  const [showModal, setShowModal] = useState(false);
  const [openHint, setOpenHint] = useState(null);

  const summaryRef = useRef(null);

  /* ------------------------------------------------------------------
     1. Ask Google first. The route always answers 200 with an envelope,
        so "no coverage" and "quota spent" arrive as values, not errors,
        and both land the user in draw mode with an explanation.
  ------------------------------------------------------------------ */
  useEffect(() => {
    if (!center) return;
    if (forceDraw) {
      setMode("draw");
      setFallbackReason("manuelt");
      return;
    }

    let cancelled = false;
    setMode("loading");

    (async () => {
      try {
        const res = await fetch(`/api/solar?lat=${center.lat}&lng=${center.lng}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.status === "ok") {
          const roofs = roofsFromGoogle(data.building);
          if (roofs.length > 0) {
            setBuilding(data.building);
            setGoogleRoofs(roofs);
            // North-facing planes are off by default — they should not be
            // sold in, but the user can still switch them on.
            setChecked(
              Object.fromEntries(
                roofs.map((r) => [r.id, r.rating.key !== "north"])
              )
            );
            setPanelCounts(
              Object.fromEntries(roofs.map((r) => [r.id, r.maxPanels]))
            );
            setMode("google");
            return;
          }
        }
        setFallbackReason(data.reason ?? "ingen-dekning");
        setMode("draw");
      } catch {
        if (cancelled) return;
        setFallbackReason("feil");
        setMode("draw");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [center, forceDraw]);

  const roofs = mode === "google" ? googleRoofs : drawnRoofs;
  const roofsRef = useRef(roofs);
  useEffect(() => {
    roofsRef.current = roofs;
  }, [roofs]);

  /* ------------------------------------------------------------------
     2. Production per roof from PVGIS.

        The efficiency lives in its own map rather than on the roof
        objects: writing it back into `roofs` would retrigger this effect
        on its own result. The key below is what actually changes the
        answer — id, direction, pitch, capacity and panel wattage.
  ------------------------------------------------------------------ */
  const pvgisKey = useMemo(
    () =>
      roofs
        .map(
          (r) =>
            `${r.id}:${Math.round(r.direction)}:${Math.round(r.angle)}:${r.maxPanels}`
        )
        .join("|"),
    [roofs]
  );

  useEffect(() => {
    if (!center || !pvgisKey) {
      setEfficiency({});
      return;
    }
    let cancelled = false;
    const watts = panelWatts(panelType);

    const timer = setTimeout(async () => {
      const list = roofsRef.current;
      const result = {};

      await Promise.all(
        list.map(async (roof) => {
          if (roof.maxPanels < MIN_PANELS) return;
          // Flat roofs are mounted on tilted racks, so 0° would understate
          // them — and PVGIS rejects a zero tilt anyway.
          const tilt = roof.angle < 5 ? 15 : Math.round(roof.angle);
          const url =
            `/api/pvgis?lat=${center.lat}&lng=${center.lng}` +
            `&panelCount=${roof.maxPanels}&panelWattage=${watts}` +
            `&aspect=${pvgisAspect(roof.direction)}&angle=${tilt}`;
          try {
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            const yearly = data?.outputs?.totals?.fixed?.E_y;
            if (yearly) result[roof.id] = yearly / roof.maxPanels;
          } catch {
            /* roof keeps efficiency 0 and is shown as "beregner…" */
          }
        })
      );

      if (!cancelled) setEfficiency(result);
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pvgisKey, panelType, center]);

  const viewRoofs = useMemo(
    () =>
      roofs.map((r) => ({ ...r, efficiencyPerPanel: efficiency[r.id] ?? 0 })),
    [roofs, efficiency]
  );

  // --- Totals -----------------------------------------------------------
  const totalPanels = viewRoofs.reduce(
    (sum, r) => sum + (checked[r.id] ? panelCounts[r.id] ?? 0 : 0),
    0
  );
  const yearlyProd = viewRoofs.reduce(
    (sum, r) =>
      sum +
      (checked[r.id] ? (r.efficiencyPerPanel || 0) * (panelCounts[r.id] ?? 0) : 0),
    0
  );
  const potentialSaving = yearlyProd * elPrice;

  const checkedRoofData = useMemo(
    () =>
      viewRoofs
        .filter((r) => checked[r.id])
        .map((r) => ({
          roofId: r.id,
          adjustedPanelCount: panelCounts[r.id] ?? r.maxPanels,
          maxPanels: r.maxPanels,
          direction: r.direction,
          angle: r.angle,
        })),
    [viewRoofs, checked, panelCounts]
  );

  // --- Price from the pricing sheet ------------------------------------
  useEffect(() => {
    if (totalPanels === 0) {
      setYearlyCost(0);
      setYearlyCost2(0);
      return;
    }

    const timer = setTimeout(async () => {
      setPriceLoading(true);
      try {
        const res = await fetch("/api/googleSheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalPanels,
            selectedRoofType: roofType,
            selectedPanelType: panelType,
            site,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setYearlyCost(parseFloat(data.valueFromB2 || 0));
          setYearlyCost2(parseFloat(data.valueFromE2 || 0));
        }
      } catch (e) {
        console.error("Feil under henting av pris:", e);
      }
      setPriceLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [totalPanels, roofType, panelType, site]);

  // --- Roof interaction -------------------------------------------------
  const toggleRoof = useCallback((id, next) => {
    setChecked((prev) => {
      const on = next ?? !prev[id];
      return { ...prev, [id]: on };
    });
  }, []);

  const setCount = useCallback((id, count) => {
    setPanelCounts((prev) => ({ ...prev, [id]: count }));
  }, []);

  const handleRoofAdded = useCallback((drawing) => {
    const roof = roofFromDrawing(drawing);
    setDrawnRoofs((prev) => [...prev, roof]);
    setChecked((prev) => ({ ...prev, [roof.id]: true }));
    setPanelCounts((prev) => ({ ...prev, [roof.id]: roof.maxPanels }));
  }, []);

  const handleRoofUpdate = useCallback((id, changes) => {
    setDrawnRoofs((prev) =>
      prev.map((r) => (r.id === id ? updateDrawnRoof(r, changes) : r))
    );
  }, []);

  const handleRoofDelete = useCallback((id) => {
    setDrawnRoofs((prev) => prev.filter((r) => r.id !== id));
    setChecked((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPanelCounts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Keep the panel count within the capacity of the roof it belongs to
  useEffect(() => {
    setPanelCounts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const roof of roofs) {
        if (next[roof.id] === undefined || next[roof.id] > roof.maxPanels) {
          next[roof.id] = roof.maxPanels;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [roofs]);

  const switchToDraw = () => {
    setMode("draw");
    setFallbackReason("manuelt");
  };

  const switchToGoogle = () => {
    setMode("google");
    setFallbackReason(null);
  };

  /* Picks roofs from best to worst until the wanted production is covered. */
  const calculatePanels = (override = null) => {
    const wanted = Number(override ?? desiredKwh);
    if (!wanted || wanted <= 0 || Number.isNaN(wanted)) {
      setErrors({ kwh: "Skriv inn ønsket årlig strømforbruk (kWh).", calculation: "" });
      return;
    }
    setErrors({ kwh: "", calculation: "" });

    const need = (wanted * coveragePercentage) / 100;
    const capacity = viewRoofs.reduce(
      (sum, r) => sum + (r.efficiencyPerPanel || 0) * r.maxPanels,
      0
    );

    if (need > capacity) {
      const capped = Math.floor((capacity / coveragePercentage) * 100);
      setErrors({
        kwh: "",
        calculation: `Taket ditt dekker maksimalt ${nb(capped)} kWh.`,
      });
      setDesiredKwh(capped);
      if (capped !== wanted) setTimeout(() => calculatePanels(capped), 0);
      return;
    }

    let remaining = need;
    const nextChecked = {};
    const nextCounts = {};

    for (const roof of [...viewRoofs].sort(
      (a, b) => (b.efficiencyPerPanel || 0) - (a.efficiencyPerPanel || 0)
    )) {
      if (remaining <= 0) break;
      const panels = Math.min(
        Math.ceil(remaining / (roof.efficiencyPerPanel || 1)),
        roof.maxPanels
      );
      if (panels > 0) {
        nextChecked[roof.id] = true;
        nextCounts[roof.id] = panels;
        remaining -= panels * (roof.efficiencyPerPanel || 0);
      }
    }

    setChecked(nextChecked);
    setPanelCounts(nextCounts);
    if (window.innerWidth < 1024)
      summaryRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!center) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="card flex max-w-md flex-col gap-4 p-6 text-center">
          <p>Vi mangler koordinatene for adressen. Søk den opp på nytt.</p>
          <button className="btn btn-primary" onClick={() => router.push("/")}>
            Til søket
          </button>
        </div>
      </main>
    );
  }

  const detectedArrays = building?.solarPotential?.detectedArrays?.length ?? 0;
  const hintText = {
    prod: "Estimert produksjon er beregnet med PVGIS (2005–2020) for takets retning og helning.",
    saving: "Produksjon × din estimerte strømpris, inkludert nettleie.",
    cost: "Laveste sum er direktekjøp. Høyeste er med miljølån fordelt over 30 år.",
    kwh: "En gjennomsnittlig leilighet bruker 8 000–12 000 kWh per år, en enebolig 20 000–30 000 kWh.",
    coverage:
      "Anbefalt dekning er 30–60 % for husholdninger. Næringsbygg bør ligge på 80 % eller mer.",
  };

  const Hint = ({ id }) => (
    <span className="relative inline-flex">
      <button
        type="button"
        className="hint-btn"
        onClick={() => setOpenHint((p) => (p === id ? null : id))}
      >
        i
      </button>
      {openHint === id && <span className="hint-bubble">{hintText[id]}</span>}
    </span>
  );

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      {/* Topplinje */}
      <header
        className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <div className="min-w-0 flex-1">
          <p className="card-title">Adresse</p>
          <h1 className="truncate text-base font-semibold">
            {address || "Ukjent adresse"}
          </h1>
        </div>
        <div className="hidden w-72 md:block">
          <AddressSearch variant="compact" />
        </div>
        <button className="btn btn-dark" onClick={() => router.push("/")}>
          Nytt søk
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Kart */}
        <div className="map-box h-[48vh] shrink-0 lg:h-auto lg:flex-1 lg:shrink">
          {mode === "loading" && (
            <div className="map-surface flex items-center justify-center">
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                Leter etter taket ditt…
              </p>
            </div>
          )}

          {mode === "google" && (
            <SolarMap
              center={center}
              building={building}
              roofs={viewRoofs}
              checked={checked}
              panelCounts={panelCounts}
              onToggle={toggleRoof}
            />
          )}

          {mode === "draw" && (
            <DrawMap
              center={center}
              roofs={viewRoofs}
              checked={checked}
              onToggle={toggleRoof}
              onRoofAdded={handleRoofAdded}
            />
          )}

          {/* Fargeforklaring — samme skala uansett kilde */}
          {mode !== "loading" && (
            <div className="card absolute bottom-3 right-3 z-20 hidden gap-1.5 p-3 md:flex md:flex-col">
              <p className="card-title">Egnethet</p>
              {LEGEND.map((r) => (
                <span key={r.key} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: r.color }}
                  />
                  {r.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Sidepanel */}
        <aside
          className="flex w-full flex-col gap-6 border-t p-4 lg:w-[27rem] lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0"
          style={{ borderColor: "var(--line)" }}
        >
          {/* Kilde og eventuell fallback */}
          {mode === "google" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="tag">Takflatene er hentet automatisk</span>
              <button
                className="text-sm underline"
                style={{ color: "var(--ink-soft)" }}
                onClick={switchToDraw}
              >
                Tegn takflatene selv i stedet
              </button>
            </div>
          )}

          {mode === "draw" && (
            <div className="flex flex-col gap-2">
              <div className="note">{FALLBACK_TEXT[fallbackReason] ?? FALLBACK_TEXT.manuelt}</div>
              {googleRoofs.length > 0 && (
                <button
                  className="self-start text-sm underline"
                  style={{ color: "var(--ink-soft)" }}
                  onClick={switchToGoogle}
                >
                  Tilbake til automatisk takanalyse
                </button>
              )}
            </div>
          )}

          {detectedArrays > 0 && mode === "google" && (
            <div className="note">
              Vi ser {detectedArrays} eksisterende solcelleanlegg på dette taket.
            </div>
          )}

          {/* 1 — Takflater */}
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Dine takflater</h2>
              {viewRoofs.length > 0 && (
                <span className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  {viewRoofs.length} flater
                </span>
              )}
            </div>

            {viewRoofs.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                {mode === "loading"
                  ? "Henter takdata…"
                  : "Ingen takflater ennå. Tegn den første i kartet med polygonverktøyet øverst til venstre."}
              </p>
            ) : (
              <RoofList
                roofs={viewRoofs}
                checked={checked}
                panelCounts={panelCounts}
                minPanels={MIN_PANELS}
                onToggle={toggleRoof}
                onCount={setCount}
                onUpdate={handleRoofUpdate}
                onDelete={handleRoofDelete}
              />
            )}
          </section>

          {/* 2 — Anlegget */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Ditt anlegg</h2>
            <div className="card flex flex-col gap-4 p-4">
              <SelectOption
                title="Taktype"
                options={ROOF_TYPES}
                onSelect={setRoofType}
              />
              <SelectOption
                title="Paneltype"
                options={PANEL_TYPES}
                onSelect={setPanelType}
              />
            </div>
            <PanelMengde selectedPanelType={panelType} totalPanels={totalPanels} />
            <PriceEstimator onSelect={setElPrice} />
          </section>

          {/* 3 — Behovskalkulator */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              Hvor mange paneler trenger du?
            </h2>
            <div className="card flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1.5">
                <label className="card-title">Ditt årlige forbruk</label>
                <div className="flex items-center gap-2">
                  <Hint id="kwh" />
                  <input
                    type="number"
                    className="field"
                    value={desiredKwh}
                    placeholder="27 500"
                    onChange={(e) => setDesiredKwh(e.target.value)}
                  />
                  <span className="text-sm" style={{ color: "var(--ink-soft)" }}>
                    kWh
                  </span>
                </div>
                {errors.kwh && (
                  <p className="text-sm text-red-600">{errors.kwh}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="card-title">Ønsket dekningsgrad</label>
                <div className="flex items-center gap-2">
                  <Hint id="coverage" />
                  <input
                    type="number"
                    className="field"
                    min={0}
                    max={100}
                    value={coveragePercentage}
                    onChange={(e) =>
                      setCoveragePercentage(
                        Math.min(100, Math.max(0, Number(e.target.value)))
                      )
                    }
                  />
                  <span className="text-sm" style={{ color: "var(--ink-soft)" }}>
                    %
                  </span>
                </div>
              </div>

              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                Med {nb(desiredKwh || 27500)} kWh i forbruk anbefaler vi en egen
                produksjon på{" "}
                <b style={{ color: "var(--ink)" }}>
                  {nb(((desiredKwh || 27500) * coveragePercentage) / 100)} kWh
                </b>
                .
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="btn btn-secondary"
                  onClick={() => calculatePanels()}
                  disabled={viewRoofs.length === 0}
                >
                  Beregn paneler for meg
                </button>
                {errors.calculation && (
                  <span className="text-sm text-red-600">
                    {errors.calculation}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Oppsummering — festet nederst i panelet */}
          <section
            ref={summaryRef}
            className="sticky bottom-0 -mx-4 mt-auto border-t px-4 pb-4 pt-4"
            style={{ borderColor: "var(--line)", background: "var(--bg)" }}
          >
            <div className="card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="card-title">Anlegget ditt</span>
                <span className="tag">{totalPanels} paneler</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm">
                  <Hint id="prod" /> Årlig produksjon
                </span>
                <b className="text-right">
                  {nb(yearlyProd * 0.95)}–{nb(yearlyProd * 1.05)} kWh
                </b>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm">
                  <Hint id="saving" /> Årlig besparelse
                </span>
                <b>{nb(potentialSaving)} kr</b>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm">
                  <Hint id="cost" /> Årlig kostnad over 30 år
                </span>
                <b className="text-right">
                  {priceLoading ? "beregner…" : `${nb(yearlyCost)}–${nb(yearlyCost2)} kr`}
                </b>
              </div>

              <button
                className="btn btn-primary w-full"
                onClick={() => setShowModal(true)}
                disabled={priceLoading || totalPanels < MIN_PANELS}
              >
                Jeg ønsker uforpliktende tilbud
              </button>
              {totalPanels < MIN_PANELS && (
                <p className="text-center text-xs" style={{ color: "var(--ink-soft)" }}>
                  Velg minst {MIN_PANELS} paneler for å be om tilbud.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {showModal && (
        <>
          <div className="overlay" onClick={() => setShowModal(false)} />
          <SendModal
            onClose={() => setShowModal(false)}
            toggleModal={() => setShowModal(false)}
            checkedRoofData={checkedRoofData}
            totalPanels={totalPanels}
            selectedElPrice={elPrice}
            selectedRoofType={roofType}
            selectedPanelType={panelType}
            yearlyProd={yearlyProd}
            yearlyCost={yearlyCost}
            yearlyCost2={yearlyCost2}
            address={address}
            site={site}
            desiredKWh={desiredKwh}
            coveragePercentage={coveragePercentage}
          />
        </>
      )}
    </div>
  );
}
