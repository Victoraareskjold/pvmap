/**
 * Roof segment and panel logic built on the Google Solar API.
 *
 * Google does not hand out roof outlines, but every panel in solarPanels[]
 * carries a segmentIndex pointing into roofSegmentStats[]. That is enough:
 * we group the panels per segment and draw the panels, not the segments.
 */

const EARTH_RADIUS_M = 6378137;

/** Point at a given distance (m) and bearing (deg from north) from a start point. */
function offset(lat, lng, distance, bearingDeg) {
  const d = distance / EARTH_RADIUS_M;
  const b = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

/**
 * Corner coordinates of a single panel, projected onto the map.
 *
 * Google's panel dimensions apply in the roof plane. A pitched roof is
 * shorter seen from above than it is along the surface, so the component
 * pointing down the slope must be shortened by cos(pitch). Without that the
 * panels come out too long, overlap each other and stick out past the eaves.
 * Google's own demo skips this.
 *
 * Local axes after rotating by the panel orientation: +x points down the
 * slope (same direction as the segment azimuth), +y runs across the slope.
 */
export function panelCorners(panel, solarPotential) {
  const segment = solarPotential.roofSegmentStats?.[panel.segmentIndex];
  const azimuth = segment?.azimuthDegrees ?? 180;
  const pitch = segment?.pitchDegrees ?? 0;
  const foreshortening = Math.cos((pitch * Math.PI) / 180);

  const orientation =
    ((panel.orientation === "PORTRAIT" ? 90 : 0) * Math.PI) / 180;
  const w = (solarPotential.panelWidthMeters ?? 1.045) / 2;
  const h = (solarPotential.panelHeightMeters ?? 1.879) / 2;

  return [
    [w, h],
    [w, -h],
    [-w, -h],
    [-w, h],
  ].map(([x0, y0]) => {
    // 1. rotate the corner by the panel orientation
    const x = x0 * Math.cos(orientation) - y0 * Math.sin(orientation);
    const y = x0 * Math.sin(orientation) + y0 * Math.cos(orientation);

    // 2. project the down-slope direction onto the ground plane
    const xp = x * foreshortening;

    // 3. rotate the whole thing into the segment's compass direction
    return offset(
      panel.center.latitude,
      panel.center.longitude,
      Math.hypot(xp, y),
      (Math.atan2(y, xp) * 180) / Math.PI + azimuth
    );
  });
}

/** Deviation in degrees from due south. 0 = due south, 180 = due north. */
export function deviationFromSouth(azimuth) {
  return Math.abs(((((azimuth - 180) % 360) + 540) % 360) - 180);
}

/** Compass label in Norwegian — this one is user-facing. */
export function compassLabel(azimuth) {
  const names = ["N", "NØ", "Ø", "SØ", "S", "SV", "V", "NV"];
  return names[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8];
}

/**
 * The colour scale for solar potential — red is best, blue is worst, the same
 * way Google renders its own flux layers. One list, used by the map polygons,
 * the roof list, the legend and the compass, for both data sources.
 *
 * The bands are 45° wide and centred on the eight compass points, so a roof
 * facing due east lands in the same band as the compass' Ø arm.
 */
export const RATINGS = {
  excellent: { key: "excellent", label: "Svært godt egnet", color: "#c0392b", rank: 1 },
  good: { key: "good", label: "Godt egnet", color: "#e8703a", rank: 2 },
  moderate: { key: "moderate", label: "Middels egnet", color: "#f5b841", rank: 3 },
  low: { key: "low", label: "Mindre egnet", color: "#8ede4a", rank: 4 },
  north: { key: "north", label: "Lite egnet", color: "#4a6fb5", rank: 5 },
};

/** Legend order: best first. */
export const RATING_SCALE = [
  RATINGS.excellent,
  RATINGS.good,
  RATINGS.moderate,
  RATINGS.low,
  RATINGS.north,
];

/**
 * Verdict for a roof segment. Flat roofs are handled separately — direction
 * does not matter there, the panels get tilted up regardless.
 */
export function rateSegment(pitch, azimuth) {
  if (pitch < 5) return RATINGS.moderate;
  const d = deviationFromSouth(azimuth);
  if (d <= 22.5) return RATINGS.excellent;
  if (d <= 67.5) return RATINGS.good;
  if (d <= 112.5) return RATINGS.moderate;
  if (d <= 157.5) return RATINGS.low;
  return RATINGS.north;
}

/** Segments below this area are chimneys, vents and noise — not roof. */
export const MIN_AREA_M2 = 8;
/** Above this it is a wall that has been misread as a roof. */
export const MAX_PITCH = 70;

/**
 * Builds the segment list from a buildingInsights response.
 * Sorted by quality, then by area. North-facing segments come last and are
 * switched off by default.
 */
export function buildSegments(building) {
  const sp = building?.solarPotential;
  if (!sp) return [];

  const panelsPerSegment = new Map();
  for (const p of sp.solarPanels ?? []) {
    if (!panelsPerSegment.has(p.segmentIndex))
      panelsPerSegment.set(p.segmentIndex, []);
    panelsPerSegment.get(p.segmentIndex).push(p);
  }

  return (sp.roofSegmentStats ?? [])
    .map((segment, i) => {
      const panels = (panelsPerSegment.get(i) ?? []).sort(
        (a, b) => (b.yearlyEnergyDcKwh ?? 0) - (a.yearlyEnergyDcKwh ?? 0)
      );
      const pitch = segment.pitchDegrees ?? 0;
      const azimuth = segment.azimuthDegrees ?? 180;
      const area = segment.stats?.areaMeters2 ?? 0;

      return {
        index: i,
        pitch: Math.round(pitch * 10) / 10,
        azimuth: Math.round(azimuth),
        compass: compassLabel(azimuth),
        areaM2: Math.round(area * 10) / 10,
        medianSunHours: Math.round(segment.stats?.sunshineQuantiles?.[5] ?? 0),
        rating: rateSegment(pitch, azimuth),
        maxPanels: panels.length,
        panels,
        // Google's own DC estimate. Shown as a reference, not as the truth —
        // the production figure comes from PVGIS.
        googleDcKwh: Math.round(
          panels.reduce((sum, p) => sum + (p.yearlyEnergyDcKwh ?? 0), 0)
        ),
      };
    })
    .filter(
      (s) => s.areaM2 >= MIN_AREA_M2 && s.pitch <= MAX_PITCH && s.maxPanels > 0
    )
    .sort((a, b) => a.rating.rank - b.rating.rank || b.areaM2 - a.areaM2);
}

/** PVGIS wants aspect where 0 = south, -90 = east, 90 = west. */
export function azimuthToPvgisAspect(azimuth) {
  return Math.round(((((azimuth - 180) % 360) + 540) % 360) - 180);
}
