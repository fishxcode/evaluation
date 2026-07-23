/**
 * Unit tests for the pagination contract (8.1) — the pageSize<=100 rule is a
 * 铁律-level requirement and must be enforced at the schema layer.
 * 分页契约单测——pageSize<=100 是铁律级要求，必须在 Schema 层强制。
 */
import { describe, it, expect } from 'vitest';
import { paginationQuerySchema, modelQuerySchema } from './api.js';

describe('paginationQuerySchema', () => {
  it('applies defaults page=1 pageSize=20', () => {
    const r = paginationQuerySchema.parse({});
    expect(r).toEqual({ page: 1, pageSize: 20 });
  });

  it('coerces string query params to numbers', () => {
    const r = paginationQuerySchema.parse({ page: '3', pageSize: '50' });
    expect(r).toEqual({ page: 3, pageSize: 50 });
  });

  it('REJECTS pageSize=101 (no silent truncation)', () => {
    const r = paginationQuerySchema.safeParse({ pageSize: 101 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/between 1 and 100/);
    }
  });

  it('REJECTS pageSize=0', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
  });

  it('REJECTS pageSize=99999 (does NOT clamp to 100)', () => {
    const r = paginationQuerySchema.safeParse({ pageSize: 99999 });
    expect(r.success).toBe(false);
  });

  it('REJECTS page=0', () => {
    expect(paginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });
});

describe('modelQuerySchema', () => {
  it('accepts filter + sort params', () => {
    const r = modelQuerySchema.parse({
      lab: 'openai',
      sort: 'price',
      order: 'desc',
      page: '2',
    });
    expect(r.lab).toBe('openai');
    expect(r.sort).toBe('price');
    expect(r.order).toBe('desc');
    expect(r.page).toBe(2);
  });

  it('defaults order to asc', () => {
    const r = modelQuerySchema.parse({});
    expect(r.order).toBe('asc');
  });

  it('rejects invalid sort field', () => {
    expect(modelQuerySchema.safeParse({ sort: 'bogus' }).success).toBe(false);
  });
});
