import { describe, expect, it } from 'vitest';

import { ALL_FEATURES } from './index';

describe('Feature manifest list', () => {
  it('keys must be alphanumeric, lowercase, and hyphenated', () => {
    for (const feature of ALL_FEATURES) {
      expect(
        feature.key,
        `Invalid key for feature: ${feature.name}. Keys must be alphanumeric, lowercase and hyphenated.`,
      ).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('keys must be unique', () => {
    const seenKeys = new Set<string>();
    for (const feature of ALL_FEATURES) {
      expect(seenKeys.has(feature.key), `Duplicate key found for feature: ${feature.key}`).toBe(
        false,
      );
      seenKeys.add(feature.key);
    }
  });

  it('name and description must be non-empty', () => {
    for (const feature of ALL_FEATURES) {
      expect(feature.name, `Name is required for feature: ${feature.key}`).toBeTruthy();
      expect(
        feature.description,
        `Description is required for feature: ${feature.key}`,
      ).toBeTruthy();
    }
  });
});
