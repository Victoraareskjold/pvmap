import React, { useState, useEffect, useCallback } from "react";

function RoofList({
  roofs,
  visibleRoofs,
  setVisibleRoofs,
  toggleRoof,
  evaluateDirection,
  isChecked,
  adjustedPanelCounts,
  setAdjustedPanelCounts,
  desiredKWh,
  minPanels,
}) {
  const [activeTooltip, setActiveTooltip] = useState(null);

  const handleToggleTooltip = (id) => {
    setActiveTooltip((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    const handleCloseTooltips = (e) => {
      if (!e.target.closest(".tooltip-icon-slider")) {
        setActiveTooltip(null);
      }
    };

    document.addEventListener("click", handleCloseTooltips);
    return () => {
      document.removeEventListener("click", handleCloseTooltips);
    };
  }, []);

  return (
    <ul>
      {roofs
        .filter((roof) => visibleRoofs.includes(roof.id))
        .map((roof) => {
          const adjustedCount =
            adjustedPanelCounts[roof.id] ?? roof.panels.panelCount;

          return (
            <li key={roof.id} className="flex flex-col gap-4 py-4">
              <div className="flex flex-row gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  className="scale-150"
                  checked={isChecked[roof.id]}
                  onChange={(e) => toggleRoof(roof.id, e.target.checked)}
                  id={`roof-checkbox-${roof.id}`}
                />
                <label
                  htmlFor={`roof-checkbox-${roof.id}`}
                  className="shrink-0 self-center text-md font-medium"
                >
                  Tak {roof.id + 1}:{" "}
                  <span className="italic font-normal">
                    Velg antall paneler på skyveknappen under
                  </span>
                </label>
              </div>

              {isChecked[roof.id] && (
                <div className="flex flex-row items-center gap-4 ml-7">
                  <div className="relative">
                    <button
                      className="tooltip-icon-slider"
                      onClick={() => handleToggleTooltip(roof.id)}
                      aria-expanded={activeTooltip === roof.id}
                    >
                      i
                    </button>
                    {activeTooltip === roof.id && (
                      <div
                        className="absolute left-0 bottom-full mb-2 p-2 w-64 text-sm bg-black text-white rounded-md shadow-lg"
                        role="tooltip"
                      >
                        <p>
                          <strong>Område:</strong> {roof.area.toFixed(2)} m²
                        </p>
                        <p>
                          <strong>Retning:</strong>{" "}
                          {evaluateDirection(roof.direction)}
                        </p>
                        <p>
                          <strong>Helning:</strong> {roof.angle}°
                        </p>
                        <p>
                          <strong>Effektivitet:</strong>{" "}
                          {roof.efficiencyPerPanel?.toFixed(2)} kWh/panel
                        </p>
                      </div>
                    )}
                  </div>

                  <input
                    type="range"
                    min={minPanels}
                    max={roof.panels.panelCount}
                    className="w-full sliderStyling self-center"
                    value={adjustedCount}
                    onChange={(e) => {
                      const newValue = Number(e.target.value);
                      setAdjustedPanelCounts((prev) => ({
                        ...prev,
                        [roof.id]: newValue,
                      }));
                    }}
                    aria-label={`Antall paneler for tak ${roof.id + 1}`}
                  />
                  <p className="border-2 border-orange-500 p-1 rounded-md text-black shrink-0 min-w-24 text-center">
                    {adjustedCount} paneler
                  </p>
                </div>
              )}
            </li>
          );
        })}
    </ul>
  );
}

export default React.memo(RoofList);


