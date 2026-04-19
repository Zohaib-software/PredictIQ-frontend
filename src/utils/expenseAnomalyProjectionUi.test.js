import { describe, expect, it } from 'vitest';
import { expenseAnomalyProjectionVisibleInDateRange } from './expenseAnomalyProjectionUi';

describe('expenseAnomalyProjectionVisibleInDateRange', () => {
  const data = { date: ['2021-06', '2021-07'] };

  it('is true when no date filter', () => {
    expect(expenseAnomalyProjectionVisibleInDateRange(data, '', '', 3)).toBe(true);
  });

  it('is false when projected months fall outside filter', () => {
    expect(
      expenseAnomalyProjectionVisibleInDateRange(data, '2021-01-01', '2021-07-01', 3)
    ).toBe(false);
  });

  it('is true when at least one projected month is inside filter', () => {
    expect(
      expenseAnomalyProjectionVisibleInDateRange(data, '2021-01-01', '2021-10-01', 3)
    ).toBe(true);
  });
});
