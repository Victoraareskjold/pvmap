import { useEffect, useState } from "react";

/**
 *
 * @returns {{
 *   panelTypes: Array<{ NAVN: string, PRIS: number, WATTAGE: number }>,
 *   isLoading: boolean,
 *   error: string | null
 * }}
 */
export function usePanelTypes() {
  const [panelTypes, setPanelTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/panel-types")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setPanelTypes(data))
      .catch((err) => {
        console.error("Feil ved henting av paneltyper:", err);
        setError(err.message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { panelTypes, isLoading, error };
}
