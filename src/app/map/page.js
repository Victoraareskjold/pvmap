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

  const [selectedRoofType, setSelectedRoofType] = useState(
    "Takstein (Dobbelkrummet)"
  );
  const [selectedPanelType, setSelectedPanelType] = useState("Premium - 410 W");

  const [combinedData, setCombinedData] = useState([]);
  const [adjustedPanelCounts, setAdjustedPanelCounts] = useState({});
  const [isChecked, setIsChecked] = useState({});

  const [yearlyProd, setYearlyProd] = useState(0);
  const [potentialSaving, setPotentialSaving] = useState(0);
  const [yearlyCost, setYearlyCost] = useState(0);

  const handleRoofTypeChange = (value) => {
    setSelectedRoofType(value);
  };

  const handlePanelTypeChange = (value) => {
    setSelectedPanelType(value);
  };

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
          }&aspect=${data.direction - 180}&angle=${
            data.angle
          }&panelWattage=${getNumbers(selectedPanelType)}`;
          try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error("Feil i PVGIS API");
            const pvData = await response.json();

            const efficiencyPerPanel =
              pvData.outputs.totals.fixed.E_y / data.panels.panelCount;

            return { ...data, pv: pvData, efficiencyPerPanel };
          } catch (error) {
            console.error("Feil ved henting av PVGIS-data:", error.message);
            return { ...data, pv: null };
          }
        });

        // 4. Kombiner alt og oppdater tilstand
        const fullData = await Promise.all(pvPromises);
        setCombinedData(fullData);

        // 5. Sett initiale verdier for adjustedPanelCounts
        const initialPanelCounts = fullData.reduce((acc, roof) => {
          acc[roof.id] = roof.panels.panelCount; // Bruk opprinnelig panelCount
          return acc;
        }, {});
        setAdjustedPanelCounts(initialPanelCounts);

        // 6. Sett alle takflater til checked
        const intitialChecked = fullData.reduce((acc, roof) => {
          acc[roof.id] = true;
          return acc;
        }, {});
        setIsChecked(intitialChecked);
      } catch (error) {
        console.error("Feil under datahåndtering :", error.message);
      }
    };
    fetchData();
  }, [selectedPanelType, addressId, lat, lng]);

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

  const toggleRoof = (roofId, isCheckedNow) => {
    setIsChecked((prev) => ({
      ...prev,
      [roofId]: isCheckedNow,
    }));

    setAdjustedPanelCounts((prev) => ({
      ...prev,
      [roofId]: isCheckedNow
        ? combinedData.find((r) => r.id === roofId)?.panels.panelCount
        : 0,
    }));
  };

  useEffect(() => {
    const totalProduction = combinedData.reduce((sum, roof) => {
      if (isChecked[roof.id]) {
        const adjustedCount =
          adjustedPanelCounts[roof.id] || roof.panels.panelCount;
        const roofProduction = (roof.efficiencyPerPanel || 0) * adjustedCount;
        return sum + roofProduction;
      }
      return sum;
    }, 0);

    setYearlyProd(totalProduction);
  }, [adjustedPanelCounts, isChecked, combinedData]);

  const getNumbers = (str) => {
    let matches = str.match(/(\d+)/);

    if (matches) {
      return matches[0];
    }
  };

  return (
    <div className="flex flex-col m-w-5xl w-full md:flex-row gap-2">
      {/* Map */}
      <div>
        <div id="map" className="map"></div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-4 p-4 w-full">
        <h1>Adresse: {address}</h1>
        <div className="flex flex-row gap-8 md:flex-col xl:flex-row">
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
            onSelect={handleRoofTypeChange}
          />
          <SelectOption
            title="Paneltype:"
            options={["Premium - 410 W", "Pro - 440 W", "Max Power - 455 W"]}
            onSelect={handlePanelTypeChange}
          />
        </div>
        <p>
          Takflater på eiendommen - Sortert fra mest til minst solinnstråling
        </p>

        {combinedData.length > 0 && (
          <ul>
            {combinedData.map((roof, index) => {
              const adjustedCount =
                adjustedPanelCounts[roof.id] ?? roof.panels.panelCount;

              return roof.panels.panelCount >= 6 ? (
                <li key={index} className="cursor-pointer">
                  <div className="flex flex-row w-full gap-8 py-4">
                    {/* Check */}
                    <input
                      type="checkbox"
                      className="scale-150"
                      checked={isChecked[roof.id]}
                      onChange={(e) => toggleRoof(roof.id, e.target.checked)}
                    ></input>

                    {/* Tak */}
                    <p className="shrink-0 self-center">Tak {roof.id + 1}</p>

                    {/* Slider */}
                    <input
                      type="range"
                      min="6"
                      max={roof.panels.panelCount}
                      className="w-full sliderStyling self-center"
                      value={adjustedCount}
                      disabled={!isChecked[roof.id]}
                      onChange={(e) => {
                        const newValue = Number(e.target.value);
                        setAdjustedPanelCounts((prev) => ({
                          ...prev,
                          [roof.id]: newValue,
                        }));
                      }}
                    />

                    {/* Panelcount */}
                    <p className="bg-orange-500 p-1 rounded-md border border-white text-white shrink-0 min-w-24 text-center">
                      {adjustedCount} paneler
                    </p>

                    {/* Direction */}
                    <p className="border border-black border-2 rounded-full w-8 h-8 shrink-0 text-center self-center flex items-center justify-center">
                      {evaluateDirection(roof.direction)}
                    </p>
                  </div>

                  {/* Divider */}
                  {index < combinedData.length - 1 && (
                    <div className="w-full bg-black h-px"></div>
                  )}
                </li>
              ) : null;
            })}
          </ul>
        )}

        <div className="flex flex-row gap-4 justify-between">
          <p className="self-center">Sum paneler ({selectedPanelType}):</p>
          <p className="bg-orange-500 p-2 rounded-md border border-white text-white">
            {Object.values(adjustedPanelCounts).reduce(
              (total, count) => total + count,
              0
            )}{" "}
            paneler
          </p>
        </div>
        <p>
          Panelene leveres med 30 års produkt- og effektgaranti. Prisen
          inkluderer alt fra A-Å, uten skjulte kostnader – komplett
          solcelleanlegg.
        </p>

        <ul>
          <li className="flex flex-row justify-between">
            <div>Din forventet årlig strømproduksjon (kWh): </div>
            <div className="text-end">{yearlyProd.toFixed(0)} kWh</div>
          </li>
          <li className="flex flex-row justify-between">
            <div>Din forventet årlig besparelse/inntekt: </div>
            <div className="text-end">{potentialSaving} Kr</div>
          </li>
          <li className="flex flex-row justify-between">
            <div>Din forventet kostnad per år: </div>
            <div className="text-end">{yearlyCost} Kr</div>
          </li>
        </ul>

        <button className="bg-red-500">Jeg ønsker tilbud</button>
      </div>
      {/* End of info */}
    </div>
  );
}
