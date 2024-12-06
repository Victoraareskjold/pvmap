"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Searchbar() {
  const [query, setQuery] = useState("Strømbråtenveien 37");
  const [results, setResults] = useState([]);
  const router = useRouter();

  const handleSearch = async () => {
    if (query !== null && query !== "") {
      try {
        const response = await fetch(`/api/search?query=${query}`);
        if (!response.ok) throw new Error("API-feil: " + response.status);

        const data = await response.json();
        const suggestions = data.Options.map((option) => ({
          text: option.Text,
          id: option.Id,
          latlng: {
            lat: option.PayLoad.Posisjon.Y,
            lng: option.PayLoad.Posisjon.X,
          },
        }));
        setResults(suggestions);
        console.log(data);
      } catch (error) {
        console.log("Søkeforespørsel feilet: ", error);
      }
    }

    return [];
  };

  const handleAddressSelect = (address) => {
    const url = `/map?lat=${address.latlng.lat}&lng=${address.latlng.lng}&address=${address.text}&addressId=${address.id}`;

    router.push(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row gap-2">
        <input
          type="text"
          placeholder="Søk på din adresse her"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyUp={handleSearch}
          className="border p-2"
        />
      </div>
      <div className="relative">
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
        {results.length === 0 && query.length >= 3 && <p>Ingen resultater</p>}
      </div>
    </div>
  );
}
