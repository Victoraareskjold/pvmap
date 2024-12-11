"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import SelectOption from "../../components/SelectOption";

import PriceEstimator from "../../components/PriceEstimator";
import Image from "next/image";
import SendModal from "../../components/SendModal";
import InfoModal from "../../components/InfoModal";
import { useRouter } from "next/navigation";

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

  const [adjustedPanelCounts, setAdjustedPanelCounts] = useState({});

  const totalPanels = Object.values(adjustedPanelCounts).reduce(
    (total, count) => total + count,
    0
  );

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
            const outputA = a.pv?.outputs.totals.fixed.E_y || 0;
            const outputB = b.pv?.outputs.totals.fixed.E_y || 0;
            return outputB - outputA;
          })
          .slice(0, 2);

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
    const fetchData = async () => {
      if (totalPanels < 0) {
        return;
      }
      try {
        setIsLoading(true);
        const response = await fetch("/api/googleSheets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            totalPanels,
          }),
        });
        const data = await response.json();
        setSheetData(data.data);

        if (data.valueFromB2) {
          setYearlyCost(parseFloat(data.valueFromB2));
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Feil ved henting av sheet data:", error);
      }
    };

    fetchData();
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

  const checkedRoofData = combinedData
    .filter((roof) => isChecked[roof.id])
    .reduce((acc, roof) => {
      acc[roof.id] = {
        roofId: roof.id,
        adjustedPanelCount:
          adjustedPanelCounts[roof.id] || roof.panels.panelCount,
        maxPanels: roof.panels.panelCount,
      };
      return acc;
    }, {});

  useEffect(() => {
    setModalData({
      checkedRoofData,
      totalPanels,
      selectedElPrice,
      selectedRoofType,
      selectedPanelType,
      yearlyProd,
      yearlyCost,
      address,
    });
  }, [
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

  return (
    <div className="flex flex-col w-full md:flex-row gap-2">
      <Suspense fallback={<div>Loading..</div>}>
        <div className="w-full relative">
          <img
            src="/colorGrading.png"
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

          <PriceEstimator onSelect={handleSelectedElPrice} />
        </div>
        {/* Info */}
        <div className="flex flex-col gap-8 p-4 w-full md:max-w-2xl">
          <div className="flex flex-row justify-between">
            <h1 className="text-xl">Adresse: {address}</h1>
            <button
              className="bg-black text-white rounded-full text-sm py-1 px-2"
              onClick={routeBack}
            >
              Nytt søk
            </button>
          </div>
          <div className="flex flex-col gap-8 md:flex-col xl:flex-row">
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
                          <p className="border-2 border-orange-500 p-1 rounded-md border text-black shrink-0 min-w-24 text-center">
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
            <p className="border-2 border-orange-500 p-2 rounded-md text-black">
              {totalPanels} paneler
            </p>
          </div>
          <p className="text-sm">
            Panelene leveres med 30 års produkt- og effektgaranti. Prisen
            inkluderer alt fra A-Å, uten skjulte kostnader – komplett
            solcelleanlegg.
          </p>

          <ul className="flex flex-col gap-4">
            <li className="flex flex-row justify-between font-light relative">
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
              <p className="text-end text-xl">{yearlyProd.toFixed(0)} kWh</p>
            </li>
            <li className="flex flex-row justify-between font-light relative">
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
              <p className="text-end text-xl">
                {potentialSaving.toFixed(0)} Kr
              </p>
            </li>
            <li className="flex flex-row justify-between font-light relative">
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
              <p className="text-end text-xl">{yearlyCost.toFixed(0)} Kr</p>
            </li>
          </ul>

          <button
            className="bg-red-500 self-center w-48 py-1 rounded-md text-sm funky"
            onClick={toggleModal}
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
              checkedRoofData={checkedRoofData}
              selectedElPrice={selectedElPrice}
              selectedRoofType={selectedRoofType}
              selectedPanelType={selectedPanelType}
              totalPanels={totalPanels}
              yearlyCost={yearlyCost}
              yearlyProd={yearlyProd}
              address={address}
              toggleModal={toggleModal}
            />
          </>
        )}
        {/* Map */}
      </Suspense>
    </div>
  );
}
