"use client";
import SelectOption from "@/components/SelectOption";
import L from "leaflet";
import "leaflet-webatlastile";
import {
  webatlasTileLayer,
  WebatlasTileLayerTypes,
} from "leaflet-webatlastile";
import "leaflet/dist/leaflet.css";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function Map() {
  const searchParams = useSearchParams();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const address = searchParams.get("address");
  const addressId = searchParams.get("addressId");
  const [roofData, setRoofData] = useState([]);
  const [solarData, setSolarData] = useState([]);
  const [pvData, setPvData] = useState([]);

  const totalPanelCount = solarData.reduce(
    (acc, solar) => acc + solar.panelCount,
    0
  );

  const [yearlyProd, setYearlyProd] = useState(0);
  const [potentialSaving, setPotentialSaving] = useState(0);
  const [yearlyCost, setYearlyCost] = useState(0);

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
          const solarData = data.map((roof, index) => ({
            id: index,
            coordinate: roof.Geometri,
            length: roof.Lengde,
            width: roof.Bredde,
            hPanels: 0,
            vPanels: 0,
            panelCount: 0,
            direction: roof.Retning,
            angle: roof.Helning,
          }));
          setRoofData(data);
          setSolarData(solarData);
        } catch (error) {
          console.error("Feil under henting av takdata:", error.message);
        }
      };

      fetchRoofData();
    }
  }, [addressId]);

  useEffect(() => {
    if (roofData.length > 0) {
      let panelWidth = 1;
      let panelHeight = 1.7;

      const updatedSolarData = solarData.map((solar) => {
        const vPanels = Math.floor(solar.length / panelHeight);
        const hPanels = Math.floor(solar.width / panelWidth);
        const panelCount = hPanels * vPanels;
        const aspect = solar.direction; // Retning for takflaten (Azimuth)
        const angle = solar.angle; // Vinkel for takflaten (Tilt)

        return { ...solar, hPanels, vPanels, panelCount, aspect, angle };
      });
      setSolarData(updatedSolarData);
    }
  }, [roofData]);

  useEffect(() => {
    let map;

    if (lat && lng) {
      if (L.DomUtil.get("map")?._leaflet_id) {
        L.DomUtil.get("map")._leaflet_id = null;
      }
      map = L.map("map").setView([lat, lng], 25);

      webatlasTileLayer({
        //Skjul api?
        apiKey: process.env.NEXT_PUBLIC_NORKART_API_KEY,
        mapType: WebatlasTileLayerTypes.AERIAL,
      }).addTo(map);
    }

    return () => {
      if (map) map.remove();
    };
  }, [lat, lng, roofData]);

  useEffect(() => {
    const fetchPVDataForEachRoof = async () => {
      if (lat && lng && solarData.length > 0) {
        const allRoofData = [];

        // For hver takflate, gjør et API-kall
        for (const solar of solarData) {
          const { id, panelCount, aspect, angle } = solar;
          if (panelCount > 0) {
            try {
              const apiUrl = `/api/pvgis?lat=${lat}&lng=${lng}&panelCount=${panelCount}&aspect=${
                aspect - 180
              }&angle=${angle}`;
              const response = await fetch(apiUrl);

              if (!response.ok) {
                console.error(
                  `Feil med statuskode ${response.status}:`,
                  response.statusText
                );
                continue;
              }

              const data = await response.json();
              allRoofData.push({ id, data });
            } catch (error) {
              console.error("Feil under henting av PVGIS data:", error.message);
            }
          }
        }

        setPvData(allRoofData);
      }
    };
    fetchPVDataForEachRoof();
  }, [lat, lng, solarData]);

  console.log(roofData);
  console.log(solarData);
  console.log(pvData, "her");

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
            options={[
              "Premium all black, 430W",
              "Performance all black, 460W Bifacial",
            ]}
          />
        </div>
        <p>
          Takflater på eiendommen - Sortert fra mest til minst solinnstråling
        </p>

        {solarData.length > 0 && (
          <ul>
            {solarData.map((solar, index) => (
              <li key={index} className="p-2 cursor-pointer">
                <div className="flex flex-row">
                  <input type="checkbox" defaultChecked></input>
                  <p>Takflate {solar.panelCount}</p>
                  {/* <Slider
                    label={`Takflate ${index + 1}`}
                    min={0}
                    max={Math.floor(
                      (solar.length * solar.width) / (panelWidth * panelHeight)
                    )} // Maks antall paneler basert på areal
                    step={1}
                    value={solar.panelCount}
                    onChange={(value) => {
                      const updatedSolarData = solarData.map((item, i) =>
                        i === index ? { ...item, panelCount: value } : item
                      );
                      setSolarData(updatedSolarData);
                      setTotalPanels(updatePanelCount(updatedSolarData)); // Oppdater totalen samtidig
                    }}
                  /> */}
                </div>

                <div className="w-full bg-black h-px"></div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-row gap-4">
          <p>Sum paneler (Premium all black, 430W): </p>
          <p className="bg-orange-500 p-2 rounded-md border border-white text-white">
            {totalPanelCount} {totalPanelCount > 1 ? "Paneler" : "Panel"}
          </p>
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
