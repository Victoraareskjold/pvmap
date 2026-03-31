export default function getPanelPriceByCount(panel, totalPanels) {
  if (totalPanels <= 72) return panel["0-72"];
  if (totalPanels <= 150) return panel["72-150"];
  if (totalPanels <= 300) return panel["150-300"];
  if (totalPanels <= 600) return panel["300-600"];
  if (totalPanels <= 1000) return panel["600-1000"];
  return panel["1000+"];
}
