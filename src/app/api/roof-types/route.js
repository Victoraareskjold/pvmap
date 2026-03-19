import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../utils/supabase/client";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("roof_types")
    .select("name, PRIS")
    .order("name");

  if (error) {
    console.error("Feil ved henting av taktyper:", error.message);
    return NextResponse.json(
      { error: "Feil ved henting av taktyper" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
