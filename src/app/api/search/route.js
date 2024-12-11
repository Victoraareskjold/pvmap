import fetch from "node-fetch";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query) {
    return new Response(JSON.stringify({ error: "Query er påkrevd" }), {
      status: 400,
    });
  }

  try {
    const response = await fetch(
      `https://fritekstsok.api.norkart.no/suggest/matrikkel/adresse?Query=${query}`,
      {
        headers: {
          Accept: "application/json",
          "X-WAAPI-TOKEN": process.env.NORKART_API_KEY,
          SRS: 4326,
        },
      }
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `API-feil: ${response.statusText}` }),
        { status: response.status }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Feil under kommunikasjon med Norkart API" }),
      { status: 500 }
    );
  }
}
