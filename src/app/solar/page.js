import { redirect } from "next/navigation";

/**
 * /solar was the standalone Google Solar prototype. Both sources now live
 * behind the same flow — search on "/", result on "/map" — so this route
 * only exists to keep old links working.
 */
export default function SolarPage() {
  redirect("/");
}
