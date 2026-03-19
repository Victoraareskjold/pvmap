"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import SelectOption from "../../components/SelectOption";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import PanelMengde from "../../components/PanelMengde";
import PriceEstimator from "../../components/PriceEstimator";
import RoofList from "../../components/RoofList";
import SendModal from "../../components/SendModal";
import { useRoofTypes } from "../../../hooks/useRoofTypes";
import { usePanelTypes } from "../../../hooks/usePanelTypes";
import { useFormula } from "../../../hooks/useFormula";
import { calculatePricing } from "../../../hooks/calculatePricing";

// Dynamisk import av kartkomponenten
const MapComponent = dynamic(() => import("../../components/MapComponent"), {
  ssr: false,
});

export default function Map() {
  const searchParams = useSearchParams();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const address = searchParams.get("address");
  const addressId = searchParams.get("addressId");
  const site = searchParams.get("site");
  const router = useRouter();
  const pricesRef = useRef(null);

  const { roofTypes } = useRoofTypes();
  const { panelTypes } = usePanelTypes();
  const { formula } = useFormula(site);

  const [selectedRoofType, setSelectedRoofType] = useState("");
  const [selectedPanelType, setSelectedPanelType] = useState("");

  const [selectedElPrice, setSelectedElPrice] = useState(1.5);

  const [combinedData, setCombinedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [adjustedPanelCounts, setAdjustedPanelCounts] = useState({});

  const [visibleRoofs, setVisibleRoofs] = useState([]);

  const [isChecked, setIsChecked] = useState({});

  const [yearlyProd, setYearlyProd] = useState(0);
  const [potentialSaving, setPotentialSaving] = useState(0);
  const [yearlyCost, setYearlyCost] = useState(0);
  const [yearlyCost2, setYearlyCost2] = useState(0);

  const [apiKey, setApiKey] = useState(null);

  const [showModal, setShowModal] = useState(false);

  const [desiredKWh, setDesiredKWh] = useState("");
  const [coveragePercentage, setCoveragePercentage] = useState(40);
  const [errors, setErrors] = useState({ kWh: "", percentage: "" });
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [checkedRoofData, setCheckedRoofData] = useState({});

  const minPanels = 6;

  const totalPanels = Object.values(adjustedPanelCounts).reduce(
    (total, count) => total + count,
    0,
  );

  useEffect(() => {
    if (panelTypes.length > 0) {
      setSelectedPanelType(panelTypes[0].NAVN);
    }
  }, [panelTypes]);

  useEffect(() => {
    if (roofTypes.length > 0) {
      setSelectedRoofType(roofTypes[0].name);
    }
  }, [roofTypes]);

  const handleRoofTypeChange = (value) => {
    setSelectedRoofType(value);
  };

  const handlePanelTypeChange = (value) => {
    setSelectedPanelType(value);
  };

  const handleSelectedElPrice = (value) => {
    setSelectedElPrice(value);
  };

  const handleCloseModal = () => {
    setOpenModal(null);
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
            roofResponse.statusText,
          );
          return;
        }
        const roofData = await roofResponse.json();

        // 2. Generer Solcelledata
        const solarData = roofData.map((roof, index) => {
          const panelWidth = 1.1;
          const panelHeight = 1.7;
          const vPanels = Math.floor((roof.Lengde * 0.95) / panelWidth);
          const hPanels = Math.floor((roof.Bredde * 0.95) / panelHeight);
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

          const selectedPanel = panelTypes.find(
            (p) => p.NAVN === selectedPanelType,
          );
          const panelWattage = selectedPanel?.WATTAGE ?? 430;

          const apiUrl = `/api/pvgis?lat=${lat}&lng=${lng}&panelCount=${
            data.panels.panelCount
          }&aspect=${data.direction - 179}&angle=${
            data.angle + 1
          }&panelWattage=${panelWattage}`;

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

        const topTwoRoofs = fullData
          .sort((a, b) => {
            const outputA =
              a.pv?.outputs.totals.fixed.E_y / a.panels.panelCount || 0;
            const outputB =
              b.pv?.outputs.totals.fixed.E_y / b.panels.panelCount || 0;
            return outputB - outputA;
          })
          .slice(0, 2);

        // juster slider til å halvere med mindre det er < 12 paneler, da skal det til 6.
        const initialPanelCounts = fullData.reduce((acc, roof) => {
          if (topTwoRoofs.some((topRoof) => topRoof.id === roof.id)) {
            acc[roof.id] = Math.ceil(roof.panels.panelCount / 2);
          } else {
            acc[roof.id] = 0;
          }
          return acc;
        }, {});

        setAdjustedPanelCounts(initialPanelCounts);

        const initialChecked = fullData.reduce((acc, roof) => {
          acc[roof.id] = topTwoRoofs.some((topRoof) => topRoof.id === roof.id);
          return acc;
        }, {});

        setIsChecked(initialChecked);
      } catch (error) {
        console.error("Feil under datahåndtering:", error.message);
      }
    };
    fetchData();
  }, [selectedPanelType, addressId, lat, lng, panelTypes]);

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
    if (!totalPanels || !formula) return;

    const panelPrice =
      panelTypes.find((p) => p.NAVN === selectedPanelType)?.PRIS ?? 0;
    const roofPrice =
      roofTypes.find((r) => r.name === selectedRoofType)?.PRIS ?? 0;

    const { yearlyCostDirect, yearlyCostLoan } = calculatePricing({
      totalPanels,
      panelPrice,
      roofPrice,
      formula,
    });

    setYearlyCost(yearlyCostDirect);
    setYearlyCost2(yearlyCostLoan);
  }, [
    totalPanels,
    selectedPanelType,
    selectedRoofType,
    formula,
    panelTypes,
    roofTypes,
  ]);

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
    const roofData = combinedData.find((roof) => roof.id === roofId);
    setIsChecked((prev) => ({
      ...prev,
      [roofId]: isCheckedNow,
    }));
    console.log("id:", roofId);
    console.log("helning: ", roofData.angle);

    if (isCheckedNow) {
      setVisibleRoofs((prev) => [...prev, roofId]);
    } else {
      setVisibleRoofs((prev) => prev.filter((id) => id !== roofId));
    }

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

  const toggleTooltip = (tooltipKey) => {
    setActiveTooltip((prev) => (prev === tooltipKey ? null : tooltipKey));
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!event.target.closest(".tooltip-icon")) {
        setActiveTooltip(null);
      }
    };

    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, []);

  const handleCalculatePanels = (adjustedKWh = null) => {
    const newErrors = { kWh: "", percentage: "", calculation: "" };

    const effectiveKWh = adjustedKWh ?? desiredKWh;

    if (!effectiveKWh || effectiveKWh <= 0 || isNaN(effectiveKWh)) {
      newErrors.kWh = "Skriv inn ønsket årlig strømforbruk (kWh).";
    }

    setErrors(newErrors);
    if (newErrors.kWh || newErrors.percentage) return;

    const energyRequirement = (effectiveKWh * coveragePercentage) / 100;
    const maxCoverage = combinedData.reduce((sum, roof) => {
      return sum + (roof.efficiencyPerPanel || 0) * roof.panels.panelCount;
    }, 0);

    if (energyRequirement > maxCoverage) {
      const adjustedKWhValue = Math.floor(
        (maxCoverage / coveragePercentage) * 100,
      );

      setErrors((prev) => ({
        ...prev,
        calculation: `Maksimal dekning er ${adjustedKWhValue.toLocaleString(
          "nb-NO",
        )} kWh.`,
      }));

      setDesiredKWh(adjustedKWhValue);

      if (adjustedKWhValue !== effectiveKWh) {
        setTimeout(() => handleCalculatePanels(adjustedKWhValue), 0);
      }

      return;
    }

    let remainingEnergy = energyRequirement;
    const updatedPanelCounts = {};
    const updatedIsChecked = {};
    const updatedVisibleRoofs = [];

    const sortedRoofs = [...combinedData].sort(
      (a, b) => b.efficiencyPerPanel - a.efficiencyPerPanel,
    );

    for (const roof of sortedRoofs) {
      if (remainingEnergy <= 0) break;

      const panelsNeeded = Math.min(
        Math.ceil(remainingEnergy / (roof.efficiencyPerPanel || 1)),
        roof.panels.panelCount,
      );

      if (panelsNeeded > 0) {
        updatedIsChecked[roof.id] = true;
        updatedPanelCounts[roof.id] = panelsNeeded;
        updatedVisibleRoofs.push(roof.id);
        remainingEnergy -= panelsNeeded * (roof.efficiencyPerPanel || 0);
      }
    }

    setAdjustedPanelCounts(updatedPanelCounts);
    setIsChecked(updatedIsChecked);
    setVisibleRoofs(updatedVisibleRoofs);

    if (window.innerWidth < 768) {
      pricesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const updatedCheckedRoofData = combinedData
      .filter((roof) => isChecked[roof.id])
      .map((roof) => ({
        roofId: roof.id,
        adjustedPanelCount:
          adjustedPanelCounts[roof.id] || roof.panels.panelCount,
        maxPanels: roof.panels.panelCount,
        direction: roof.direction,
        angle: roof.angle,
      }));

    setCheckedRoofData(updatedCheckedRoofData);
  }, [
    isChecked,
    adjustedPanelCounts,
    combinedData,
    totalPanels,
    selectedElPrice,
    selectedRoofType,
    selectedPanelType,
    yearlyProd,
    yearlyCost,
    address,
  ]);

  useEffect(() => {
    const sortedData = combinedData.filter(
      (roof) => roof.panels.panelCount >= minPanels,
    );

    setVisibleRoofs(sortedData.slice(0, 2).map((roof) => roof.id));
  }, [combinedData, minPanels]);

  return (
    <div className="w-screen h-screen">
      <div className="flex flex-col md:flex-row w-full gap-2">
        {/* Top Section: Map */}
        <div className="w-full relative">
          <Suspense fallback={<div>Loading...</div>}>
            <img
              src="/colorGrading.png"
              alt="Color Grading Overlay"
              className="absolute z-20 w-20 right-3 top-12 rounded-md hidden md:block"
            />
            <MapComponent
              lat={lat}
              lng={lng}
              combinedData={combinedData}
              isChecked={isChecked}
              toggleRoof={toggleRoof}
              adjustedPanelCounts={adjustedPanelCounts}
              apiKey={apiKey}
            />
          </Suspense>
        </div>

        {/* Right Column: Address and Roof List */}
        <div className="flex flex-col gap-8 p-4 w-full md:max-w-3xl">
          {/* Address Section */}
          <div className="flex flex-row justify-between">
            <h1 className="text-xl">Adresse: {address}</h1>
            <button
              className="bg-black text-white rounded-full text-sm py-1.5 px-4"
              onClick={() => router.push("/")}
            >
              Nytt søk
            </button>
          </div>

          {/* Roof List and Calculator */}
          <div className="flex flex-col gap-6">
            <SelectOption
              title="Din taktype:"
              options={roofTypes.map((r) => r.name)}
              onSelect={handleRoofTypeChange}
            />
            <SelectOption
              title="Paneltype:"
              options={panelTypes.map((p) => p.NAVN)}
              onSelect={handlePanelTypeChange}
            />
          </div>

          <p className="italic text-gray-600 text-lg">
            Klikk på takflatene ovenfor i kartet for å legge til eller ta bort
          </p>
          <p className="text-lg text-center">
            Takflater på eiendommen - Sortert fra mest til minst solinnstråling
          </p>
          {/* Roof List */}
          {combinedData.length > 0 && (
            <div className="flex flex-col gap-4">
              <RoofList
                roofs={combinedData}
                visibleRoofs={visibleRoofs}
                toggleRoof={toggleRoof}
                evaluateDirection={evaluateDirection}
                isChecked={isChecked}
                adjustedPanelCounts={adjustedPanelCounts}
                setAdjustedPanelCounts={setAdjustedPanelCounts}
                minPanels={minPanels}
              />
              <div className="block md:hidden max-w-[32rem] mx-auto w-full">
                <PriceEstimator onSelect={handleSelectedElPrice} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid: Price Estimator, PanelMengde & Calculator */}
      <div className="flex flex-col lg:flex-row md:max-w-[32rem] lg:max-w-[60rem] gap-8 mx-auto mt-8 px-4">
        {/* Column 1 */}
        <div className="hidden md:flex flex-col space-y-8 w-full">
          <PriceEstimator onSelect={handleSelectedElPrice} />
          <PanelMengde
            selectedPanelType={selectedPanelType}
            totalPanels={totalPanels}
          />
        </div>

        {/* Column 2: Calculator */}
        <div className="calculator-container space-y-4 my-4 md:max-w-[32rem]">
          <h2>Finn ut hvor mange solcellepaneler du trenger</h2>
          <p>
            Skriv inn ditt årlige strømforbruk i kWh (for eksempel: *25 000*):
          </p>
          <div className="input-section">
            <div className="input-with-tooltip relative">
              <span
                className="tooltip-icon cursor-pointer"
                onClick={() => toggleTooltip("kwh")}
              >
                i
              </span>
              {activeTooltip === "kwh" && (
                <div className="tooltip-content absolute left-0 bottom-full mb-2 w-64 bg-black text-white p-2 rounded-md shadow-md">
                  Usikker på hvor mye strøm du bruker? En gjennomsnittlig
                  leilighet bruker 8 000 - 12 000 kwh per år, mens en enebolig
                  bruker 20 000 - 30 000 kwh. Sjekk din siste strømregning eller
                  kontakt strømleverandøren din for eksakt forbruk.
                </div>
              )}
              <input
                id="kwh-input"
                type="number"
                value={desiredKWh}
                className="fields"
                onChange={(e) => {
                  setDesiredKWh(e.target.value);
                }}
                placeholder="27 500"
              />
              <span className="">kWh</span>
            </div>
            {errors.kWh && <span className="error-message">{errors.kWh}</span>}
          </div>
          <p>
            Basert på et forbruk på{" "}
            <em>
              {desiredKWh ? desiredKWh.toLocaleString("nb-NO") : "27 500"}
            </em>{" "}
            kWh, anbefaler vi egen produksjon på{" "}
            <strong>
              <span className="ml-1">
                {(
                  (desiredKWh * coveragePercentage) / 100 || 11000
                ).toLocaleString("nb-NO")}{" "}
                kWh
              </span>
            </strong>
            .
          </p>
          <p>Dette vil dekke ditt årlige strømbehov med:</p>
          <div className="input-section">
            <div className="input-with-tooltip relative">
              <span
                className="tooltip-icon cursor-pointer"
                onClick={() => toggleTooltip("percentage")}
              >
                i
              </span>
              {activeTooltip === "percentage" && (
                <div className="tooltip-content absolute left-0 bottom-full mb-2 w-64 bg-black text-white p-2 rounded-md shadow-md">
                  Årlig strømforbruk burde dekke 30-60 % en av forbruket for
                  private husholdninger, avhengig av ønsket balanse mellom
                  investering og lønnsomhet. For næringsbygg anbefales ofte en
                  dekning på 80 % eller mer, spesielt dersom strømforbruket er
                  høyt og stabilt. Du kan justere dette feltet for å tilpasse
                  beregningen til ditt behov.
                </div>
              )}
              <input
                id="percent-input"
                type="number"
                value={coveragePercentage}
                onChange={(e) => {
                  let value = e.target.value;

                  if (value > 100) {
                    value = 100;
                  }

                  if (value < 0) {
                    value = 0;
                  }

                  setCoveragePercentage(value);
                }}
                placeholder="40"
                className="fields"
                min="0"
                max="100"
              />
              <span className="" style={{ width: "20px" }}>
                %
              </span>
            </div>
            {errors.percentage && (
              <span className="error-message">{errors.percentage}</span>
            )}
          </div>
          <p>
            Trykk på knappen for å beregne antall solcellepaneler du trenger for
            å oppnå
            <strong>
              <span className="ml-1">
                {(
                  (desiredKWh * coveragePercentage) / 100 || 11000
                ).toLocaleString("nb-NO")}
                kWh
              </span>
            </strong>
            .
          </p>
          <div className="flex items-center justify-between">
            <button
              id="calculate-button"
              className="calculate-button"
              onClick={() => handleCalculatePanels()}
            >
              Beregn paneler
            </button>
            {errors.calculation && (
              <span className="ml-4 text-red-500 text-sm whitespace-nowrap">
                {errors.calculation}
              </span>
            )}
          </div>
        </div>

        {/* End of calculator */}
        <div className="block md:hidden max-w-[32rem] mx-auto">
          <PanelMengde
            selectedPanelType={selectedPanelType}
            totalPanels={totalPanels}
          />
        </div>
      </div>

      <div
        className="md:col-span-2 flex flex-col items-center gap-6 mt-10 px-4"
        ref={pricesRef}
      >
        <ul className="flex flex-col gap-4">
          <li className="flex flex-col justify-between font-light relative gap-2">
            <div className="flex flex-row gap-2">
              <span
                className="tooltip-icon cursor-pointer self-center"
                onClick={() => toggleTooltip("1")}
              >
                i
              </span>
              {activeTooltip === "1" && (
                <div className="tooltip-content absolute left-0 bottom-full mb-2 w-64 bg-black text-white p-2 rounded-md shadow-md">
                  Estimert produksjon i kWh er basert på data fra PVGIS, som
                  bruker værdata fra perioden 2005–2020. Ønsker du et mer
                  nøyaktig estimat på din produksjon? Be om et helt
                  uforpliktende tilbud fra oss. Med et varmere klima og mer sol
                  i Norge de siste årene, kan du også forvente enda høyere
                  produksjon enn det historiske data viser.
                </div>
              )}
              <p className="font-medium text-lg">
                Din forventet årlig strømproduksjon (kWh):{" "}
              </p>
            </div>
            <p className="text-2xl ml-12 font-bold">
              = {""}
              {new Intl.NumberFormat("nb-NO").format(
                (yearlyProd * 0.95).toFixed(0),
              )}{" "}
              -{" "}
              {new Intl.NumberFormat("nb-NO").format(
                (yearlyProd * 1.05).toFixed(0),
              )}{" "}
              kWh
            </p>
            {/* Divider */}
            <div className="divider"></div>
          </li>
          <li className="flex flex-col justify-between font-light relative gap-2">
            <div className="flex flex-row gap-2">
              <span
                className="tooltip-icon cursor-pointer self-center"
                onClick={() => toggleTooltip("2")}
              >
                i
              </span>
              {activeTooltip === "2" && (
                <div className="tooltip-content absolute left-0 bottom-full mb-2 w-64 bg-black text-white p-2 rounded-md shadow-md">
                  Denne beregningen viser en estimert inntekt solcelleanlegget
                  kan gi deg ved å redusere strømregningen. Bruk skyveknappen i
                  boksen «Din estimerte gjennomsnittlige strømpris» for å
                  justere og se hva du kan spare. Beregningen er basert på
                  produksjon i kWh multiplisert med en estimert strømpris.
                  Ønsker du et mer presist anslag? Be om et tilbud, så gir vi
                  deg en tilpasset beregning av kWh-produksjonen for ditt hjem.
                </div>
              )}
              <p className="font-medium text-lg">
                Din forventet årlig besparelse/inntekt fra
                solcelleanlegget:{" "}
              </p>
            </div>
            <p className="text-2xl ml-12 font-bold">
              = {""}
              {new Intl.NumberFormat("nb-NO").format(
                potentialSaving.toFixed(0),
              )}{" "}
              Kr
            </p>
            {/* Divider */}
            <div className="divider"></div>
          </li>
          <li className="flex flex-col justify-between font-light relative gap-2">
            <div className="flex flex-row gap-2">
              <span
                className="tooltip-icon cursor-pointer self-center"
                onClick={() => toggleTooltip("3")}
              >
                i
              </span>
              {activeTooltip === "3" && (
                <div className="tooltip-content absolute left-0 bottom-full mb-2 w-64 bg-black text-white p-2 rounded-md shadow-md">
                  Denne beregningen viser hva solcelleanlegget vil koste deg per
                  år over 30 år. Laveste sum gjelder direktekjøp, mens høyeste
                  anslår kostnaden med miljølån. Be om et tilbud for konkrete
                  tall på både direktekjøp og månedlige kostnader med
                  finansiering.
                </div>
              )}

              <p className="font-medium text-lg">
                Årlig gjennomsnittskostnad for solcelleanlegget over 30 år:{" "}
              </p>
            </div>

            <p className="text-2xl ml-12 font-bold">
              = {new Intl.NumberFormat("nb-NO").format(yearlyCost.toFixed(0))} -{" "}
              {new Intl.NumberFormat("nb-NO").format(yearlyCost2.toFixed(0))} Kr
            </p>

            {/* Divider */}
            <div className="divider"></div>
          </li>
        </ul>
        <button
          className="bg-red-500 self-center w-48 py-1 rounded-md text-sm funky mb-12"
          onClick={() => setShowModal(!showModal)}
          disabled={isLoading || totalPanels < minPanels}
        >
          Jeg ønsker uforpliktende tilbud
        </button>
      </div>

      {/* End of info */}
      {showModal && (
        <>
          <div className="overlay"></div>
          <SendModal
            onClose={handleCloseModal}
            checkedRoofData={checkedRoofData}
            totalPanels={totalPanels}
            selectedElPrice={selectedElPrice}
            selectedRoofType={selectedRoofType}
            selectedPanelType={selectedPanelType}
            yearlyProd={yearlyProd}
            yearlyCost={yearlyCost}
            yearlyCost2={yearlyCost2}
            address={address}
            toggleModal={() => setShowModal(!showModal)}
            site={site}
            desiredKWh={desiredKWh}
            coveragePercentage={coveragePercentage}
          />
        </>
      )}
      {/* Map */}
    </div>
  );
}
