import fetch from "node-fetch";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const addressId = searchParams.get("addressId");

  if (!addressId) {
    return new Response(JSON.stringify({ error: "addressId er påkrevd" }), {
      status: 400,
    });
  }

  try {
    const response = await fetch(
      `https://takflater.api.norkart.no/takflater/adresse/${addressId}`,
      {
        headers: {
          Accept: "application/json",
          "X-WAAPI-TOKEN": process.env.NEXT_PUBLIC_NORKART_API_KEY_BACKEND,
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
