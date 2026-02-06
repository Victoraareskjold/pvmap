"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { setLocalStorage } from "../../utils/localstorage";

export default function HandleQueryParams() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const gclid = searchParams.get("gclid");
    const fbclid = searchParams.get("fbclid");
    const utmCampaign = searchParams.get("utm_campaign");

    if (gclid) {
      setLocalStorage("gclid", gclid);
      localStorage.removeItem("fbclid");
    }

    if (fbclid) {
      setLocalStorage("fbclid", fbclid);
      localStorage.removeItem("gclid");
    }

    if (utmCampaign) {
      setLocalStorage("utmCampaign", utmCampaign);
    }
  }, [searchParams]);

  return null;
}
