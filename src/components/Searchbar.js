"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function Searchbar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showError, setShowError] = useState(false); // Ny tilstand for feilmeldingen
  const searchParams = useSearchParams();

  const site = searchParams.get("site");

  const router = useRouter();

  const handleSearch = async () => {
    setShowError(false); // Skjul feilmeldingen midlertidig
    if (query !== null && query !== "") {
      try {
        const response = await fetch(`/api/search?query=${query}`);
        if (!response.ok) throw new Error("API-feil: " + response.status);

        const data = await response.json();
        const suggestions = data.Options.map((option) => ({
          text: option.Text,
          id: option.PayLoad.AdresseMatrikkelNummer,
          latlng: {
            lat: option.PayLoad.Posisjon.Y,
            lng: option.PayLoad.Posisjon.X,
          },
        }));
        setResults(suggestions);

        // Skjul feilmeldingen hvis vi har resultater
        if (suggestions.length > 0) {
          setShowError(false);
        } else {
          // Vis feilmeldingen etter 1 sekund
          setTimeout(() => {
            setShowError(true);
          }, 1000);
        }
      } catch (error) {
        console.log("Søkeforespørsel feilet: ", error);
        // Vis feilmeldingen etter 1 sekund
        setTimeout(() => {
          setShowError(true);
        }, 1000);
      }
    }
  };

  const handleAddressSelect = (address) => {
    const url = `/map?lat=${address.latlng.lat}&lng=${address.latlng.lng}&address=${address.text}&addressId=${address.id}&site=${site}`;
    router.push(url);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div
        className="flex flex-row w-full justify-between border p-2 bg-white gap-2 rounded-xl"
        style={{ maxWidth: "550px" }}
      >
        <div className="flex flex-row gap-2 w-full">
          <img src="/pin.png" className="h-8" />
          <input
            type="text"
            placeholder="Søk på din adresse her"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyUp={handleSearch}
            className="w-full focus:outline-none"
          />
        </div>

        <img src="/search.png" className="h-8" />
      </div>
      <div style={{ maxWidth: "450px" }} className="relative">
        {results.length > 0 && (
          <ul className="absolute left-0 right-0 bg-white border mt-1 max-h-60 overflow-y-auto">
            {results.map((result, index) => (
              <li
                key={index}
                className="p-2 hover:bg-gray-200 cursor-pointer"
                onClick={() => handleAddressSelect(result)}
              >
                {result.text}
              </li>
            ))}
          </ul>
        )}
        {showError && query.length >= 3 && results.length === 0 && (
          <p
            style={{ backgroundColor: "#FFDED2", color: "#A44813" }}
            className="text-xs p-1 rounded-md"
          >
            Ups! Vi klarte ikke å finne adressen din. Vennligst dobbeltsjekk og
            prøv igjen.
          </p>
        )}
      </div>
    </div>
  );
}
