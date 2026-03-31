"use client";
import { useEffect, useState } from "react";

export function usePricingData(site) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!site) return;

    fetch(`/api/pricing-data?site=${site}`)
      .then((res) => res.json())
      .then(setData);
  }, [site]);

  return data;
}
