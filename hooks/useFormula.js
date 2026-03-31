import { useEffect, useState } from "react";

/**
 *
 * @param {string} site
 * @returns {{
 *   formula: number | null,
 *   isLoading: boolean,
 *   error: string | null
 * }}
 */
export function useFormula(site) {
  const [formula, setFormula] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!site || site === "null") {
      setIsLoading(false);
      return;
    }

    fetch(`/api/formula?site=${site}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setFormula(Number(data.FORMEL)))
      .catch((err) => {
        console.error("Feil ved henting av formel:", err);
        setError(err.message);
      })
      .finally(() => setIsLoading(false));
  }, [site]);

  return { formula, isLoading, error };
}
