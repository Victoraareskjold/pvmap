import sendGridMail from "@sendgrid/mail";
import { NextResponse } from "next/server";

sendGridMail.setApiKey(process.env.SENDGRID);

export async function POST(req) {
  try {
    const {
      name,
      email,
      checked,
      phone,
      checkedRoofData,
      selectedElPrice,
      selectedRoofType,
      selectedPanelType,
      totalPanels,
      yearlyCost,
      yearlyProd,
      address,
      site,
    } = await req.json();

    // ✅ Input Validation
    if (!name || !email || !address || !phone) {
      return NextResponse.json(
        {
          error:
            "Manglende påkrevde felter: navn, e-post, adresse, eller telefon.",
        },
        { status: 400 }
      );
    }

    const msg = {
      to: "asbjorn@sooleklart.com",
      from: "asbjorn@sooleklart.com",
      subject: `${name} har etterspurt et solcelleestimat!`,
      text: `Nettside: ${site}
      Navn: ${name}
      Email: ${email}
      Adresse: ${address}
      Vil bli ringt? ${checked ? "Ja" : "Nei"}
      Telefon: ${phone}

      Type paneler: ${selectedPanelType}
      Taktype: ${selectedRoofType}

      Estimert elektrisitetspris: ${selectedElPrice} kr/kWh
      Antall paneler: ${totalPanels}

      Takdata:
      ${JSON.stringify(checkedRoofData, null, 2)}

      Årlig produksjon: ${yearlyProd?.toFixed(0) || "Ikke tilgjengelig"}
      Årlig kostnad: ${yearlyCost?.toFixed(0) || "Ikke tilgjengelig"}`,
    };

    // ✅ Attempt to Send Email
    await sendGridMail.send(msg);
    console.log("✅ E-post sendt!");
    return NextResponse.json({ message: "E-post sendt!" }, { status: 200 });
  } catch (error) {
    console.error(
      "❌ SendGrid-feil:",
      error.response?.body || error.message || error
    );
    return NextResponse.json(
      {
        error: "Feil under sending av e-post",
        details: error.response?.body || error.message,
      },
      { status: 500 }
    );
  }
}
