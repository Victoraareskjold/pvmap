export default function PanelMengde({ selectedPanelType, totalPanels }) {
  return (
    <div
      className="bg-[#fff] rounded-3xl p-4 m-4 mx-auto gap-6 flex flex-col border-2"
      style={{ borderColor: "#FF9D00" }}
    >
      <div className="flex flex-row items-center justify-between mb-4">
        <p className="text-sm sm:text-lg font-semibold text-[#333]">
          Panelmengde <span className="font-bold">({selectedPanelType})</span>:
        </p>
        <div className="px-2 sm:px-4 py-1 sm:py-2 border-2 border-[#ff9800] rounded-md bg-white text-xs sm:text-base text-[#333] font-semibold">
          {totalPanels} paneler
        </div>
      </div>
      {selectedPanelType.includes("Premium") && (
        <p className="text-md sm:text-md text-[#666]">
          Premiumpaneler gir en optimal kombinasjon av høy ytelse, stilrent
          design og konkurransedyktig pris. De har lavere overflatetemperatur og
          bedre innebygd shading, noe som reduserer tap ved hindringer som
          fugleskitt eller andre elementer på overflaten. Panelene har også
          svært lav degenerering over tid, med 25 års produktgaranti og 30 års
          effektgaranti.
        </p>
      )}
      {selectedPanelType.includes("Performance") && (
        <p className="text-md sm:text-md text-[#666]">
          Performance paneler gir deg maksimal produksjon og er ideelle for deg
          som vil utnytte takets fulle potensial. De har 30 års produktgaranti
          og 25 års effektgaranti. Selv om de koster litt mer, får du høyere
          produksjon som gir ekstra verdi over tid.
        </p>
      )}
    </div>
  );
}
