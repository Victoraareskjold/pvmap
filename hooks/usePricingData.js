"use client";
import { useEffect, useState } from "react";

/**
 * Prisradene for én installatør.
 *
 * Ruten svarer 500 når `installer_groups` mangler en rad for siten. Uten
 * sjekk på `res.ok` ble feilkroppen `{ error: "DB error" }` lagret som
 * gyldige data — da så prisen ferdig lastet ut, og utregningen ga 0 kr
 * uten at noe sa fra.
 *
 * @returns {{ pricingData: object | null, priceError: string | null }}
 */
export function usePricingData(site) {
  const [pricingData, setPricingData] = useState(null);
  const [priceError, setPriceError] = useState(null);

  useEffect(() => {
    if (!site) return;

    let cancelled = false;
    setPricingData(null);
    setPriceError(null);

    fetch(`/api/pricing-data?site=${site}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok || body?.error) {
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        if (!body.installer) {
          throw new Error(`Fant ingen installatør «${site}»`);
        }
        if (!body.commission) {
          throw new Error("Fant ingen provisjonssatser");
        }
        return body;
      })
      .then((body) => {
        if (!cancelled) setPricingData(body);
      })
      .catch((err) => {
        console.error("Feil ved henting av prisdata:", err);
        if (!cancelled) setPriceError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [site]);

  return { pricingData, priceError };
}
