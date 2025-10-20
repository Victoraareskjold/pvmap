export const config = {
  runtime: "nodejs",
  regions: ["fra1", "cdg1", "arn1"],
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const panelCount = parseInt(searchParams.get("panelCount"));
  const aspect = parseFloat(searchParams.get("aspect"));
  const angle = parseFloat(searchParams.get("angle"));

  const panelWattage = searchParams.get("panelWattage");
  const peakpower = (panelCount * panelWattage) / 1000;

  let systemLoss = 0;

  if (panelCount <= 40) {
    systemLoss = 0;
  } else if (panelCount <= 60) {
    systemLoss = 5;
  } else if (panelCount <= 90) {
    systemLoss = 8;
  } else {
    systemLoss = 14;
  }

  if (!lat || !lng || !panelCount || !aspect || !angle) {
    return new Response(
      JSON.stringify({
        error: "Manglende parametere: lat, lng, panelCount, azimuth eller tilt",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const apiUrl = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}&lon=${lng}&peakpower=${peakpower}&loss=${systemLoss}&aspect=${aspect}&angle=${angle}&outputformat=json`;

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
