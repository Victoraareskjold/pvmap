/**
 * Beskrivelsen av paneltypen kommer fra `description` på raden i
 * `solarpanels`, ikke fra en liste her. Da kan installatøren endre teksten
 * eller legge til en ny paneltype uten at koden må røres.
 */
export default function PanelMengde({
  selectedPanelType,
  totalPanels,
  description,
}) {
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="card-title">Panelmengde</span>
        <span className="tag">{totalPanels} paneler</span>
      </div>
      <p className="text-sm font-medium">{selectedPanelType}</p>
      {description && (
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          {description}
        </p>
      )}
    </div>
  );
}
