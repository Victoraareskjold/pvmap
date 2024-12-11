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
    } = await req.json();

    const msg = {
      to: `victor.aareskjold@icloud.com`,
      from: "victor.aaareskjold@gmail.com",
      subject: `${name} har etterspurt et solcelleestimat!`,
      text: `Navn: ${name}
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

    await sendGridMail.send(msg);
    return NextResponse.json({ message: "E-post sendt!" }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Feil under sending av e-post" },
      { status: 500 }
    );
  }
}
