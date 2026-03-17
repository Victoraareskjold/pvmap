import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createSupabaseAdminClient } from "../../../../../utils/supabase/client";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      site,
      user_address,
      user_name,
      user_phone,
      user_email,
      gclid,
      fbclid,
      utmCampaign,
      selectedRoofType,
      selectedPanelType,
      selectedElPrice,
      totalPanels,
      yearlyCost,
      yearlyCost2,
      yearlyProd,
      checkedRoofData,
      desiredKWh,
      coveragePercentage,
    } = body;
    if (!user_address || !user_name || !user_phone || !user_email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const client = createSupabaseAdminClient();

    const { data: installerGroup, error: installerError } = await client
      .from("installer_groups")
      .select("id, team_id")
      .eq("site", site)
      .single();

    if (installerError || !installerGroup) {
      return NextResponse.json(
        { error: "Installer group not found" },
        { status: 404 },
      );
    }

    const { id: installer_group_id, team_id } = installerGroup;

    const { data: lead, error: leadError } = await client
      .from("leads")
      .insert({
        team_id,
        installer_group_id,
        person_info: user_name,
        address: user_address,
        phone: user_phone,
        status: 6,
        email: user_email,
        note: `
        Tracking:
        gclid: ${gclid || ""}
        fbclid: ${fbclid || ""}
        utmCampaign: ${utmCampaign || ""}

        selectedRoofType: ${selectedRoofType || ""},
        selectedPanelType: ${selectedPanelType || ""},
        selectedElPrice: ${selectedElPrice || ""},
        totalPanels: ${totalPanels || 0},
        yearlyCost: ${yearlyCost || 0},
        yearlyCost2: ${yearlyCost2 || 0},
        yearlyProd: ${yearlyProd || 0},
        desiredKWh: ${desiredKWh || 0},
        coveragePercentage: ${coveragePercentage || 0},

        checkedRoofData: ${JSON.stringify(checkedRoofData)}
        `,
      })
      .select()
      .single();

    if (leadError) throw leadError;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      console.error("Missing SMTP env vars");
      return new NextResponse("Server misconfigured", { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Soleklart Dashboard" <${SMTP_USER}>`,
      to: [SMTP_USER].filter(Boolean).join(", "),
      subject: `Ny lead for ${site}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <p>${user_name} har etterspurt estimat gjennom nettsiden.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, lead });
  } catch (err) {
    console.error("POST /api/leads/create error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
