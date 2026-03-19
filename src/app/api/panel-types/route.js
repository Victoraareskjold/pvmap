import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../utils/supabase/client";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("solarpanels")
    .select("NAVN, PRIS, WATTAGE")
    .order("NAVN");

  if (error) {
    console.error("Feil ved henting av paneltyper:", error.message);
    return NextResponse.json(
      { error: "Feil ved henting av paneltyper" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
