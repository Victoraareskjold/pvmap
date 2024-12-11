import fetch from "node-fetch";

export async function GET(req) {
  try {
    const apiKey = process.env.NORKART_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Manglende API-nøkkel" }), {
        status: 400,
      });
    }

    return new Response(JSON.stringify({ apiKey }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Feil under henting av API-nøkkel" }),
      { status: 500 }
    );
  }
}
