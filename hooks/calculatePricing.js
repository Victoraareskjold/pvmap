export function calculatePricing({
  totalPanels,
  panelPrice,
  roofPrice,
  installerPrice,
  commissionRate = 0,
  formula = 1,
}) {
  if (!totalPanels || !panelPrice) {
    return { totalCost: 0, yearlyCostDirect: 0, yearlyCostLoan: 0 };
  }

  // Base cost: panels + roof
  const base = (panelPrice + roofPrice) * totalPanels;

  // Add installer
  const withInstaller = base + installerPrice;

  // Add commission instead of multiplying
  const totalBeforeVAT = withInstaller + commissionRate;

  // Apply formula multiplier
  const totalCost = totalBeforeVAT * formula * 1.25; // 1.25 for mva

  // Yearly cost (direct)
  const yearlyCostDirect = totalCost / 30;

  // Yearly cost (loan)
  const monthlyRate = 0.045 / 12;
  const months = 30 * 12;
  const monthlyPayment =
    (totalCost * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  const yearlyCostLoan = monthlyPayment * 12;

  return { totalCost, yearlyCostDirect, yearlyCostLoan };
}
