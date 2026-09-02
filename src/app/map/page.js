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
import SolarCompass from "@/components/SolarCompass";
import Tour from "@/components/Tour";
import TourPrompt from "@/components/TourPrompt";
import {
  FALLBACK_TEXT,
  MIN_PANELS,
  isRoofEligible,
  panelWatts,
  pvgisAspect,
  roofFromDrawing,
  roofsFromGoogle,
  updateDrawnRoof,
} from "@/lib/roofs";
import { RATING_SCALE } from "@/lib/solar";
import getPriceByCount from "../../../helpers/getPriceByCount";
import { calculatePricing } from "../../../hooks/calculatePricing";
import { usePanelTypes } from "../../../hooks/usePanelTypes";
import { usePricingData } from "../../../hooks/usePricingData";
import { useRoofTypes } from "../../../hooks/useRoofTypes";

const SolarMap = dynamic(() => import("@/components/SolarMap"), { ssr: false });
const DrawMap = dynamic(() => import("@/components/DrawMap"), { ssr: false });

/**
 * Uten `site` i URL-en vet vi ikke hvilken installatør besøket tilhører.
 * Regnearket falt tilbake på Vest Elektro Sol i det tilfellet, og prisene
 * her gjør det samme, så en direkte lenke til pvmap fortsatt gir et estimat.
 */
const DEFAULT_SITE = "example";

const nb = (n) => new Intl.NumberFormat("nb-NO").format(Math.round(n || 0));

export default function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const address = searchParams.get("address");
  // Mangler `site` i URL-en (typisk under testing) faller alt tilbake på
  // standardinstallatøren — ikke bare prisoppslaget. Med `null` videre i
  // appen sto prisen på 0 og lead-innsendingen krasjet på `site.toLowerCase()`.
  const site = searchParams.get("site") || DEFAULT_SITE;
  const forceDraw = searchParams.get("draw") === "1";

  /* Googles flyfoto er på for vanlige besøk. Dashboardet embedder pvmap i en
     iframe og slår det av med ?aerial=0 — laget hentes da ikke i det hele
     tatt, og knappen vises ikke. */
  const aerialParam = searchParams.get("aerial");
  const aerialEnabled = aerialParam !== "0" && aerialParam !== "false";

  const center = useMemo(
    () => (lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null),
    [lat, lng],
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
  // Tak- og paneltypene er de samme radene som prisene slås opp i, så begge
  // listene kommer fra Supabase. Hardkodede lister ville før eller siden
  // avvike fra navnene i basen, og da faller prisoppslaget tilbake til 0.
  const { roofTypes } = useRoofTypes();
  const { panelTypes } = usePanelTypes();
  const { pricingData, priceError } = usePricingData(site);

  const [roofType, setRoofType] = useState("");
  const [panelType, setPanelType] = useState("");
  const [elPrice, setElPrice] = useState(1.5);

  /* Hva brukeren har rukket å gjøre. Veiledningen leser dette for å vite når
     et steg er utført — den teller ikke klikk, den ser på resultatet. */
  const [touched, setTouched] = useState({
    panels: false,
    direction: false,
    angle: false,
    types: false,
  });

  const chooseRoofType = useCallback((value) => {
    setRoofType(value);
    setTouched((t) => ({ ...t, types: true }));
  }, []);

  const choosePanelType = useCallback((value) => {
    setPanelType(value);
    setTouched((t) => ({ ...t, types: true }));
  }, []);

  useEffect(() => {
    if (roofTypes.length > 0) setRoofType((prev) => prev || roofTypes[0].name);
  }, [roofTypes]);

  useEffect(() => {
    if (panelTypes.length > 0)
      setPanelType((prev) => prev || panelTypes[0].NAVN);
  }, [panelTypes]);

  // --- Economy ----------------------------------------------------------
  const [yearlyCost, setYearlyCost] = useState(0);
  const [yearlyCost2, setYearlyCost2] = useState(0);
  // Prisen regnes ut lokalt så snart tabellene er hentet — ingen runde til
  // serveren per endring, slik regnearket krevde.
  const priceLoading =
    !pricingData || panelTypes.length === 0 || roofTypes.length === 0;

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
        const res = await fetch(
          `/api/solar?lat=${center.lat}&lng=${center.lng}`,
        );
        const data = await res.json();
        if (cancelled) return;

        if (data.status === "ok") {
          const roofs = roofsFromGoogle(data.building);
          if (roofs.length > 0) {
            setBuilding(data.building);
            setGoogleRoofs(roofs);
            // North-facing planes are off by default — they should not be
            // sold in, but the user can still switch them on. Flater uten
            // plass til nok paneler er av og kan ikke slås på i det hele
            // tatt; de skal ikke bidra til totalen.
            setChecked(
              Object.fromEntries(
                roofs.map((r) => [
                  r.id,
                  isRoofEligible(r) && r.rating.key !== "north",
                ]),
              ),
            );
            setPanelCounts(
              Object.fromEntries(roofs.map((r) => [r.id, r.maxPanels])),
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
            `${r.id}:${Math.round(r.direction)}:${Math.round(r.angle)}:${r.maxPanels}`,
        )
        .join("|"),
    [roofs],
  );

  useEffect(() => {
    if (!center || !pvgisKey) {
      setEfficiency({});
      return;
    }
    let cancelled = false;
    // WATTAGE fra basen er fasiten; navneparsingen er bare en sikring hvis
    // paneltabellen ennå ikke er lastet.
    const watts =
      panelTypes.find((p) => p.NAVN === panelType)?.WATTAGE ??
      panelWatts(panelType);

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
        }),
      );

      if (!cancelled) setEfficiency(result);
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pvgisKey, panelType, panelTypes, center]);

  const viewRoofs = useMemo(
    () =>
      roofs.map((r) => ({ ...r, efficiencyPerPanel: efficiency[r.id] ?? 0 })),
    [roofs, efficiency],
  );

  // --- Totals -----------------------------------------------------------
  /* Bare flater som er både store nok og haket av teller. Kriteriet gjentas
     her selv om for små flater holdes uhaket lenger nede — totalen er tallet
     brukeren ser og prisen regnes av, og den skal aldri kunne dra med seg en
     flate listen har krysset ut. */
  const activeRoofs = useMemo(
    () => viewRoofs.filter((r) => isRoofEligible(r) && checked[r.id]),
    [viewRoofs, checked],
  );
  const excludedCount =
    viewRoofs.length - viewRoofs.filter(isRoofEligible).length;

  const totalPanels = activeRoofs.reduce(
    (sum, r) => sum + (panelCounts[r.id] ?? 0),
    0,
  );
  const yearlyProd = activeRoofs.reduce(
    (sum, r) => sum + (r.efficiencyPerPanel || 0) * (panelCounts[r.id] ?? 0),
    0,
  );
  const potentialSaving = yearlyProd * elPrice;

  const checkedRoofData = useMemo(
    () =>
      activeRoofs.map((r) => ({
        roofId: r.id,
        adjustedPanelCount: panelCounts[r.id] ?? r.maxPanels,
        maxPanels: r.maxPanels,
        direction: r.direction,
        angle: r.angle,
      })),
    [activeRoofs, panelCounts],
  );

  /* ------------------------------------------------------------------
     Price, straight from Supabase.

     Alle fire leddene slås opp på antall paneler i samme trinnskala
     ("0-72", "72-150", …): panelprisen per stk, takprisen per stk fra
     taktekket, installatørens fastbeløp og provisjonssatsen. Dashboardet
     priser sine egne leads og skal ikke ha et estimat herfra.
  ------------------------------------------------------------------ */
  useEffect(() => {
    if (site === "solarinstallationdashboard") return;
    if (totalPanels === 0 || priceLoading) {
      setYearlyCost(0);
      setYearlyCost2(0);
      return;
    }

    const panel = panelTypes.find((p) => p.NAVN === panelType);
    const { yearlyCostDirect, yearlyCostLoan } = calculatePricing({
      totalPanels,
      panelPrice: getPriceByCount(panel, totalPanels),
      roofPrice: roofTypes.find((r) => r.name === roofType)?.PRIS ?? 0,
      installerPrice: getPriceByCount(pricingData.installer, totalPanels),
      commissionRate: getPriceByCount(pricingData.commission, totalPanels),
      formula: Number(pricingData.installer?.FORMEL) || 0,
    });

    setYearlyCost(yearlyCostDirect);
    setYearlyCost2(yearlyCostLoan);
  }, [
    totalPanels,
    roofType,
    panelType,
    site,
    pricingData,
    panelTypes,
    roofTypes,
    priceLoading,
  ]);

  // --- Roof interaction -------------------------------------------------
  const toggleRoof = useCallback((id, next) => {
    // Kartet lar deg klikke rett på panelene. Er flaten for liten, skal det
    // klikket ikke kunne slå den på — den er krysset ut i listen.
    const roof = roofsRef.current.find((r) => r.id === id);
    if (roof && !isRoofEligible(roof)) return;
    setChecked((prev) => {
      const on = next ?? !prev[id];
      return { ...prev, [id]: on };
    });
  }, []);

  const setCount = useCallback((id, count) => {
    setPanelCounts((prev) => ({ ...prev, [id]: count }));
  }, []);

  // Skyveknappene melder fra når draget slippes, ikke mens det pågår.
  const commitCount = useCallback(
    () => setTouched((t) => (t.panels ? t : { ...t, panels: true })),
    [],
  );

  const commitAngle = useCallback(
    () => setTouched((t) => (t.angle ? t : { ...t, angle: true })),
    [],
  );

  const handleRoofAdded = useCallback((drawing) => {
    const roof = roofFromDrawing(drawing);
    setDrawnRoofs((prev) => [...prev, roof]);
    // En nytegnet flate som er for liten krysses ut med én gang i stedet for
    // å legge paneler til totalen brukeren så må finne og fjerne selv.
    setChecked((prev) => ({ ...prev, [roof.id]: isRoofEligible(roof) }));
    setPanelCounts((prev) => ({ ...prev, [roof.id]: roof.maxPanels }));
  }, []);

  const handleRoofUpdate = useCallback((id, changes) => {
    setDrawnRoofs((prev) =>
      prev.map((r) => (r.id === id ? updateDrawnRoof(r, changes) : r)),
    );
    // Retning er knapper — der er klikket i seg selv handlingen. Helning er
    // en skyveknapp, og den melder fra via commitAngle når draget slippes.
    if ("direction" in changes) {
      setTouched((t) => (t.direction ? t : { ...t, direction: true }));
    }
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

  /* Kapasiteten til en tegnet flate endrer seg med helningen, så en flate kan
     falle under grensen etter at den ble haket av. Da tas den ut av totalen
     her — listen krysser den ut samtidig. */
  useEffect(() => {
    setChecked((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const roof of roofs) {
        if (next[roof.id] && !isRoofEligible(roof)) {
          next[roof.id] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [roofs]);

  /* ------------------------------------------------------------------
     Interaktiv veiledning.

     Stegene er delt i to fordi de to modusene krever ulikt av brukeren:
     tegner man selv, må takflaten opprettes og retning/helning settes for
     hånd — henter Google taket, er begge deler allerede målt.
  ------------------------------------------------------------------ */
  const [tourStep, setTourStep] = useState(-1);
  const [promptSeen, setPromptSeen] = useState(true);
  // Settes idet polygonverktøyet tas i bruk, så uthevingen slutter å dimme
  // kartet man skal tegne i.
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    try {
      setPromptSeen(localStorage.getItem("pvmap.tourSeen") === "1");
    } catch {
      /* privat nettleservindu — da spør vi bare ikke */
    }
  }, []);

  const dismissPrompt = useCallback(() => {
    setPromptSeen(true);
    try {
      localStorage.setItem("pvmap.tourSeen", "1");
    } catch {
      /* ignorer */
    }
  }, []);

  const startTour = useCallback(() => {
    dismissPrompt();
    setTourStep(0);
  }, [dismissPrompt]);

  const tourSteps = useMemo(() => {
    const drawing = mode === "draw";
    const firstRoof = '[data-tour="roof-list"] > li:first-child';

    const steps = drawing
      ? [
          {
            id: "draw",
            // Faller tilbake på hele verktøylinja hvis Leaflet.Draw skulle
            // endre klassenavnet på polygonknappen.
            selector: ".leaflet-draw-draw-polygon, .leaflet-draw-toolbar",
            title: "Tegn den første takflaten",
            body: "Klikk på polygonverktøyet, og klikk deretter rundt kanten av én takflate i kartet. Dobbeltklikk for å lukke figuren.",
            waitFor: "Venter på at du tegner…",
            dim: !drawing,
            done: drawnRoofs.length > 0,
          },
          {
            id: "direction",
            selector: '[data-tour="roof-direction"]',
            title: "Hvilken vei vender taket?",
            body: "Velg himmelretningen flaten peker mot. Fargen på flaten oppdaterer seg med én gang — rødt er best, blått gir minst produksjon.",
            waitFor: "Velg en retning…",
            autoAdvance: false,
            done: touched.direction,
          },
          {
            id: "angle",
            selector: '[data-tour="roof-angle"]',
            title: "Sett takvinkelen",
            body: "Dra skyveknappen til omtrent riktig helning. De fleste norske tak ligger mellom 20° og 35°.",
            waitFor: "Juster helningen…",
            done: touched.angle,
          },
        ]
      : [
          {
            id: "roofs",
            selector: firstRoof,
            title: "Dette er takflatene dine",
            body: "Google har målt opp taket ditt. Hak av flatene du vil ha paneler på — nordvendte flater er slått av på forhånd.",
            done: true,
          },
        ];

    return [
      ...steps,
      {
        id: "panels",
        selector: '[data-tour="roof-panels"]',
        title: "Juster antall paneler",
        body: "Dra skyveknappen for å velge hvor mange paneler som skal stå på flaten. Produksjonen oppdaterer seg mens du drar.",
        waitFor: "Juster antallet…",
        done: touched.panels,
      },
      {
        id: "types",
        selector: '[data-tour="system-types"]',
        title: "Velg taktekke og paneltype",
        body: "Taktekket avgjør monteringskostnaden, og paneltypen avgjør både pris og produksjon. Begge påvirker prisen under.",
        waitFor: "Gjør et valg…",
        autoAdvance: false,
        done: touched.types,
      },
      {
        id: "consumption",
        selector: '[data-tour="consumption"]',
        title: "Legg inn forbruket ditt",
        body: "Skriv inn hvor mange kWh du bruker i året, så foreslår vi hvor mange paneler som dekker den andelen du ønsker.",
        waitFor: "Skriv inn forbruket…",
        autoAdvance: false,
        done: String(desiredKwh).length > 0,
      },
      {
        id: "summary",
        selector: '[data-tour="summary"]',
        title: "Her er resultatet",
        body: "Årlig produksjon, hva du sparer, og hva anlegget koster fordelt over 30 år — direkte kjøp og med lån.",
        // Rent informasjonssteg: ingenting å utføre, så knappen skal si
        // «Neste», ikke «Hopp over».
        done: true,
      },
      {
        id: "quote",
        selector: '[data-tour="quote"]',
        title: "Klar for et tilbud?",
        body: "Er du fornøyd med anlegget, ber du om et uforpliktende tilbud her. Vi tar ikke kontakt før du har spurt.",
        done: showModal,
      },
    ];
  }, [mode, drawing, drawnRoofs.length, touched, desiredKwh, showModal]);

  const advanceTour = useCallback(
    (next) => setTourStep(next < 0 || next >= tourSteps.length ? -1 : next),
    [tourSteps.length],
  );

  // Bytter brukeren modus midt i veiledningen, endres antallet steg under
  // føttene på oss — da avslutter vi heller enn å peke på tomme luften.
  useEffect(() => {
    if (tourStep >= tourSteps.length) setTourStep(-1);
  }, [tourStep, tourSteps.length]);

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
      setErrors({
        kwh: "Skriv inn ønsket årlig strømforbruk (kWh).",
        calculation: "",
      });
      return;
    }
    setErrors({ kwh: "", calculation: "" });

    const need = (wanted * coveragePercentage) / 100;
    // For små flater er ikke tilgjengelig kapasitet — verken i taket for hvor
    // mye adressen kan dekke eller i fordelingen under.
    const usable = viewRoofs.filter(isRoofEligible);
    const capacity = usable.reduce(
      (sum, r) => sum + (r.efficiencyPerPanel || 0) * r.maxPanels,
      0,
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

    for (const roof of [...usable].sort(
      (a, b) => (b.efficiencyPerPanel || 0) - (a.efficiencyPerPanel || 0),
    )) {
      if (remaining <= 0) break;
      const panels = Math.min(
        Math.ceil(remaining / (roof.efficiencyPerPanel || 1)),
        roof.maxPanels,
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
        <button
          className="btn btn-secondary"
          onClick={startTour}
          title="Gå gjennom verktøyet steg for steg"
        >
          Veiledning
        </button>
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
              aerial={aerialEnabled}
            />
          )}

          {mode === "draw" && (
            <DrawMap
              center={center}
              roofs={viewRoofs}
              checked={checked}
              onToggle={toggleRoof}
              onRoofAdded={handleRoofAdded}
              onDrawStart={() => setDrawing(true)}
            />
          )}

          {/* Fargeforklaring — samme skala uansett kilde */}
          {mode !== "loading" && (
            <div className="card absolute right-3 top-14 z-30 hidden gap-1.5 p-3 md:flex md:flex-col">
              <p className="card-title">Solpotensial</p>
              {RATING_SCALE.map((r) => (
                <span key={r.key} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: r.color }}
                  />
                  {r.label}
                </span>
              ))}
              <div
                className="mt-1 flex justify-center border-t pt-2"
                style={{ borderColor: "var(--line)" }}
              >
                <SolarCompass size={116} />
              </div>
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
              <div className="note">
                {FALLBACK_TEXT[fallbackReason] ?? FALLBACK_TEXT.manuelt}
              </div>
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
              Vi ser {detectedArrays} eksisterende solcelleanlegg på dette
              taket.
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

            {excludedCount > 0 && (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                {excludedCount === 1
                  ? "Én flate har ikke plass til nok paneler og er krysset ut — den er ikke med i totalen."
                  : `${excludedCount} flater har ikke plass til nok paneler og er krysset ut — de er ikke med i totalen.`}
              </p>
            )}

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
                onCountCommit={commitCount}
                onAngleCommit={commitAngle}
                onUpdate={handleRoofUpdate}
                onDelete={handleRoofDelete}
              />
            )}
          </section>

          {/* 2 — Anlegget */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Ditt anlegg</h2>
            <div
              className="card flex flex-col gap-4 p-4"
              data-tour="system-types"
            >
              <SelectOption
                title="Taktype"
                options={roofTypes.map((r) => r.name)}
                value={roofType}
                onSelect={chooseRoofType}
              />
              <SelectOption
                title="Paneltype"
                options={panelTypes.map((p) => p.NAVN)}
                value={panelType}
                onSelect={choosePanelType}
              />
            </div>
            <PanelMengde
              selectedPanelType={panelType}
              totalPanels={totalPanels}
              description={
                panelTypes.find((p) => p.NAVN === panelType)?.description ??
                "Mangler beskrivelse"
              }
            />
            <PriceEstimator onSelect={setElPrice} />
          </section>

          {/* 3 — Behovskalkulator */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              Hvor mange paneler trenger du?
            </h2>
            <div className="card flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1.5" data-tour="consumption">
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
                  <span
                    className="text-sm"
                    style={{ color: "var(--ink-soft)" }}
                  >
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
                        Math.min(100, Math.max(0, Number(e.target.value))),
                      )
                    }
                  />
                  <span
                    className="text-sm"
                    style={{ color: "var(--ink-soft)" }}
                  >
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
            <div className="card flex flex-col gap-3 p-4" data-tour="summary">
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
                  {priceError
                    ? "utilgjengelig"
                    : priceLoading
                      ? "beregner…"
                      : `${nb(yearlyCost)}–${nb(yearlyCost2)} kr`}
                </b>
              </div>

              <button
                className="btn btn-primary w-full"
                data-tour="quote"
                onClick={() => setShowModal(true)}
                disabled={priceLoading || totalPanels < MIN_PANELS}
              >
                Jeg ønsker uforpliktende tilbud
              </button>
              {totalPanels < MIN_PANELS && (
                <p
                  className="text-center text-xs"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Velg minst {MIN_PANELS} paneler for å be om tilbud.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {tourStep >= 0 && (
        <Tour
          steps={tourSteps}
          index={tourStep}
          onIndex={advanceTour}
          onClose={() => setTourStep(-1)}
        />
      )}

      {/* Tilbys først når kartet står klart, ellers peker første steg på et
          tegneverktøy som ennå ikke finnes. */}
      {!promptSeen && mode !== "loading" && tourStep < 0 && (
        <TourPrompt onStart={startTour} onDismiss={dismissPrompt} />
      )}

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
