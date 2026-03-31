import { useEffect, useState } from "react";

/**
 *
 * @returns {{
 *   roofTypes: Array<{ name: string, PRIS: number }>,
 *   isLoading: boolean,
 *   error: string | null
 * }}
 */
export function useRoofTypes() {
  const [roofTypes, setRoofTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/roof-types")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setRoofTypes(data))
      .catch((err) => {
        console.error("Feil ved henting av taktyper:", err);
        setError(err.message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { roofTypes, isLoading, error };
}
