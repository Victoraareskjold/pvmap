import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../utils/supabase/client";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const site = searchParams.get("site");

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("installer_groups")
    .select("FORMEL")
    .eq("site", site)
    .single();

  if (error) {
    console.error("Feil ved henting av formel:", error.message);
    return NextResponse.json(
      { error: "Feil ved henting av formel" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
