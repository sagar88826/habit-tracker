import { describe, it, expect } from 'bun:test';
import { parseEntryValue } from '../../cli/services/entryService';

describe('parseEntryValue', () => {
  it('returns valueCount for count-type activity', () => {
    expect(parseEntryValue('count', { valueCount: 7, valueBool: null })).toBe(7);
  });

  it('returns 0 when valueCount is null for count-type', () => {
    expect(parseEntryValue('count', { valueCount: null, valueBool: null })).toBe(0);
  });

  it('returns valueBool for boolean-type activity', () => {
    expect(parseEntryValue('boolean', { valueCount: null, valueBool: true })).toBe(true);
    expect(parseEntryValue('boolean', { valueCount: null, valueBool: false })).toBe(false);
  });

  it('returns false when valueBool is null for boolean-type', () => {
    expect(parseEntryValue('boolean', { valueCount: null, valueBool: null })).toBe(false);
  });

  it('ignores valueBool for count-type activity', () => {
    expect(parseEntryValue('count', { valueCount: 3, valueBool: true })).toBe(3);
  });

  it('ignores valueCount for boolean-type activity', () => {
    expect(parseEntryValue('boolean', { valueCount: 99, valueBool: true })).toBe(true);
  });
});
