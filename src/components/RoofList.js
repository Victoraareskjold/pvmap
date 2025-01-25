import React, { useEffect, useState } from "react";

function RoofList({
  roofs,
  visibleRoofs,
  toggleRoof,
  evaluateDirection,
  isChecked,
  adjustedPanelCounts,
  setAdjustedPanelCounts,
  minPanels,
}) {
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [expanded, setExpanded] = useState(true); // State for toggle interaction

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

  // Sorter takflater etter effektivitet
  const sortedRoofs = roofs
    .filter((roof) => visibleRoofs.includes(roof.id))
    .sort((a, b) => (b.efficiencyPerPanel || 0) - (a.efficiencyPerPanel || 0));

  const visibleRoofCount = expanded ? sortedRoofs.length : 2;

  return (
    <ul>
      {sortedRoofs.slice(0, visibleRoofCount).map((roof, index) => {
        const adjustedCount =
          adjustedPanelCounts[roof.id] ?? roof.panels.panelCount;

        return (
          <li
            key={roof.id}
            className="flex flex-col gap-4 py-4 border-b border-gray-300 px-4"
          >
            {/* Hovedoverskrift for takflate */}
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
                Tak {index + 1}:{" "}
                <span className="italic font-normal">Velg antall paneler</span>
              </label>
            </div>

            {/* Detaljer for valgt takflate */}
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

                {/* Skyveknapp for antall paneler */}
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
                  aria-label={`Antall paneler for tak ${index + 1}`}
                />
                <p className="border-2 border-orange-500 p-1 rounded-md text-black shrink-0 min-w-20 text-center">
                  {adjustedCount} paneler
                </p>
              </div>
            )}
          </li>
        );
      })}
      {/* Toggle interaction */}
      {sortedRoofs.length > 2 && (
        <div className="text-center mt-4 flex flex-col items-center">
          <span
            className="mt-1 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "ᐱ" : "ᐯ"}
          </span>
          <button className="text-black-600 text-sm mt-2" disabled>
            {expanded ? "Se mindre" : "Se mer"}
          </button>
        </div>
      )}
    </ul>
  );
}

export default React.memo(RoofList);
