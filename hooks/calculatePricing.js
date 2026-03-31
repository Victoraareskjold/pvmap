const LOAN_ANNUAL_RATE = 0.045; // 4.5% miljølån
const YEARS = 30;

/**
 *
 * @param {object} params
 * @param {number} params.totalPanels
 * @param {number} params.panelPrice
 * @param {number} params.roofPrice
 * @param {number} params.formula
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

  const yearlyCostDirect = totalCost / YEARS;

  console.log(yearlyCostDirect);

  //rooftype + solarpanel * antallpanerl

  const monthlyRate = LOAN_ANNUAL_RATE / 12;
  const months = YEARS * 12;
  const monthlyPayment =
    (totalCost * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  const yearlyCostLoan = monthlyPayment * 12;

  return { totalCost, yearlyCostDirect, yearlyCostLoan };
}
