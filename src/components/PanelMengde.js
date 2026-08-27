const DESCRIPTIONS = [
  {
    match: "Premium",
    text: "Premiumpaneler gir en optimal kombinasjon av høy ytelse, stilrent design og konkurransedyktig pris. De har lavere overflatetemperatur og bedre innebygd skyggehåndtering, noe som reduserer tap ved hindringer på overflaten. Panelene har svært lav degradering over tid, med 25 års produktgaranti og 30 års effektgaranti.",
  },
  {
    match: "Performance",
    text: "Performance-paneler gir maksimal produksjon og er ideelle for deg som vil utnytte takets fulle potensial. De har 30 års produktgaranti og 25 års effektgaranti. De koster litt mer, men høyere produksjon gir ekstra verdi over tid.",
  },
];

export default function PanelMengde({ selectedPanelType, totalPanels }) {
  const description = DESCRIPTIONS.find((d) =>
    selectedPanelType.includes(d.match)
  );

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="card-title">Panelmengde</span>
        <span className="tag">{totalPanels} paneler</span>
      </div>
      <p className="text-sm font-medium">{selectedPanelType}</p>
      {description && (
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          {description.text}
        </p>
      )}
    </div>
  );
}
