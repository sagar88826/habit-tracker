import { describe, it, expect } from 'bun:test';

// Pure fine calculation logic mirroring recalculateFines in fineService.ts
function calcFine(actual: number, limit: number, fineType: 'flat' | 'per_unit', fineAmount: number, limitType: 'min' | 'max' = 'max'): { overage: number; totalFine: number } {
  const overage = limitType === 'min'
    ? Math.max(0, limit - actual)
    : Math.max(0, actual - limit);

  const totalFine = overage > 0
    ? (fineType === 'flat' ? fineAmount : overage * fineAmount)
    : 0;
  return { overage, totalFine };
}

describe('fine calculation — flat', () => {
  it('no fine when actual equals limit', () => {
    const { overage, totalFine } = calcFine(3, 3, 'flat', 500);
    expect(overage).toBe(0);
    expect(totalFine).toBe(0);
  });

  it('no fine when actual is below limit', () => {
    const { overage, totalFine } = calcFine(2, 3, 'flat', 500);
    expect(overage).toBe(0);
    expect(totalFine).toBe(0);
  });

  it('flat fine fires once on any overage', () => {
    const { overage, totalFine } = calcFine(4, 3, 'flat', 500);
    expect(overage).toBe(1);
    expect(totalFine).toBe(500);
  });

  it('flat fine amount does not scale with overage amount', () => {
    const a = calcFine(5, 3, 'flat', 500);
    const b = calcFine(10, 3, 'flat', 500);
    expect(a.totalFine).toBe(b.totalFine);
  });
});

describe('fine calculation — per_unit', () => {
  it('no fine when at or below limit', () => {
    expect(calcFine(3, 3, 'per_unit', 100).totalFine).toBe(0);
    expect(calcFine(1, 3, 'per_unit', 100).totalFine).toBe(0);
  });

  it('per-unit fine multiplied by overage', () => {
    const { overage, totalFine } = calcFine(6, 3, 'per_unit', 200);
    expect(overage).toBe(3);
    expect(totalFine).toBe(600);
  });

  it('single-unit overage charges exactly one unit', () => {
    const { totalFine } = calcFine(4, 3, 'per_unit', 150);
    expect(totalFine).toBe(150);
  });
});

describe('fine calculation — min limit (shortfall)', () => {
  it('no fine when actual meets or exceeds minimum limit', () => {
    expect(calcFine(3, 3, 'flat', 500, 'min').overage).toBe(0);
    expect(calcFine(4, 3, 'flat', 500, 'min').overage).toBe(0);
  });

  it('fine applies when actual is below minimum limit', () => {
    const { overage, totalFine } = calcFine(1, 3, 'flat', 500, 'min');
    expect(overage).toBe(2);
    expect(totalFine).toBe(500); // flat fine
  });

  it('per-unit fine multiplies by shortfall amount', () => {
    const { overage, totalFine } = calcFine(1, 3, 'per_unit', 200, 'min');
    expect(overage).toBe(2);
    expect(totalFine).toBe(400);
  });
});
