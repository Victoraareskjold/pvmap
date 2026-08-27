/**
 * Henter Googles eget flyfoto for bygget (rgbUrl fra Data Layers) og sender
 * GeoTIFF-en videre til klienten.
 *
 * Poenget: satellittflisene i Google Maps er et annet opptak enn soldataene,
 * tatt på et annet tidspunkt og fra en annen vinkel. Dette bildet er fra
 * samme kilde som takanalysen, så panelene sitter der de skal.
 *
 * Nøkkelen blir aldri sendt til nettleseren — signerte URL-er fra Data Layers
 * krever den, så nedlastingen må skje her.
 *
 * NB: Data Layers er den dyre delen ($75/1000 etter de første 1000/mnd).
 * Kall dette bare når brukeren faktisk skal se på bygget.
 */

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat"));
  const lng = parseFloat(searchParams.get("lng"));
  const radius = Math.min(
    100,
    Math.max(20, parseInt(searchParams.get("radius") || "40", 10))
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "lat og lng er påkrevd" }, { status: 400 });
  }

  const key = process.env.GOOGLE_SOLAR_API_KEY;
  if (!key) {
    return Response.json(
      { error: "GOOGLE_SOLAR_API_KEY mangler" },
      { status: 500 }
    );
  }

  try {
    const metaRes = await fetch(
      `https://solar.googleapis.com/v1/dataLayers:get` +
        `?location.latitude=${lat}&location.longitude=${lng}` +
        `&radiusMeters=${radius}&view=FULL_LAYERS&requiredQuality=BASE` +
        `&key=${key}`
    );
    const meta = await metaRes.json().catch(() => ({}));

    if (!metaRes.ok) {
      return Response.json(
        {
          error:
            meta?.error?.message ||
            `Data Layers svarte ${metaRes.status}`,
        },
        { status: metaRes.status }
      );
    }
    if (!meta.rgbUrl) {
      return Response.json(
        { error: "Ingen rgbUrl for dette punktet" },
        { status: 404 }
      );
    }

    // Signerte URL-er varer i én time og krever nøkkelen påhengt
    const tiffRes = await fetch(`${meta.rgbUrl}&key=${key}`);
    if (!tiffRes.ok) {
      return Response.json(
        { error: `Klarte ikke å laste ned bildet (${tiffRes.status})` },
        { status: 502 }
      );
    }

    return new Response(await tiffRes.arrayBuffer(), {
      headers: {
        "Content-Type": "image/tiff",
        "X-Imagery-Quality": meta.imageryQuality ?? "",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    return Response.json(
      { error: "Feil under henting av flyfoto" },
      { status: 500 }
    );
  }
}
