"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-webatlastile";

export default function Map() {
  const searchParams = useSearchParams();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const address = searchParams.get("address");
  const addressId = searchParams.get("addressId");
  const [roofData, setRoofData] = useState(null);

  useEffect(() => {
    if (addressId) {
      const fetchRoofData = async () => {
        try {
          const response = await fetch(`/api/roof?addressId=${addressId}`);
          if (!response.ok) {
            console.error(
              `Feil med statuskode ${response.status}:`,
              response.statusText
            );
            return;
          }
          const data = await response.json();
          setRoofData(data);
          console.log("RoofData:", data);
        } catch (error) {
          console.error("Feil under henting av takdata:", error.message);
        }
      };

      fetchRoofData();
    }
  }, [addressId]);

  useEffect(() => {
    // FJERN API NØKKEL
    let apiKey = process.env.NEXT_PUBLIC_NORKART_API_KEY;
    // FJERN API NØKKEL
    let map;

    if (lat && lng) {
      if (L.DomUtil.get("map")?._leaflet_id) {
        L.DomUtil.get("map")._leaflet_id = null;
      }
      map = L.map("map").setView([lat, lng], 25);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
        map
      );

      L.tileLayer(
        `https://waapi.webatlas.no/maptiles/tiles/webatlas-orto-newup/wa_grid/{z}/{x}/{y}.jpeg?APITOKEN=${apiKey}`,
        {
          attribution: "Norkart ©",
        }
      ).addTo(map);
    }

    return () => {
      if (map) map.remove();
    };
  }, [lat, lng, roofData]);

  return (
    <div>
      <h1>
        Adresse: {address} <br /> ID: {addressId}
      </h1>

      <div id="map" style={{ height: "500px" }}></div>

      {roofData && (
        <div>
          <h2>Takflatedata:</h2>
          <pre>{JSON.stringify(roofData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
