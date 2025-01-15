"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import SelectOption from "../../components/SelectOption";

import Image from "next/image";
import { useRouter } from "next/navigation";
import InfoModal from "../../components/InfoModal";
import PriceEstimator from "../../components/PriceEstimator";
import PanelMengde from "../../components/PanelMengde";
import SendModal from "../../components/SendModal";
import RoofList from "../../components/RoofList";
import dynamic from "next/dynamic";

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

  const [selectedRoofType, setSelectedRoofType] = useState(
    "Takstein (Dobbelkrummet)"
  );
  const [selectedPanelType, setSelectedPanelType] = useState("Premium - 410 W");
  const [selectedElPrice, setSelectedElPrice] = useState(1.5);

  const [combinedData, setCombinedData] = useState([]);
  const [sheetData, setSheetData] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [roofs, setRoofs] = useState([]);
  const [adjustedPanelCounts, setAdjustedPanelCounts] = useState({});

  const totalPanels = Object.values(adjustedPanelCounts).reduce(
    (total, count) => total + count,
    0
  );

  console.log(site);

  const [visibleRoofs, setVisibleRoofs] = useState([]);

  const [isChecked, setIsChecked] = useState({});

  const [yearlyProd, setYearlyProd] = useState(0);
  const [potentialSaving, setPotentialSaving] = useState(0);
  const [yearlyCost, setYearlyCost] = useState(0);

  const [apiKey, setApiKey] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [openModal, setOpenModal] = useState(null);

  const minPanels = 6;

  const handleRoofTypeChange = (value) => {
    setSelectedRoofType(value);
  };

  const handlePanelTypeChange = (value) => {
    setSelectedPanelType(value);
  };

  const handleSelectedElPrice = (value) => {
    setSelectedElPrice(value);
  };

  const toggleModal = () => {
    setShowModal(!showModal);
  };

  const handleOpenModal = (modalName) => {
    setOpenModal(modalName);
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
            roofResponse.statusText
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

          const apiUrl = `/api/pvgis?lat=${lat}&lng=${lng}&panelCount=${
            data.panels.panelCount
          }&aspect=${data.direction - 179}&angle=${
            data.angle + 1
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
  const fetchGoogleSheetsData = async () => {
    try {
      const response = await fetch("/api/googleSheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalPanels }),
      });

      if (!response.ok) {
        console.error(`Feil under henting av data: ${response.status}`);
        return;
      }

      const data = await response.json();
      console.log("Google Sheets API response:", data); // Log API response

     
      setYearlyCost(parseFloat(data.valueFromB2 || 0));
    } catch (error) {
      console.error("Feil under henting av data fra Google Sheets:", error);
    }
  };

  if (totalPanels > 0) {
    console.log("🔍 Henter årlig kostnad for antall paneler:", totalPanels);
    fetchGoogleSheetsData();
  } else {
    console.warn("⚠️ Ingen paneler valgt. Årlig kostnad kan ikke beregnes.");
  }
  
}, [totalPanels]);

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
    console.log(roofId);

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

  const getNumbers = (str) => {
    let matches = str.match(/(\d+)/);

    if (matches) {
      return matches[0];
    }
  };
  
  const [desiredKWh, setDesiredKWh] = useState(0); // State for strømforbruk
  const [coveragePercentage, setCoveragePercentage] = useState(0); // State for prosent
  const [errors, setErrors] = useState({ kWh: "", percentage: "" }); // State for feil
  const [roofDetails, setRoofDetails] = useState({});
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [checkedRoofData, setCheckedRoofData] = useState({});

  const handleKWhChange = (e) => {
    const rawValue = e.target.value.replace(/\s/g, "");
    const numericValue = Number(rawValue);
    if (!isNaN(numericValue)) {
      setDesiredKWh(numericValue);
    }
  };

  const handlePercentageChange = (e) => {
    const rawValue = e.target.value.replace(/\s/g, "");
    const numericValue = Number(rawValue);
    if (!isNaN(numericValue)) {
  
      if (numericValue < 1) {
        setCoveragePercentage(1); 
      } else if (numericValue > 100) {
        setCoveragePercentage(100); 
      } else {
        setCoveragePercentage(numericValue); 
      }
    }
  };

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
  

  const handleCalculatePanels = () => {
    const newErrors = { kWh: "", percentage: "", calculation: "" };
  
    if (!desiredKWh || desiredKWh <= 0) {
      newErrors.kWh = "Skriv inn ønsket årlig strømforbruk (kWh).";
    }
    if (coveragePercentage < 1 || coveragePercentage > 100) {
      newErrors.percentage = "Dekningsprosent må være et tall mellom 1 og 100.";
    }
  
    setErrors(newErrors);
    if (newErrors.kWh || newErrors.percentage) return;
  
    const energyRequirement = (desiredKWh * coveragePercentage) / 100;
  
    const maxCoverage = combinedData.reduce((sum, roof) => {
      return sum + (roof.efficiencyPerPanel || 0) * roof.panels.panelCount;
    }, 0);
  
    if (energyRequirement > maxCoverage) {
      setDesiredKWh(Math.floor((maxCoverage / coveragePercentage) * 100));
      setErrors((prev) => ({
        ...prev,
        calculation: `Kan ikke dekke hele ${energyRequirement.toFixed(0)} kWh med tilgjengelige takflater.`,
      }));
      return;
    }
  
    let remainingEnergy = energyRequirement;
    const updatedPanelCounts = {};
    const updatedIsChecked = {};
    const updatedVisibleRoofs = [];
  
    const sortedRoofs = [...combinedData].sort(
      (a, b) => b.efficiencyPerPanel - a.efficiencyPerPanel
    );
  
    for (const roof of sortedRoofs) {
      if (remainingEnergy <= 0) break;
  
      const panelsNeeded = Math.min(
        Math.ceil(remainingEnergy / (roof.efficiencyPerPanel || 1)),
        roof.panels.panelCount
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
      document.getElementById("result-container")?.scrollIntoView({ behavior: "smooth" });
    }
  };
  
  useEffect(() => {
    const updatedCheckedRoofData = combinedData
      .filter((roof) => isChecked[roof.id])
      .map((roof) => ({
        roofId: roof.id,
        adjustedPanelCount: adjustedPanelCounts[roof.id] || roof.panels.panelCount,
        maxPanels: roof.panels.panelCount,
        direction: roof.direction,
        angle: roof.angle,
      }));
  
    console.log("✅ Updated Checked Roof Data:", updatedCheckedRoofData);
    setCheckedRoofData(updatedCheckedRoofData);
  
    setModalData({
      checkedRoofData: updatedCheckedRoofData,
      totalPanels,
      selectedElPrice,
      selectedRoofType,
      selectedPanelType,
      yearlyProd,
      yearlyCost,
      address,
    });
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
  ]);
  
  
  const routeBack = () => {
    router.push("/");
  };

  useEffect(() => {
    const sortedData = combinedData.filter(
      (roof) => roof.panels.panelCount >= minPanels
    );

    setVisibleRoofs(sortedData.slice(0, 2).map((roof) => roof.id));
  }, [combinedData, minPanels]);

  return (
  <div>
     <div className="w-screen min-h-screen">
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
      {/* Row 1 - Left Column */}
      <div className="flex flex-col gap-6 w-full">
        {/* Map and Price Estimator */}
        <div className="relative w-full">
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
          <div className="hidden md:block mt-4">
            <PriceEstimator onSelect={handleSelectedElPrice} />
            <PanelMengde selectedPanelType={selectedPanelType} totalPanels={totalPanels} />
          </div>
        </div>
      </div>
  
 {/* Row 1 - Right Column */}
 <div className="flex flex-col gap-8 w-full max-w-3xl p-4 mx-auto md:w-[500px]">
  {/* Address Section */}
  <div className="flex justify-between items-center w-full">
    <h1 className="text-xl font-semibold">Adresse: {address}</h1>
    <button
      className="bg-black text-white rounded-full text-sm py-1 px-4"
      onClick={routeBack}
    >
      Nytt søk
    </button>
  </div>

  {/* Roof List and Calculator */}
  <div className="flex flex-col gap-6">
    <SelectOption
      title="Din taktype:"
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
      options={["Premium 440 W", "Max Power 455 W"]}
      onSelect={handlePanelTypeChange}
    />
  </div>

  <p className="italic text-gray-600">
    Klikk på takene i kartet for å legge til eller ta bort.
  </p>
  <p className="text-sm">
    Takflater på eiendommen - Sortert fra mest til minst solinnstråling
  </p>

  {/* Roof List and Panel Count */}
  <div>
    {combinedData.length > 0 && (
      <div className="block md:hidden">
        <RoofList
          roofs={combinedData}
          visibleRoofs={visibleRoofs}
          toggleRoof={toggleRoof}
          evaluateDirection={evaluateDirection}
          isChecked={isChecked}
          adjustedPanelCounts={adjustedPanelCounts}
          setAdjustedPanelCounts={setAdjustedPanelCounts}
        />
        <PanelMengde
          selectedPanelType={selectedPanelType}
          totalPanels={totalPanels}
        />
      </div>
    )}
    {combinedData.length > 0 && (
      <div className="hidden md:block">
        <RoofList
          roofs={combinedData}
          visibleRoofs={visibleRoofs}
          toggleRoof={toggleRoof}
          evaluateDirection={evaluateDirection}
          isChecked={isChecked}
          adjustedPanelCounts={adjustedPanelCounts}
          setAdjustedPanelCounts={setAdjustedPanelCounts}
        />
      </div>
    )}
  </div>

                  {/* Calculator Section */}
                  <div className="calculator-container">
          <h2>Finn ut hvor mange solcellepaneler du trenger</h2>
          <p>Skriv inn ditt årlige strømforbruk i kWh (for eksempel: 25 000):</p>
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
                  Usikker på hvor mye strøm du bruker? En gjennomsnittlig leilighet
                  bruker 8 000 - 12 000 kwh per år. ...
                </div>
              )}
              <input
                id="kwh-input"
                type="text"
                value={desiredKWh.toLocaleString("nb-NO")}
                onChange={handleKWhChange}
                placeholder="27 500"
              />
              <span className="unit">kWh</span>
            </div>
            {errors.kWh && <span className="error-message">{errors.kWh}</span>}
          </div>
          <p>
            Basert på et forbruk på{" "}
            {desiredKWh ? desiredKWh.toLocaleString("nb-NO") : "27 500"} kWh,
            anbefaler vi egen produksjon på{" "}
            <strong>
              {(desiredKWh * coveragePercentage / 100 || 11000).toLocaleString(
                "nb-NO"
              )}{" "}
              kWh.
            </strong>
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
                  Årlig strømforbruk burde dekke 30-60 % en av forbruket for private
                  husholdninger...
                </div>
              )}
              <input
                id="percent-input"
                type="text"
                value={coveragePercentage.toLocaleString("nb-NO")}
                onChange={handlePercentageChange}
                placeholder="40"
              />
              <span className="unit">%</span>
            </div>
            {errors.percentage && (
              <span className="error-message">{errors.percentage}</span>
            )}
          </div>
          <p>
            Trykk på knappen for å beregne antall solcellepaneler du trenger for å
            oppnå{" "}
            <strong>
              {(desiredKWh * coveragePercentage / 100 || 11000).toLocaleString(
                "nb-NO"
              )}{" "}
              kWh.
            </strong>
          </p>
          <button
            id="calculate-button"
            className="calculate-button"
            onClick={handleCalculatePanels}
          >
            Beregn paneler
          </button>
          <div id="result-container">
            {errors.calculation && (
              <span className="error-message text-red-500">
                {errors.calculation}
              </span>
            )}
          </div>
        </div>
      {/* End of calculator */}
      <div className="block md:hidden">
        <PriceEstimator onSelect={handleSelectedElPrice} />
      </div>
    </div> 
  </div> 
  </div>
  <div className="md:col-span-2 flex flex-col items-center gap-6 mt-8 px-4">
  {/* Top Divider */}
  <div className="w-115 bg-black h-px mb-4"></div>
  <ul className="flex flex-col gap-4">
    <li className="flex flex-col justify-between font-light relative gap-2">
      <InfoModal
        isOpen={openModal === "modal1"}
        onClose={handleCloseModal}
        content="Estimert produksjon i kWh er basert på data fra PVGIS, som bruker værdata fra perioden 2005–2020. Ønsker du et mer nøyaktig estimat på din produksjon? Be om et helt uforpliktende tilbud fra oss. Med et varmere klima og mer sol i Norge de siste årene, kan du også forvente enda høyere produksjon enn det historiske data viser."
      />
      <div className="flex flex-row gap-2">
        <Image
          onClick={() => handleOpenModal("modal1")}
          src="/info.svg"
          width={20}
          height={20}
          alt="info"
        />
        <p>Din forventet årlig strømproduksjon (kWh): </p>
      </div>
      <p className="text-xl ml-7 font-medium">
        = {""}
        {new Intl.NumberFormat("nb-NO").format(
          (yearlyProd * 0.95).toFixed(0)
        )} {" "}
        - {" "}
        {new Intl.NumberFormat("nb-NO").format(
          (yearlyProd * 1.05).toFixed(0)
        )} {" "}
        kWh
      </p>
      {/* Divider */}
      <div className="w-96 bg-black h-px mx-auto"></div>
    </li>
    <li className="flex flex-col justify-between font-light relative gap-2">
      <InfoModal
        isOpen={openModal === "modal2"}
        onClose={handleCloseModal}
        content="Denne beregningen viser en estimert inntekt solcelleanlegget kan gi deg ved å redusere strømregningen. Bruk skyveknappen i boksen «Din estimerte gjennomsnittlige strømpris» for å justere og se hva du kan spare. Beregningen er basert på produksjon i kWh multiplisert med en estimert strømpris. Ønsker du et mer presist anslag? Be om et tilbud, så gir vi deg en tilpasset beregning av kWh-produksjonen for ditt hjem."
      />
      <div className="flex flex-row gap-2">
        <Image
          onClick={() => handleOpenModal("modal2")}
          src="/info.svg"
          width={20}
          height={20}
          alt="info"
        />
        <p>Din forventet årlig besparelse/inntekt: </p>
      </div>
      <p className="text-xl ml-7 font-medium">
        = {""}
        {new Intl.NumberFormat("nb-NO").format(
          potentialSaving.toFixed(0)
        )} {" "}
        Kr
      </p>
      {/* Divider */}
      <div className="w-96 bg-black h-px mx-auto"></div>
    </li>
    <li className="flex flex-col justify-between font-light relative gap-2">
      <InfoModal
        isOpen={openModal === "modal3"}
        onClose={handleCloseModal}
        content="Denne beregningen viser hva solcelleanlegget vil koste deg per år over 30 år. Laveste sum gjelder direktekjøp, mens høyeste anslår kostnaden med miljølån. Be om et tilbud for konkrete tall på både direktekjøp og månedlige kostnader med finansiering."
      />
      <div className="flex flex-row gap-2">
        <Image
          onClick={() => handleOpenModal("modal3")}
          src="/info.svg"
          width={20}
          height={20}
          alt="info"
        />
        <p>Din forventet kostnad per år: </p>
      </div>
      <p className="text-xl ml-7 font-medium">
        = {""}
        {new Intl.NumberFormat("nb-NO").format(
          yearlyCost.toFixed(0)
        )} {" "}
        Kr
      </p>
      {/* Divider */}
      <div className="w-96 bg-black h-px mx-auto"></div>
    </li>
  </ul>
  <button
    className="bg-red-500 self-center w-48 py-1 rounded-md text-sm funky mb-4"
    onClick={toggleModal} // Open the modal
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
        address={address}
        toggleModal={toggleModal}
        site={site}
        />
        </>
        )}
  {/* Map */}
 </div>
  );
}
