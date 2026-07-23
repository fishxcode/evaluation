/**
 * Merger unit tests — the highest-risk logic (铁律: normalizer/merge/conflict
 * are the test focus). Covers precedence, conflict recording, offering
 * aggregation, synthesized ids, and manual-override survival.
 * Merger 单测——最高风险逻辑。覆盖优先级、冲突记录、offering 聚合、
 * 自造 id、人工覆盖存活。
 */
import { describe, it, expect } from 'vitest';
import { merge } from './merger.js';
import type { ParsedContribution, ModelContribution, LabContribution } from './adapters/types.js';

function apiContrib(slug: string, over: Partial<ModelContribution> = {}): ModelContribution {
  return {
    canonicalId: null,
    slug,
    source: 'api',
    fields: { name: `${slug} (api)`, modalities: { input: ['text'], output: ['text'] }, openWeights: false },
    offering: { providerId: 'openai', providerName: 'OpenAI', modelId: slug, pricing: { input: 1, output: 2 } },
    ...over,
  };
}
function catalogContrib(canonicalId: string, over: Partial<ModelContribution> = {}): ModelContribution {
  const slug = canonicalId.split('/')[1]!;
  return {
    canonicalId,
    slug,
    labId: canonicalId.split('/')[0],
    source: 'catalog',
    fields: {
      name: `${slug} (catalog)`,
      modalities: { input: ['text'], output: ['text'] },
      openWeights: false,
      benchmarks: [{ name: 'MMLU', score: 90, source: 'test' }],
    },
    ...over,
  };
}
function pc(models: ModelContribution[]): ParsedContribution {
  return { models, labs: [], providers: [] };
}
const labs: LabContribution[] = [{ id: 'openai', name: 'OpenAI', modelCount: 0, providerCount: 1 }];

describe('merge — precedence', () => {
  it('catalog name wins over api name for the same model', () => {
    const out = merge({
      contributions: [pc([catalogContrib('openai/gpt-5'), apiContrib('gpt-5')])],
      labs,
      sourceMeta: {},
    });
    const gpt5 = out.models.find(m => m.id === 'openai/gpt-5')!;
    expect(gpt5.name).toBe('gpt-5 (catalog)'); // catalog > api
  });

  it('records a conflict when api and catalog disagree on name', () => {
    const out = merge({
      contributions: [pc([catalogContrib('openai/gpt-5'), apiContrib('gpt-5')])],
      labs,
      sourceMeta: {},
    });
    const gpt5 = out.models.find(m => m.id === 'openai/gpt-5')!;
    expect(gpt5.conflicts?.some(c => c.field === 'name' && c.resolvedFrom === 'catalog')).toBe(true);
    expect(out.conflictCount).toBeGreaterThan(0);
  });
});

describe('merge — offering aggregation', () => {
  it('aggregates multiple provider offerings into one model', () => {
    const out = merge({
      contributions: [
        pc([
          catalogContrib('openai/gpt-5'),
          apiContrib('gpt-5', { offering: { providerId: 'openai', providerName: 'OpenAI', modelId: 'gpt-5', pricing: { input: 1, output: 2 } } }),
          apiContrib('gpt-5', { offering: { providerId: 'azure', providerName: 'Azure', modelId: 'gpt-5', pricing: { input: 1.1, output: 2.2 } } }),
        ]),
      ],
      labs,
      sourceMeta: {},
    });
    const gpt5 = out.models.find(m => m.id === 'openai/gpt-5')!;
    expect(gpt5.offerings).toHaveLength(2);
    expect(gpt5.offerings.map(o => o.providerId).sort()).toEqual(['azure', 'openai']);
  });

  it('carries catalog-only benchmarks through', () => {
    const out = merge({ contributions: [pc([catalogContrib('openai/gpt-5')])], labs, sourceMeta: {} });
    const gpt5 = out.models.find(m => m.id === 'openai/gpt-5')!;
    expect(gpt5.benchmarks).toHaveLength(1);
    expect(gpt5.benchmarks[0]?.name).toBe('MMLU');
  });
});

describe('merge — synthesized ids for pricing-only models', () => {
  it('synthesizes lab/slug for an api slug with no catalog entry', () => {
    const out = merge({
      contributions: [pc([apiContrib('mystery-model')])],
      labs,
      sourceMeta: {},
    });
    // provider id used as lab guess -> "openai/mystery-model"
    const found = out.models.find(m => m.slug === 'mystery-model');
    expect(found).toBeDefined();
    expect(found!.id).toBe('openai/mystery-model');
  });
});

describe('merge — manual override survives', () => {
  it('applies override after source merge and records originalValue', () => {
    const out = merge({
      contributions: [pc([catalogContrib('openai/gpt-5')])],
      labs,
      overrides: {
        'openai/gpt-5': [
          { field: 'description', value: 'HAND-FIXED', updatedBy: 'admin', updatedAt: '2026-07-23T00:00:00Z' },
        ],
      },
      sourceMeta: {},
    });
    const gpt5 = out.models.find(m => m.id === 'openai/gpt-5')!;
    expect(gpt5.description).toBe('HAND-FIXED');
    expect(gpt5.overrides?.[0]?.field).toBe('description');
    expect(gpt5.sources.some(s => s.kind === 'manual')).toBe(true);
  });
});
