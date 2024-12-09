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
import PriceEstimator from "@/components/PriceEstimator";
import Image from "next/image";

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
  const [selectedElPrice, setSelectedElPrice] = useState(1);

  const [combinedData, setCombinedData] = useState([]);
  const [adjustedPanelCounts, setAdjustedPanelCounts] = useState({});
  const [isChecked, setIsChecked] = useState({});

  const [yearlyProd, setYearlyProd] = useState(0);
  const [potentialSaving, setPotentialSaving] = useState(0);
  const [yearlyCost, setYearlyCost] = useState(0);

  const [apiKey, setApiKey] = useState(null);

  const minPanels = 0;

  const handleRoofTypeChange = (value) => {
    setSelectedRoofType(value);
  };

  const handlePanelTypeChange = (value) => {
    setSelectedPanelType(value);
  };

  const handleSelectedElPrice = (value) => {
    setSelectedElPrice(value);
  };

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await fetch("/api/apiKey");
        const data = await response.json();

        if (data.apiKey) {
          setApiKey(data.apiKey);
        }
      } catch (error) {
        console.error("Feil ved henting av API-nøkkel:", error);
      }
    };

    fetchApiKey();
  }, []);

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
          if (data.panels.panelCount <= minPanels) return { ...data, pv: null };

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
          acc[roof.id] = 0; // Start med 0 paneler for alle
          return acc;
        }, {});

        // Finn takflaten med høyest produksjon
        const roofWithMaxProduction = fullData.reduce(
          (maxRoof, currentRoof) => {
            const maxOutput = maxRoof.pv?.outputs.totals.fixed.E_y || 0;
            const currentOutput = currentRoof.pv?.outputs.totals.fixed.E_y || 0;
            return currentOutput > maxOutput ? currentRoof : maxRoof;
          },
          fullData[0]
        );

        // Sett initial panelCount for den takflaten med høyest produksjon
        initialPanelCounts[roofWithMaxProduction.id] =
          roofWithMaxProduction.panels.panelCount;
        setAdjustedPanelCounts(initialPanelCounts);

        // 6. Sett kun takflaten med høyest produksjon til checked
        const initialChecked = fullData.reduce((acc, roof) => {
          acc[roof.id] = roof.id === roofWithMaxProduction.id;
          return acc;
        }, {});
        setIsChecked(initialChecked);
      } catch (error) {
        console.error("Feil under datahåndtering:", error.message);
      }
    };
    fetchData();
  }, [selectedPanelType, addressId, lat, lng]);

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
  }, [adjustedPanelCounts, isChecked, combinedData, selectedElPrice]);

  useEffect(() => {
    let map;

    if (lat && lng && apiKey) {
      if (L.DomUtil.get("map")?._leaflet_id) {
        L.DomUtil.get("map")._leaflet_id = null;
      }
      map = L.map("map").setView([lat, lng], 25);

      webatlasTileLayer({
        apiKey: apiKey,
        mapType: WebatlasTileLayerTypes.AERIAL,
      }).addTo(map);

      if (combinedData.length > 0) {
        combinedData.forEach((roof) => {
          if (roof.panels.panelCount <= minPanels) {
            return;
          }
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

              function getColorCategory(azimuth, tilt) {
                if (Math.abs(azimuth) <= 10 && tilt >= 20 && tilt <= 60) {
                  return "red"; // Svært god
                } else if (
                  Math.abs(azimuth) <= 30 &&
                  tilt >= 20 &&
                  tilt <= 60
                ) {
                  return "orange"; // God
                } else if (Math.abs(azimuth) <= 90 && tilt >= 0 && tilt <= 60) {
                  return "yellow"; // Middels
                } else if (
                  Math.abs(azimuth) <= 120 &&
                  tilt >= 10 &&
                  tilt <= 80
                ) {
                  return "green"; // Under middels
                } else {
                  return "blue"; // Dårlig
                }
              }

              /* Min løsning */
              /* let color;
              let yearlyOutput = roof.pv?.outputs.totals.fixed.E_y / roof.area;

              if (yearlyOutput < 125) {
                color = "red";
              } else if (yearlyOutput < 275) {
                color = "orange";
              } else color = "green"; */

              /* const polygon = L.polygon(cleanedCoordinates, {
                color: "black",
                fillColor: isChecked[roof.id] ? color : "grey",
                fillOpacity: isChecked[roof.id] ? 1 : 0.5,
                weight: 1,
              }).addTo(map); */

              const polygon = L.polygon(cleanedCoordinates, {
                color: "black",
                fillColor: getColorCategory(roof.direction - 180, roof.angle),

                fillOpacity: 1,
                weight: isChecked[roof.id] ? 4 : 1,
              }).addTo(map);

              polygon.on("click", () => {
                toggleRoof(roof.id, !isChecked[roof.id]);
              });
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
  }, [lat, lng, combinedData, isChecked, apiKey]);

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

  useEffect(() => {
    const totalSaving = yearlyProd * selectedElPrice;
    setPotentialSaving(totalSaving);
  }, [yearlyProd, selectedElPrice]);

  const getNumbers = (str) => {
    let matches = str.match(/(\d+)/);

    if (matches) {
      return matches[0];
    }
  };

  const handleSendData = () => {
    console.log("pressed");
  };

  return (
    <div className="flex flex-col m-w-5xl w-full md:flex-row gap-2">
      {/* Map */}
      <div className="w-full">
        <div id="map" className="map hidden md:block"></div>
        <PriceEstimator onSelect={handleSelectedElPrice} />
      </div>

      {/* Info */}
      <div className="flex flex-col gap-8 p-4 w-full">
        <h1 className="text-xl">Adresse: {address}</h1>
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
        <p className="text-sm">
          Takflater på eiendommen - Sortert fra mest til minst solinnstråling
        </p>

        {combinedData.length > 0 && (
          <ul>
            {combinedData

              .sort((a, b) => {
                const outputA = a.pv?.outputs.totals.fixed.E_y || 0;
                const outputB = b.pv?.outputs.totals.fixed.E_y || 0;
                return outputB - outputA;
              })
              .map((roof, index) => {
                const adjustedCount =
                  adjustedPanelCounts[roof.id] ?? roof.panels.panelCount;

                if (roof.panels.panelCount >= minPanels) {
                  const visibleIndex =
                    combinedData
                      .filter((r) => r.panels.panelCount >= 1)
                      .findIndex((r) => r.id === roof.id) + 1;

                  return (
                    <li key={index} className="cursor-pointer">
                      <div className="flex flex-row w-full gap-8 py-4">
                        {/* Check */}
                        <input
                          type="checkbox"
                          className="scale-150"
                          checked={isChecked[roof.id]}
                          onChange={(e) =>
                            toggleRoof(roof.id, e.target.checked)
                          }
                        ></input>

                        {/* Tak */}
                        <p className="shrink-0 self-center text-xl">
                          Tak {visibleIndex}
                        </p>

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
                      <div className="w-full bg-black h-px"></div>
                    </li>
                  );
                }
                return null;
              })}
          </ul>
        )}

        <div className="flex flex-row gap-4 justify-between">
          <p className="self-center text-xl">
            Sum paneler{" "}
            <span className="font-medium">({selectedPanelType})</span>:
          </p>
          <p className="bg-orange-500 p-2 rounded-md border border-white text-white">
            {Object.values(adjustedPanelCounts).reduce(
              (total, count) => total + count,
              0
            )}{" "}
            paneler
          </p>
        </div>
        <p className="text-sm">
          Panelene leveres med 30 års produkt- og effektgaranti. Prisen
          inkluderer alt fra A-Å, uten skjulte kostnader – komplett
          solcelleanlegg.
        </p>

        <ul className="flex flex-col gap-4">
          <li className="flex flex-row justify-between font-light">
            <div className="flex flex-row gap-2">
              <Image src="/info.svg" width={20} height={20} alt="info" />
              <p>Din forventet årlig strømproduksjon (kWh): </p>
            </div>
            <p className="text-end text-xl">{yearlyProd.toFixed(0)} kWh</p>
          </li>
          <li className="flex flex-row justify-between font-light">
            <div className="flex flex-row gap-2">
              <Image src="/info.svg" width={20} height={20} alt="info" />
              <p>Din forventet årlig besparelse/inntekt: </p>
            </div>
            <p className="text-end text-xl">{potentialSaving.toFixed(0)} Kr</p>
          </li>
          <li className="flex flex-row justify-between font-light">
            <div className="flex flex-row gap-2">
              <Image src="/info.svg" width={20} height={20} alt="info" />
              <p>Din forventet kostnad per år: </p>
            </div>
            <p className="text-end text-xl">{yearlyCost.toFixed(0)} Kr</p>
          </li>
        </ul>

        <button
          onClick={handleSendData}
          className="bg-red-500 self-center w-48 py-1 rounded-md text-sm"
        >
          Jeg ønsker tilbud
        </button>
      </div>
      {/* End of info */}
    </div>
  );
}
