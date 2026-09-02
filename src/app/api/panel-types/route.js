import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../utils/supabase/client";

const PRICE_STEPS = `"0-72", "72-150", "150-300", "300-600", "600-1000", "1000+"`;

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const read = (columns) =>
    supabase.from("solarpanels").select(columns).order("NAVN");

  let { data, error } = await read(
    `NAVN, WATTAGE, description, ${PRICE_STEPS}`,
  );

  /* 42703 = kolonnen finnes ikke. `description` er teksten som vises under
     paneltypen, og den er ny — mangler den i basen, skal paneltypene og
     dermed prisoppslaget likevel virke, bare uten beskrivelsen. */
  if (error?.code === "42703") {
    console.warn(
      "solarpanels mangler kolonnen `description` — beskrivelsen vises ikke.",
    );
    ({ data, error } = await read(`NAVN, WATTAGE, ${PRICE_STEPS}`));
  }

  if (error) {
    console.error("Feil ved henting av paneltyper:", error.message);
    return NextResponse.json(
      { error: "Feil ved henting av paneltyper" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
