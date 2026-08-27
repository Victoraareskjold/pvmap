#!/usr/bin/env node
/**
 * Dekningstest for Google Solar API i Norge — for pvmap.
 *
 * Forutsetning:
 *   1. Opprett et Google Cloud-prosjekt med fakturering aktivert
 *   2. Aktiver "Solar API" under APIs & Services
 *   3. Lag en API-nøkkel, og legg den i .env.local:
 *        GOOGLE_SOLAR_API_KEY=AIza...
 *      (begrens nøkkelen til Solar API i konsollen)
 *
 * Kjør:
 *   node scripts/test-solar-coverage.mjs
 *
 * Hva den gjør:
 *   1. Slår opp hver testadresse i Geonorge (samme kilde som /api/search)
 *   2. Kaller buildingInsights:findClosest for koordinatet
 *   3. Sammenligner Googles DC-estimat mot PVGIS AC-estimat (samme kilde som /api/pvgis)
 *   4. Skriver full rapport til scripts/solar-coverage-resultat.json
 *
 * Koster: 1 Building Insights-kall per adresse. 20 adresser = 20 av 10 000 gratis/mnd.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- last .env.local hvis nøkkelen ikke allerede er i miljøet ---
if (!process.env.GOOGLE_SOLAR_API_KEY) {
  try {
    const env = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^\s*GOOGLE_SOLAR_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) process.env.GOOGLE_SOLAR_API_KEY = m[1].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const KEY = process.env.GOOGLE_SOLAR_API_KEY;
if (!KEY) {
  console.error(
    "\nMangler GOOGLE_SOLAR_API_KEY.\n" +
      "Legg til i .env.local:  GOOGLE_SOLAR_API_KEY=AIza...\n" +
      "eller kjør:  GOOGLE_SOLAR_API_KEY=AIza... node scripts/test-solar-coverage.mjs\n"
  );
  process.exit(1);
}

// Representativt utvalg: storby, mindre by, tettsted, villaområde, spredtbygd, nord
const ADDRESSES = [
  ["Storby", "Karl Johans gate 22, Oslo"],
  ["Storby", "Bryggen 5, Bergen"],
  ["Storby", "Kongens gate 1, Trondheim"],
  ["Storby", "Kirkegata 22, Stavanger"],
  ["Villaområde", "Holmenkollveien 100, Oslo"],
  ["Villaområde", "Byåsveien 100, Trondheim"],
  ["Villaområde", "Vestre Strandgate 30, Kristiansand"],
  ["By", "Storgata 30, Lillehammer"],
  ["By", "Torggata 8, Hamar"],
  ["By", "Storgata 45, Bodø"],
  ["By", "Storgata 60, Tromsø"],
  ["By", "Storgata 20, Alta"],
  ["Tettsted", "Kirkegata 10, Kongsberg"],
  ["Tettsted", "Storgata 15, Sortland"],
  ["Tettsted", "Strandgata 30, Florø"],
  ["Tettsted", "Storgata 12, Otta"],
  ["Spredtbygd", "Gaustadvegen 100, Rjukan"],
  ["Spredtbygd", "Bøverdalen 50, Lom"],
  ["Spredtbygd", "Sandvikvegen 20, Averøy"],
  ["Spredtbygd", "Setesdalsvegen 500, Bygland"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geonorge(q) {
  const url = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(
    q
  )}&fuzzy=true&treffPerSide=1&utkoordsys=4326`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = await res.json();
  const a = data.adresser?.[0];
  if (!a?.representasjonspunkt) return null;
  return {
    text: [a.adressetekst, a.postnummer, a.poststed].filter(Boolean).join(", "),
    lat: a.representasjonspunkt.lat,
    lng: a.representasjonspunkt.lon,
  };
}

async function buildingInsights(lat, lng) {
  const url =
    `https://solar.googleapis.com/v1/buildingInsights:findClosest` +
    `?location.latitude=${lat}&location.longitude=${lng}` +
    `&requiredQuality=BASE&additionalInsights=DETECTED_ARRAYS&key=${KEY}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// Samme kall som pvmap gjør i dag (src/app/api/pvgis/route.js)
async function pvgis({ lat, lng, peakpower, aspect, angle, loss = 14 }) {
  const url =
    `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc` +
    `?lat=${lat}&lon=${lng}&peakpower=${peakpower}&loss=${loss}` +
    `&aspect=${aspect}&angle=${angle}&outputformat=json`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const d = await res.json();
    return d?.outputs?.totals?.fixed?.E_y ?? null;
  } catch {
    return null;
  }
}

// Sjekker hvilke rasterlag Norge faktisk får (grunnlaget for skyggekorreksjon)
async function dataLayers(lat, lng) {
  const url =
    `https://solar.googleapis.com/v1/dataLayers:get` +
    `?location.latitude=${lat}&location.longitude=${lng}` +
    `&radiusMeters=30&view=FULL_LAYERS&requiredQuality=BASE&key=${KEY}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200)
    return { ok: false, feil: body?.error?.message || `HTTP ${res.status}` };
  return {
    ok: true,
    imageryQuality: body.imageryQuality,
    lag: {
      dsm: !!body.dsmUrl,
      rgb: !!body.rgbUrl,
      mask: !!body.maskUrl,
      annualFlux: !!body.annualFluxUrl,
      monthlyFlux: !!body.monthlyFluxUrl,
      hourlyShade: (body.hourlyShadeUrls || []).length,
    },
  };
}

const rows = [];

console.log(`\nTester ${ADDRESSES.length} adresser mot Google Solar API...\n`);

for (const [kategori, query] of ADDRESSES) {
  const adr = await geonorge(query);
  if (!adr) {
    rows.push({ kategori, query, resultat: "GEONORGE-MISS" });
    console.log(`  ?  ${query} — ikke funnet i Geonorge`);
    continue;
  }

  const { status, body } = await buildingInsights(adr.lat, adr.lng);

  if (status !== 200) {
    const msg = body?.error?.message || body?.error?.status || `HTTP ${status}`;
    rows.push({
      kategori,
      query,
      adresse: adr.text,
      lat: adr.lat,
      lng: adr.lng,
      resultat: `MISS (${status})`,
      feil: msg,
    });
    console.log(`  ✗  ${adr.text}\n       ${status}: ${msg}`);
    continue;
  }

  const sp = body.solarPotential || {};
  const segs = [...(sp.roofSegmentStats || [])].sort(
    (a, b) => (b.stats?.areaMeters2 || 0) - (a.stats?.areaMeters2 || 0)
  );
  const best = sp.solarPanelConfigs?.[sp.solarPanelConfigs.length - 1];

  // Avstand fra adressepunkt til bygget Google valgte — avslører feil bygg
  const c = body.center || {};
  const dLat = ((c.latitude ?? adr.lat) - adr.lat) * 111320;
  const dLng =
    ((c.longitude ?? adr.lng) - adr.lng) *
    111320 *
    Math.cos((adr.lat * Math.PI) / 180);
  const avstand = Math.round(Math.hypot(dLat, dLng));

  // PVGIS-sammenligning på største takflate, samme panelantall som Googles beste config
  let pvgisAc = null;
  let pvgisInput = null;
  if (best && segs[0]) {
    const peakpower = (best.panelsCount * (sp.panelCapacityWatts || 400)) / 1000;
    const aspect = Math.round((segs[0].azimuthDegrees ?? 180) - 180);
    const angle = Math.round(segs[0].pitchDegrees ?? 20);
    pvgisInput = { peakpower, aspect, angle };
    pvgisAc = await pvgis({ lat: adr.lat, lng: adr.lng, peakpower, aspect, angle });
  }

  const googleDc = best?.yearlyEnergyDcKwh ?? null;
  const avvik =
    googleDc && pvgisAc ? (((googleDc - pvgisAc) / pvgisAc) * 100).toFixed(0) : null;

  rows.push({
    kategori,
    query,
    adresse: adr.text,
    lat: adr.lat,
    lng: adr.lng,
    resultat: "TREFF",
    imageryQuality: body.imageryQuality,
    imageryDate: body.imageryDate
      ? `${body.imageryDate.year}-${String(body.imageryDate.month).padStart(2, "0")}`
      : null,
    avstandTilBygg_m: avstand,
    antallTakflater: segs.length,
    takarealM2: Number(sp.wholeRoofStats?.areaMeters2?.toFixed(0)) || null,
    maksPaneler: sp.maxArrayPanelsCount,
    panelWatt: sp.panelCapacityWatts,
    panelStr:
      sp.panelHeightMeters && sp.panelWidthMeters
        ? `${sp.panelHeightMeters} x ${sp.panelWidthMeters} m`
        : null,
    antallPanelPosisjoner: Array.isArray(sp.solarPanels) ? sp.solarPanels.length : 0,
    maksSoltimerAar: Number(sp.maxSunshineHoursPerYear?.toFixed(0)) || null,
    bestePaneler: best?.panelsCount ?? null,
    googleDcKwhAar: googleDc ? Number(googleDc.toFixed(0)) : null,
    pvgisInput,
    pvgisAcKwhAar: pvgisAc ? Number(pvgisAc.toFixed(0)) : null,
    avvikGoogleVsPvgisProsent: avvik ? Number(avvik) : null,
    eksisterendeAnlegg: body.solarPotential?.detectedArrays
      ? {
          antall: body.solarPotential.detectedArrays.length,
          arealM2: Number(
            body.solarPotential.detectedArrays
              .reduce((sum, a) => sum + (a.areaMeters2 || 0), 0)
              .toFixed(1)
          ),
        }
      : null,
    takflater: segs.map((s) => ({
      helning: Number(s.pitchDegrees?.toFixed(1)),
      retning: Number(s.azimuthDegrees?.toFixed(1)),
      arealM2: Number(s.stats?.areaMeters2?.toFixed(1)),
      medianSoltimer: Number(s.stats?.sunshineQuantiles?.[5]?.toFixed(0)),
      minSoltimer: Number(s.stats?.sunshineQuantiles?.[0]?.toFixed(0)),
      maksSoltimer: Number(s.stats?.sunshineQuantiles?.[10]?.toFixed(0)),
    })),
  });

  console.log(
    `  ✓  ${adr.text}\n` +
      `       ${body.imageryQuality} · ${segs.length} takflater · ${sp.maxArrayPanelsCount} paneler maks · ` +
      `bygg ${avstand} m fra adressepunkt\n` +
      `       Google ${googleDc?.toFixed(0) ?? "–"} kWh DC  vs  PVGIS ${
        pvgisAc?.toFixed(0) ?? "–"
      } kWh AC` +
      (avvik !== null ? `  (${avvik > 0 ? "+" : ""}${avvik} %)` : "")
  );

  await sleep(200);
}

// --- Rasterlag: probe de tre første treffene ---
const lagProbe = [];
for (const r of rows.filter((r) => r.resultat === "TREFF").slice(0, 3)) {
  const d = await dataLayers(r.lat, r.lng);
  lagProbe.push({ adresse: r.adresse, ...d });
  console.log(
    `\n  dataLayers · ${r.adresse}\n       ` +
      (d.ok
        ? `${d.imageryQuality} · ${Object.entries(d.lag)
            .map(([k, v]) => `${k}=${v}`)
            .join(" ")}`
        : `FEIL: ${d.feil}`)
  );
  await sleep(200);
}

const out = join(__dirname, "solar-coverage-resultat.json");
writeFileSync(out, JSON.stringify({ adresser: rows, rasterlag: lagProbe }, null, 2));

// --- Oppsummering ---
const treff = rows.filter((r) => r.resultat === "TREFF");
const kvalitet = treff.reduce((acc, r) => {
  acc[r.imageryQuality] = (acc[r.imageryQuality] || 0) + 1;
  return acc;
}, {});
const avvik = treff
  .map((r) => r.avvikGoogleVsPvgisProsent)
  .filter((v) => v !== null && v !== undefined);

console.log("\n" + "=".repeat(60));
console.log("OPPSUMMERING");
console.log("=".repeat(60));
console.log(`Treff:            ${treff.length} / ${rows.length}`);
console.log(`Bildekvalitet:    ${JSON.stringify(kvalitet)}`);
console.log(
  `Snitt takflater:  ${(
    treff.reduce((s, r) => s + r.antallTakflater, 0) / (treff.length || 1)
  ).toFixed(1)}`
);
console.log(
  `Feil bygg (>30m): ${treff.filter((r) => r.avstandTilBygg_m > 30).length}`
);
if (avvik.length) {
  const snitt = avvik.reduce((a, b) => a + b, 0) / avvik.length;
  console.log(
    `Google vs PVGIS:  snitt ${snitt > 0 ? "+" : ""}${snitt.toFixed(0)} % ` +
      `(spenn ${Math.min(...avvik)} til ${Math.max(...avvik)} %)`
  );
}
console.log("\nTreffrate per kategori:");
for (const kat of [...new Set(rows.map((r) => r.kategori))]) {
  const k = rows.filter((r) => r.kategori === kat);
  const t = k.filter((r) => r.resultat === "TREFF").length;
  console.log(`  ${kat.padEnd(14)} ${t}/${k.length}`);
}
const medAnlegg = treff.filter((r) => r.eksisterendeAnlegg?.antall > 0).length;
console.log(`Har alt solceller: ${medAnlegg} / ${treff.length}`);
console.log(
  `annualFlux tilgj.: ${lagProbe.filter((d) => d.ok && d.lag.annualFlux).length} / ${lagProbe.length} probet`
);
console.log(`\nFull rapport: ${out}\n`);
