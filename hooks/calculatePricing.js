const LOAN_ANNUAL_RATE = 0.045; // 4.5% miljølån
const YEARS = 30;

/**
 * Calculates yearly solar installation costs.
 *
 * @param {object} params
 * @param {number} params.totalPanels       - Number of panels selected
 * @param {number} params.panelPrice        - Unit price per panel (from solarpanels.PRIS)
 * @param {number} params.roofPrice         - Extra cost per panel for roof type (from roof_types.PRIS)
 * @param {number} params.formula           - Installer markup multiplier (from installer_groups.FORMEL)
 *
 * @returns {{
 *   totalCost: number,       - Total installation cost before spreading
 *   yearlyCostDirect: number - Yearly cost spread over 30 years (direct purchase)
 *   yearlyCostLoan: number   - Yearly cost with miljølån (annuity, 4.5% over 30 years)
 * }}
 */
export function calculatePricing({
  totalPanels,
  panelPrice,
  roofPrice,
  formula,
}) {
  console.log(totalPanels, panelPrice, formula);
  if (!totalPanels || !panelPrice || !formula) {
    return { totalCost: 0, yearlyCostDirect: 0, yearlyCostLoan: 0 };
  }

  const totalCost = (panelPrice + roofPrice) * totalPanels * formula;

  // Direct purchase: spread evenly over 30 years
  const yearlyCostDirect = totalCost / YEARS;

  // Miljølån: standard annuity formula
  const monthlyRate = LOAN_ANNUAL_RATE / 12;
  const months = YEARS * 12;
  const monthlyPayment =
    (totalCost * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  const yearlyCostLoan = monthlyPayment * 12;

  return { totalCost, yearlyCostDirect, yearlyCostLoan };
}
