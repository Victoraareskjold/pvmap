import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
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
      yearlyCost2,
      yearlyProd,
      address,
      site,
      desiredKWh,
      coveragePercentage,
    } = body;

    if (!name || !email || !address || !phone) {
      return NextResponse.json(
        {
          error:
            "Manglende påkrevde felter: navn, e-post, adresse, eller telefon.",
        },
        { status: 400 },
      );
    }

    // 🔐 Miljøvariabler
    const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
    const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
    const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;

    // 💡 Lag dataobjekt som matcher template på EmailJS
    const templateParams = {
      name,
      email,
      phone,
      address,
      site,
      checked: checked ? "Ja" : "Nei",
      selectedRoofType,
      selectedPanelType,
      selectedElPrice,
      totalPanels,
      yearlyCost: yearlyCost?.toFixed(0) || "Ikke tilgjengelig",
      yearlyCost2: yearlyCost2?.toFixed(0) || "Ikke tilgjengelig",
      yearlyProd: yearlyProd?.toFixed(0) || "Ikke tilgjengelig",
      checkedRoofData: JSON.stringify(checkedRoofData, null, 2),
      desiredKWh,
      coveragePercentage,
    };

    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`EmailJS-feil: ${errorText}`);
    }

    console.log("✅ E-post sendt med EmailJS!");
    return NextResponse.json({ message: "E-post sendt!" }, { status: 200 });
  } catch (error) {
    console.error("❌ EmailJS-feil:", error.message || error);
    return NextResponse.json(
      {
        error: "Feil under sending av e-post",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
