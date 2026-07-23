/**
 * DataStore unit tests — versioning, atomic commit, rollback (9.2.1).
 * DataStore 单测——版本控制、原子提交、回滚。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataStore } from './store.js';
import type { Model, Lab, DatasetMetadata } from '@models-dev/shared';

function makeMeta(version: number): DatasetMetadata {
  return {
    version,
    builtAt: new Date().toISOString(),
    contentHash: `hash-${version}`,
    modelCount: version,
    labCount: 1,
    providerCount: 1,
    sources: [],
    quarantinedCount: 0,
  };
}
function makeModel(id: string): Model {
  return {
    id, slug: id, name: id, lab: { id: 'x', name: 'X' }, aliases: [],
    modalities: { input: ['text'], output: ['text'] }, capabilities: [],
    openWeights: false, benchmarks: [], offerings: [], sources: [],
  };
}
const labs: Lab[] = [{ id: 'x', name: 'X', modelCount: 1, providerCount: 1 }];

describe('DataStore', () => {
  let dir: string;
  let store: DataStore;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ds-'));
    store = new DataStore(dir);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('commits and reads back a version', () => {
    store.commit({ models: [makeModel('a')], labs, metadata: makeMeta(1), quarantine: [] });
    expect(store.readMetadata()?.version).toBe(1);
    expect(store.readModels()).toHaveLength(1);
  });

  it('archives previous version on new commit', () => {
    store.commit({ models: [makeModel('a')], labs, metadata: makeMeta(1), quarantine: [] });
    store.commit({ models: [makeModel('a'), makeModel('b')], labs, metadata: makeMeta(2), quarantine: [] });
    expect(store.readMetadata()?.version).toBe(2);
    expect(store.listVersions()).toContain(1);
  });

  it('rolls back to a previous version (9.2.1)', () => {
    store.commit({ models: [makeModel('a')], labs, metadata: makeMeta(1), quarantine: [] });
    store.commit({ models: [makeModel('a'), makeModel('b')], labs, metadata: makeMeta(2), quarantine: [] });
    // current is v2 (2 models); rollback to v1 (1 model)
    const meta = store.rollback(1);
    expect(meta.version).toBe(1);
    expect(store.readModels()).toHaveLength(1);
  });

  it('throws when rolling back to a non-existent version', () => {
    store.commit({ models: [makeModel('a')], labs, metadata: makeMeta(1), quarantine: [] });
    expect(() => store.rollback(99)).toThrow(/not found/);
  });
});
