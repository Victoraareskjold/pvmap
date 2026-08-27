/**
 * Address lookup against Geonorge, run server side.
 *
 * Doing it from the browser would leave us at the mercy of Geonorge's CORS
 * headers, with no error to show for it when they are missing — just empty
 * results. Here we can see what actually happened.
 *
 * Shape: { addresses: [{ id, text, lat, lng }] }
 */

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") || searchParams.get("query") || "").trim();

  if (query.length < 3) return Response.json({ addresses: [] });

  const url =
    `https://ws.geonorge.no/adresser/v1/sok` +
    `?sok=${encodeURIComponent(query)}` +
    `&fuzzy=true&treffPerSide=8&utkoordsys=4326`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return Response.json(
        { error: `Geonorge svarte ${res.status}`, addresses: [] },
        { status: 502 }
      );
    }

    const data = await res.json();
    const addresses = (data.adresser ?? [])
      .filter((a) => a.representasjonspunkt)
      .map((a) => ({
        id: a.adresseId ?? `${a.kommunenummer}-${a.gardsnummer}-${a.bruksnummer}`,
        text: [a.adressetekst, a.postnummer, a.poststed].filter(Boolean).join(", "),
        lat: a.representasjonspunkt.lat,
        lng: a.representasjonspunkt.lon,
      }));

    return Response.json({ addresses });
  } catch {
    return Response.json(
      { error: "Fikk ikke kontakt med Geonorge", addresses: [] },
      { status: 502 }
    );
  }
}
