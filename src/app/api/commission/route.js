import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../utils/supabase/client";

export async function GET(_req) {
  const supabase = createSupabaseAdminClient();
  supabase
    .from("commissions")
    .select(`"0-72", "72-150", "150-300", "300-600", "600-1000", "1000+"`)
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
