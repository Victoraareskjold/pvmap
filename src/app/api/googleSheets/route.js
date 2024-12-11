import { google } from "googleapis";

export async function POST(req) {
  try {
    const body = await req.json();
    const { totalPanels } = body;

    console.log(totalPanels);

    if (totalPanels < 0) {
      return new Response(
        JSON.stringify({ error: "Total Panels parameter mangler" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Sett totalPanels i celle A2
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "A2", // Dette er cellen du vil oppdatere
      valueInputOption: "RAW", // RAW lar deg bruke uformaterte verdier
      requestBody: {
        values: [[totalPanels]], // Sett totalPanels i A2
      },
    });

    // Hent verdien fra celle B2
    const responseB2 = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "B2", // Dette er cellen vi henter fra
    });

    const valueFromB2 = responseB2.data.values
      ? responseB2.data.values[0][0]
      : null;

    console.log("Verdi hentet fra B2:", valueFromB2);

    const data = responseB2.data.values;

    const sheetData = data.map((row) => ({
      yearlyCost: row[0],
    }));

    return new Response(JSON.stringify({ data: sheetData, valueFromB2 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Feil ved henting av Google Sheets data:", error);
    return new Response(
      JSON.stringify({ error: "Feil ved henting av Google Sheets data" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
