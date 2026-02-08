import { describe, it, expect } from 'vitest';
import { generateFallbackSpec } from '@/lib/inference/fallback-generator';
import { UISpecSchema } from '@/lib/spec/schema';

describe('Fallback Spec Generator', () => {
  describe('Always Returns Valid UISpec', () => {
    it('should always return a valid UISpec that passes Zod validation', () => {
      const spec = generateFallbackSpec(null);
      
      expect(() => UISpecSchema.parse(spec)).not.toThrow();
      expect(spec.entity).toBeDefined();
      expect(spec.fields.length).toBeGreaterThan(0);
      expect(spec.table.columns.length).toBeGreaterThan(0);
      expect(spec.form.fields.length).toBeGreaterThan(0);
    });

    it('should return valid spec for empty payload', () => {
      const spec = generateFallbackSpec([]);
      
      expect(() => UISpecSchema.parse(spec)).not.toThrow();
    });

    it('should return valid spec for invalid JSON string', () => {
      const spec = generateFallbackSpec('invalid json');
      
      expect(() => UISpecSchema.parse(spec)).not.toThrow();
    });

    it('should return valid spec for null payload', () => {
      const spec = generateFallbackSpec(null);
      
      expect(() => UISpecSchema.parse(spec)).not.toThrow();
    });

    it('should return valid spec for undefined payload', () => {
      const spec = generateFallbackSpec(undefined);
      
      expect(() => UISpecSchema.parse(spec)).not.toThrow();
    });
  });

  describe('Consistent Field References', () => {
    it('should ensure table columns reference existing fields', () => {
      const spec = generateFallbackSpec(null);
      
      const fieldNames = new Set(spec.fields.map((f) => f.name));
      spec.table.columns.forEach((col) => {
        expect(fieldNames.has(col)).toBe(true);
      });
    });

    it('should ensure form fields reference existing fields', () => {
      const spec = generateFallbackSpec(null);
      
      const fieldNames = new Set(spec.fields.map((f) => f.name));
      spec.form.fields.forEach((field) => {
        expect(fieldNames.has(field)).toBe(true);
      });
    });

    it('should ensure filter fields reference existing fields', () => {
      const spec = generateFallbackSpec(null);
      
      const fieldNames = new Set(spec.fields.map((f) => f.name));
      spec.filters.forEach((filter) => {
        expect(fieldNames.has(filter)).toBe(true);
      });
    });
  });

  describe('Default Configurations', () => {
    it('should have default table config with at least one column', () => {
      const spec = generateFallbackSpec(null);
      
      expect(spec.table.columns.length).toBeGreaterThan(0);
    });

    it('should have default form config with at least one field', () => {
      const spec = generateFallbackSpec(null);
      
      expect(spec.form.fields.length).toBeGreaterThan(0);
    });

    it('should have default entity name', () => {
      const spec = generateFallbackSpec(null);
      
      expect(spec.entity).toBe('Entity');
    });
  });

  describe('Fallback Behavior', () => {
    it('should use fallback spec when payload parsing fails', () => {
      const spec = generateFallbackSpec('not valid json');
      
      // Should return the hardcoded fallback spec
      expect(spec.entity).toBe('Entity');
      expect(spec.fields.some((f) => f.name === 'id')).toBe(true);
      expect(spec.fields.some((f) => f.name === 'data')).toBe(true);
    });

    it('should use normal parsing when payload is valid', () => {
      const validPayload = [{ name: 'Alice', age: 30 }];
      const spec = generateFallbackSpec(validPayload);
      
      // Should parse normally, not use fallback
      expect(spec.fields.some((f) => f.name === 'name')).toBe(true);
      expect(spec.fields.some((f) => f.name === 'age')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty object', () => {
      const spec = generateFallbackSpec({});
      
      expect(() => UISpecSchema.parse(spec)).not.toThrow();
    });

    it('should handle object with only null values', () => {
      const spec = generateFallbackSpec({ field1: null, field2: null });
      
      expect(() => UISpecSchema.parse(spec)).not.toThrow();
    });

    it('should handle array with only null values', () => {
      const spec = generateFallbackSpec([{ field: null }]);
      
      expect(() => UISpecSchema.parse(spec)).not.toThrow();
    });

    it('should never throw an error', () => {
      const testCases = [
        null,
        undefined,
        [],
        {},
        'invalid',
        123,
        true,
        { nested: { deep: { value: 'test' } } },
      ];

      testCases.forEach((testCase) => {
        expect(() => generateFallbackSpec(testCase)).not.toThrow();
      });
    });
  });
});
