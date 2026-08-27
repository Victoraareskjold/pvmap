/**
 * The shared roof model both sources normalise into.
 *
 * Everything downstream — the roof list, the PVGIS calls, the price lookup
 * and the payload posted to the dashboard — works against one object:
 *
 *   { id, source, direction, angle, area, maxPanels, rating, efficiencyPerPanel }
 *
 * `source` is "google" when the Solar API has coverage for the address, and
 * "drawn" when the user outlined the roof themselves. Only the map and a
 * couple of details in the list care about the difference; the rest of the
 * app should not know which way the data came in.
 */

import {
  azimuthToPvgisAspect,
  buildSegments,
  compassLabel,
  rateSegment,
} from "./solar";

/** Below this count the system is not worth quoting. */
export const MIN_PANELS = 6;

/** Panel dimensions used when estimating capacity for a drawn roof. */
const PANEL_LENGTH_M = 1.1;
const PANEL_DEPTH_M = 1.7;
/** Margin for edges, snow and mounting rails. */
const USABLE_FRACTION = 0.95;

export { compassLabel, rateSegment };
export const pvgisAspect = azimuthToPvgisAspect;

/** The wattage lives inside the panel type string ("… 430W"). */
export function panelWatts(panelType) {
  return Number(String(panelType).match(/(\d+)/)?.[0] ?? 430);
}

/**
 * How many panels fit on a drawn roof.
 *
 * The width is measured on the map, i.e. projected onto the ground plane.
 * The roof itself is longer than that along the slope, hence the division
 * by cos(pitch).
 */
export function estimatePanelCount(length, width, pitch = 0) {
  const rad = (pitch * Math.PI) / 180;
  const slopeWidth = rad > 0 ? width / Math.cos(rad) : width;
  const rows = Math.floor((length * USABLE_FRACTION) / PANEL_LENGTH_M);
  const cols = Math.floor((slopeWidth * USABLE_FRACTION) / PANEL_DEPTH_M);
  return Math.max(0, rows * cols);
}

/** Roofs from a buildingInsights response. */
export function roofsFromGoogle(building) {
  return buildSegments(building).map((segment) => ({
    id: `g${segment.index}`,
    source: "google",
    segmentIndex: segment.index,
    direction: segment.azimuth,
    angle: segment.pitch,
    area: segment.areaM2,
    maxPanels: segment.maxPanels,
    rating: segment.rating,
    sunHours: segment.medianSunHours,
    googleDcKwh: segment.googleDcKwh,
    panels: segment.panels,
    efficiencyPerPanel: 0,
  }));
}

/** A new roof from something the user drew on the map. */
export function roofFromDrawing({ coordinates, area, length, width, layer }) {
  const angle = 20; // the most common Norwegian roof pitch
  const direction = 180; // south — the user adjusts afterwards
  return {
    id: `d${Date.now()}${Math.round(Math.random() * 1000)}`,
    source: "drawn",
    direction,
    angle,
    area,
    length,
    width,
    coordinates,
    _layer: layer,
    maxPanels: estimatePanelCount(length, width, angle),
    rating: rateSegment(angle, direction),
    efficiencyPerPanel: 0,
  };
}

/**
 * Applies a direction or pitch change to a drawn roof.
 * Capacity and colour rating both follow from those two, so they are
 * recomputed here instead of being spread across the components.
 */
export function updateDrawnRoof(roof, changes) {
  const next = { ...roof, ...changes };
  return {
    ...next,
    maxPanels: estimatePanelCount(next.length, next.width, next.angle),
    rating: rateSegment(next.angle, next.direction),
  };
}

/** User-facing explanation of why the manual mode is active. */
export const FALLBACK_TEXT = {
  "ingen-dekning":
    "Google har ikke kartlagt taket på denne adressen. Tegn takflatene dine i kartet, så regner vi produksjonen ut fra PVGIS som før.",
  kvote:
    "Den automatiske takanalysen er midlertidig utilgjengelig. Tegn takflatene dine i kartet — beregningen blir like nøyaktig, den tar bare litt mer klikking.",
  avslatt:
    "Automatisk takanalyse er slått av. Tegn takflatene dine i kartet, så regner vi ut resten.",
  feil:
    "Vi fikk ikke kontakt med takanalysen. Tegn takflatene dine i kartet, så regner vi ut resten.",
  manuelt:
    "Du tegner takflatene selv. Bruk polygonverktøyet øverst til venstre i kartet.",
};
