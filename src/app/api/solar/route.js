/**
 * Proxy for the Google Solar API — buildingInsights:findClosest.
 *
 * The key stays server side. The client only sends lat/lng.
 * detectedArrays requires additionalInsights=DETECTED_ARRAYS.
 *
 * The route always answers 200 with an envelope, never with a status code
 * the client has to interpret:
 *
 *   { status: "ok",       building: {...} }
 *   { status: "fallback", reason: "ingen-dekning" | "kvote" | "avslatt" | "feil" }
 *
 * "Google has no coverage here" is not an error — it is a normal outcome
 * that should move the user straight into draw-it-yourself mode. Making it a
 * value rather than an exception means the client never has to tell a
 * network failure, a 404 and a spent quota apart.
 */

import {
  countCall,
  isQuotaError,
  markQuotaHit,
  solarBlocked,
} from "@/lib/solarQuota";

/**
 * Geonorge's representasjonspunkt sits on the address point, which is often
 * out by the road or in the middle of the plot rather than on the building
 * itself. findClosest then misses and answers 404 even though Google has
 * data for the house. So we try a few points around it before concluding
 * there is no coverage.
 *
 * Note: every attempt is a billable call. The ring only runs on a 404.
 */
const RING_METERS = 14;
const BEARINGS = [0, 90, 180, 270];

function offset(lat, lng, meters, bearingDeg) {
  const dLat = (meters * Math.cos((bearingDeg * Math.PI) / 180)) / 111320;
  const dLng =
    (meters * Math.sin((bearingDeg * Math.PI) / 180)) /
    (111320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

async function fetchInsights(lat, lng, quality, key) {
  const url =
    `https://solar.googleapis.com/v1/buildingInsights:findClosest` +
    `?location.latitude=${lat}&location.longitude=${lng}` +
    `&requiredQuality=${encodeURIComponent(quality)}` +
    `&additionalInsights=DETECTED_ARRAYS` +
    `&key=${key}`;
  const res = await fetch(url);
  countCall();
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function fallback(reason, extra = {}) {
  return Response.json({ status: "fallback", reason, ...extra });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat"));
  const lng = parseFloat(searchParams.get("lng"));
  const quality = searchParams.get("quality") || "BASE";
  const searchAround = searchParams.get("searchAround") !== "0";

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "lat og lng er påkrevd" }, { status: 400 });
  }

  const blocked = solarBlocked();
  if (blocked) return fallback(blocked);

  const key = process.env.GOOGLE_SOLAR_API_KEY;
  if (!key) return fallback("avslatt");

  try {
    let { status, data } = await fetchInsights(lat, lng, quality, key);
    let attempts = 1;

    if (isQuotaError(status, data)) {
      markQuotaHit();
      return fallback("kvote");
    }

    if (status === 404 && searchAround) {
      for (const bearing of BEARINGS) {
        const p = offset(lat, lng, RING_METERS, bearing);
        const retry = await fetchInsights(p.lat, p.lng, quality, key);
        attempts++;
        if (isQuotaError(retry.status, retry.data)) {
          markQuotaHit();
          return fallback("kvote");
        }
        if (retry.status === 200) {
          status = retry.status;
          data = retry.data;
          break;
        }
      }
    }

    if (status === 404) return fallback("ingen-dekning", { attempts });
    if (status !== 200) {
      return fallback("feil", {
        message: data?.error?.message || `Solar API svarte ${status}`,
      });
    }

    // The terms (§20.2) allow caching Solar data for 30 days.
    return Response.json(
      { status: "ok", building: data, attempts },
      { headers: { "Cache-Control": "private, max-age=86400" } }
    );
  } catch {
    return fallback("feil", { message: "Fikk ikke kontakt med Google Solar API" });
  }
}
