import { describe, expect, it } from 'vitest';
import { getForecastAccuracyMapeTone } from './displayFormat';

describe('getForecastAccuracyMapeTone', () => {
  it('returns null when MAPE is missing or not finite', () => {
    expect(getForecastAccuracyMapeTone(null)).toBeNull();
    expect(getForecastAccuracyMapeTone(undefined)).toBeNull();
    expect(getForecastAccuracyMapeTone(Number.NaN)).toBeNull();
  });

  it('returns good below 15%', () => {
    expect(getForecastAccuracyMapeTone(0)).toBe('good');
    expect(getForecastAccuracyMapeTone(3.55)).toBe('good');
    expect(getForecastAccuracyMapeTone(14.99)).toBe('good');
  });

  it('returns warn from 15% through 20%', () => {
    expect(getForecastAccuracyMapeTone(15)).toBe('warn');
    expect(getForecastAccuracyMapeTone(17.5)).toBe('warn');
    expect(getForecastAccuracyMapeTone(20)).toBe('warn');
  });

  it('returns bad above 20%', () => {
    expect(getForecastAccuracyMapeTone(20.01)).toBe('bad');
    expect(getForecastAccuracyMapeTone(40)).toBe('bad');
  });
});
