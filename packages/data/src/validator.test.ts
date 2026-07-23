/**
 * Validator unit tests — quarantine of invalid records (9.2.2).
 * Validator 单测——非法记录隔离。
 */
import { describe, it, expect } from 'vitest';
import { validate } from './validator.js';
import type { Model } from '@models-dev/shared';

function valid(id: string): Model {
  return {
    id, slug: id, name: id, lab: { id: 'x', name: 'X' }, aliases: [],
    modalities: { input: ['text'], output: ['text'] }, capabilities: [],
    openWeights: false, benchmarks: [], offerings: [], sources: [],
  };
}

describe('validate', () => {
  it('passes valid models', () => {
    const r = validate([valid('a'), valid('b')]);
    expect(r.valid).toHaveLength(2);
    expect(r.quarantined).toHaveLength(0);
  });

  it('quarantines a model with a bad date, keeps valid ones', () => {
    const bad = { ...valid('bad'), releaseDate: 'not-a-date' } as Model;
    const r = validate([valid('ok'), bad]);
    expect(r.valid).toHaveLength(1);
    expect(r.quarantined).toHaveLength(1);
    expect(r.quarantined[0]?.id).toBe('bad');
    expect(r.quarantined[0]?.issues[0]?.path).toBe('releaseDate');
  });

  it('quarantines a model missing required modalities', () => {
    const bad = { ...valid('bad') } as Partial<Model>;
    delete bad.modalities;
    const r = validate([bad as Model]);
    expect(r.valid).toHaveLength(0);
    expect(r.quarantined).toHaveLength(1);
  });
});
