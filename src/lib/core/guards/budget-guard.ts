// Budget guard utilities
export function checkBudget(limitCents: number, estimatedCents: number) {
  return estimatedCents <= limitCents
}
