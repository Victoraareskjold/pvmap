import fetch from "node-fetch";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const panelCount = parseInt(searchParams.get("panelCount"));
  const aspect = parseFloat(searchParams.get("aspect")); // Retning (azimuth)
  const angle = parseFloat(searchParams.get("angle")); // Vinkel (tilt)

  const panelWattage = searchParams.get("panelWattage");
  const peakpower = (panelCount * panelWattage) / 1000;

  // Beregn system loss basert på panelCount
  let systemLoss = 0;

  if (panelCount <= 10) {
    systemLoss = 5; // 5% loss for 0–10 paneler
  } else if (panelCount <= 30) {
    systemLoss = 7; // 7% loss for 10–30 paneler
  } else if (panelCount <= 70) {
    systemLoss = 10; // 10% loss for 30–70 paneler
  } else {
    systemLoss = 12; // 12% loss for panelCount > 70
  }

  // Beregn total system loss
  const loss = 14 + systemLoss; // Base loss + system loss

  if (!lat || !lng || !panelCount || !aspect || !angle) {
    return new Response(
      JSON.stringify({
        error: "Manglende parametere: lat, lng, panelCount, azimuth eller tilt",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const apiUrl = `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=${lat}&lon=${lng}&peakpower=${peakpower}&loss=${loss}&aspect=${aspect}&angle=${angle}&outputformat=json`;

    const response = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `API-feil: ${response.statusText}` }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Feil under kommunikasjon med PVGIS API" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
