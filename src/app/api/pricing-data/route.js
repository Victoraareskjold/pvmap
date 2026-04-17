import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../utils/supabase/client";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const site = searchParams.get("site");

  const supabase = createSupabaseAdminClient();

  const [installerRes, commissionRes] = await Promise.all([
    supabase
      .from("installer_groups")
      .select(
        `FORMEL, "0-72", "72-150", "150-300", "300-600", "600-1000", "1000+"`,
      )
      .eq("site", site.toLowerCase())
      .single(),

    supabase
      .from("commissions")
      .select(`"0-72", "72-150", "150-300", "300-600", "600-1000", "1000+"`),
  ]);

  if (installerRes.error || commissionRes.error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({
    installer: installerRes.data,
    commission: commissionRes.data,
  });
}
