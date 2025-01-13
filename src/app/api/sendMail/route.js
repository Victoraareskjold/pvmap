import { NextResponse } from "next/server";
import sendGridMail from "@sendgrid/mail";

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

    const msg = {
      to: `victor.aareskjold@icloud.com`,
      from: "victor.aareskjold@gmail.com",
      subject: `${name} har etterspurt et solcelleestimat!`,
      text: `
      Nettside: ${site}
      
      Navn: ${name}
      Emai: ${email}
      Adresse: ${address}
      Vil bli ringt? ${checked}
      Telefon: ${phone}

      Type paneler: ${selectedPanelType}
      Taktype: ${selectedRoofType}

      Estimert elektrisitetspris: ${selectedElPrice} kr/kWh
      Antall paneler: ${totalPanels}

      ${JSON.stringify(checkedRoofData, null, 2)}

      Årlig produksjon: ${yearlyProd.toFixed(0)}
      Årlig kostnad: ${yearlyCost.toFixed(0)}`,
    };

    try {
      await sendGridMail.send(msg);
      console.log("✅ E-post sendt!");
      return NextResponse.json({ message: "E-post sendt!" }, { status: 200 });
    } catch (error) {
      console.error("❌ SendGrid-feil:", error.response?.body || error.message);
      return NextResponse.json(
        { error: "Feil under sending av e-post", details: error.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ Error processing the request:", error.message);
    return NextResponse.json(
      { error: "Feil under behandling av forespørsel", details: error.message },
      { status: 400 }
    );
  }
}
