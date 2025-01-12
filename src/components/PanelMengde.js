import React from "react";

export default function PanelMengde({ selectedPanelType, totalPanels }) {
  return (
    <div
      className="bg-[#fff] rounded-3xl p-4 m-16 mx-auto max-w-lg gap-6 flex flex-col border-2"
      style={{ borderColor: "#FF9D00" }}
    >
      <div className="flex flex-row items-center justify-between mb-4">
        <p className="text-lg font-semibold text-[#333]">
          Panelmengde <span className="font-bold">({selectedPanelType})</span>:
        </p>
        <div className="px-4 py-2 border-2 border-[#ff9800] rounded-md bg-white text-[#333] font-semibold">
          {totalPanels} paneler
        </div>
      </div>
      <p className="text-sm text-[#666]">
        Panelene leveres med 30 års produkt- og effektgaranti. Prisen inkluderer alt fra A-Å,
        uten skjulte kostnader – komplett solcelleanlegg.
      </p>
    </div>
  );
}
