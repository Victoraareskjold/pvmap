"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-webatlastile";
import SelectOption from "@/components/SelectOption";
import {
  webatlasTileLayer,
  WebatlasTileLayerTypes,
} from "leaflet-webatlastile";

export default function Map() {
  const searchParams = useSearchParams();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const address = searchParams.get("address");
  const addressId = searchParams.get("addressId");

  const [combinedData, setCombinedData] = useState([]);

  const [yearlyProd, setYearlyProd] = useState(0);
  const [potentialSaving, setPotentialSaving] = useState(0);
  const [yearlyCost, setYearlyCost] = useState(0);

  useEffect(() => {
    if (!addressId) return;

    const fetchData = async () => {
      try {
        // 1. Hent takdata
        const roofResponse = await fetch(`/api/roof?addressId=${addressId}`);
        if (!roofResponse.ok) {
          console.error(
            "Feil ved henting av takdata: ",
            roofResponse.statusText
          );
          return;
        }
        const roofData = await roofResponse.json();

        // 2. Generer Solcelledata
        const solarData = roofData.map((roof, index) => {
          const panelWidth = 1.1;
          const panelHeight = 1.7;
          const vPanels = Math.floor(roof.Lengde / panelWidth);
          const hPanels = Math.floor(roof.Bredde / panelHeight);
          const panelCount = vPanels * hPanels;

          return {
            id: index,
            area: roof.Areal3D,
            coordinates: roof.Geometri,
            direction: roof.Retning,
            angle: roof.Helning,
            panels: {
              panelCount,
              vPanels,
              hPanels,
            },
            pv: null,
          };
        });

        // 3. Hent PVGIS-data for hver takflate
        const pvPromises = solarData.map(async (data) => {
          if (data.panels.panelCount === 0) return { ...data, pv: null };

          const apiUrl = `/api/pvgis?lat=${lat}&lng=${lng}&panelCount=${
            data.panels.panelCount
          }&aspect=${data.direction - 180}&angle=${data.angle}`;
          try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error("Feil i PVGIS API");
            const pvData = await response.json();
            return { ...data, pv: pvData };
          } catch (error) {
            console.error("Feil ved henting av PVGIS-data:", error.message);
            return { ...data, pv: null };
          }
        });

        // 4. Kombiner alt og oppdater tilstand
        const fullData = await Promise.all(pvPromises);
        setCombinedData(fullData);
      } catch (error) {
        console.error("Feil under datahåndtering :", error.message);
      }
    };
    fetchData();
  }, [addressId, lat, lng]);

  useEffect(() => {
    let map;

    if (lat && lng) {
      if (L.DomUtil.get("map")?._leaflet_id) {
        L.DomUtil.get("map")._leaflet_id = null;
      }
      map = L.map("map").setView([lat, lng], 25);

      webatlasTileLayer({
        apiKey: process.env.NEXT_PUBLIC_NORKART_API_KEY,
        mapType: WebatlasTileLayerTypes.AERIAL,
      }).addTo(map);

      if (combinedData.length > 0) {
        combinedData.forEach((roof) => {
          try {
            const coordinates = JSON.parse(roof.coordinates);

            if (
              coordinates &&
              coordinates.coordinates &&
              coordinates.coordinates[0]
            ) {
              const cleanedCoordinates = coordinates.coordinates[0].map(
                ([lng, lat]) => [lat, lng]
              );

              let color;
              let yearlyOutput = roof.pv.outputs.totals.fixed.E_y / roof.area;
              console.log(yearlyOutput);

              if (yearlyOutput < 100) {
                color = "red";
              } else if (yearlyOutput < 200) {
                color = "orange";
              } else color = "green";

              L.polygon(cleanedCoordinates, {
                color: color,
                fillColor: color,
                fillOpacity: 0.7,
                stroke: 1,
              }).addTo(map);
            } else {
              console.warn(
                "Koordinater er ikke tilgjengelige for takflate:",
                roof.id
              );
            }
          } catch (error) {
            console.error("Feil ved parsing av koordinater:", error);
          }
        });
      }
    }

    return () => {
      if (map) map.remove();
    };
  }, [lat, lng, combinedData]);

  const evaluateDirection = (direction) => {
    const normalizedDirection = direction % 360;

    if (normalizedDirection >= 315 || normalizedDirection < 45) {
      return "N";
    } else if (normalizedDirection >= 45 && normalizedDirection < 135) {
      return "Ø";
    } else if (normalizedDirection >= 135 && normalizedDirection < 225) {
      return "S";
    } else {
      return "V";
    }
  };

  console.log(combinedData, "combined data");

  return (
    <div className="flex flex-row m-w-5xl w-full">
      {/* Map */}
      <div>
        <div id="map" style={{ width: "50vw", aspectRatio: 1 / 1 }}></div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-4 p-4 w-full">
        <h1>Adresse: {address}</h1>
        <div className="flex flex-row gap-8">
          <SelectOption
            title="Taktype:"
            options={[
              "Takstein (Dobbelkrummet)",
              "Takstein (Enkeltkrummet)",
              "Glassert takstein",
              "Flat takstein",
              "Shingel/Takpapp",
              "Trapes",
              "Flatt tak",
              "Integrert i taket",
              "Decra",
              "Bølgeblikk",
            ]}
          />
          <SelectOption
            title="Paneltype:"
            options={["Premium - 410 W", "Pro - 440 W", "Max Power - 455 W"]}
          />
        </div>
        <p>
          Takflater på eiendommen - Sortert fra mest til minst solinnstråling
        </p>

        {combinedData.length > 0 && (
          <ul>
            {combinedData.map((roof, index) => (
              <li key={index} className="p-2 cursor-pointer">
                <div className="flex flex-row">
                  <input type="checkbox" defaultChecked></input>
                  <p>Tak {roof.id + 1}</p>
                  <p className="bg-orange-500 p-1 rounded-md border border-white text-white">
                    {roof.panels.panelCount}
                  </p>
                  <p className="border border-black rounded-full w-8 h-8">
                    {evaluateDirection(roof.direction)}
                  </p>
                </div>

                <div className="w-full bg-black h-px"></div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-row gap-4">
          <p>Sum paneler (Premium 410W): </p>
          <p className="bg-orange-500 p-2 rounded-md border border-white text-white"></p>
        </div>
        <p>
          Panelene leveres med 30 års produkt- og effektgaranti. Prisen
          inkluderer alt fra A-Å, uten skjulte kostnader – komplett
          solcelleanlegg.
        </p>
        <div>
          <div className="flex flex-row justify-between">
            <div>Din forventet årlig strømproduksjon (kWh): </div>
            <div className="text-end">{yearlyProd}</div>
          </div>
          <div className="flex flex-row justify-between">
            <div>Din forventet årlig besparelse/inntekt: </div>
            <div className="text-end">{potentialSaving}</div>
          </div>
          <div className="flex flex-row justify-between">
            <div>Din forventet kostnad per år: </div>
            <div className="text-end">{yearlyCost}</div>
          </div>
        </div>
        <button className="bg-red-500">Jeg ønsker tilbud</button>
      </div>
      {/* End of info */}
    </div>
  );
}
