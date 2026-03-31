export default function getPriceByCount(item, totalPanels) {
  if (!item) return 0;

  if (totalPanels <= 72) return item["0-72"];
  if (totalPanels <= 150) return item["72-150"];
  if (totalPanels <= 300) return item["150-300"];
  if (totalPanels <= 600) return item["300-600"];
  if (totalPanels <= 1000) return item["600-1000"];

  return item["1000+"];
}
