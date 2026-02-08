import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { UISpecSchema } from '@/lib/spec/schema';
import type { UISpec } from '@/lib/spec/types';

/**
 * UISpec Contract Validation Tests
 *
 * These tests ensure that any UISpec — including AI-generated specs —
 * complies with schema and logical renderer safety constraints.
 *
 * This is NOT an AI evaluation or determinism test.
 * It validates the structural contract required by the renderer.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('UISpec Contract Validation', () => {
  // Fixtures are in the ai directory (legacy location, but path is relative)
  const fixturesDir = join(__dirname, '../ai/fixtures');

  function loadFixture(name: string): UISpec {
    const path = join(fixturesDir, name);
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  describe('Valid UISpec Fixtures', () => {
    it('should validate simple object fixture', () => {
      const spec = loadFixture('simple-object.json');
      const validated = UISpecSchema.parse(spec);
      
      expect(validated).toBeDefined();
      expect(validated.entity).toBe('Product');
      expect(validated.fields.length).toBeGreaterThan(0);
      
      // Table columns reference existing fields
      const fieldNames = new Set(validated.fields.map((f) => f.name));
      validated.table.columns.forEach((col) => {
        expect(fieldNames.has(col)).toBe(true);
      });

      // Form fields reference existing fields
      validated.form.fields.forEach((field) => {
        expect(fieldNames.has(field)).toBe(true);
      });

      // Filters reference existing fields
      validated.filters.forEach((filter) => {
        expect(fieldNames.has(filter)).toBe(true);
      });
    });

    it('should validate enum structure fixture', () => {
      const spec = loadFixture('enum-structure.json');
      const validated = UISpecSchema.parse(spec);
      
      expect(validated).toBeDefined();

      // Verify enum field has options
      const statusField = validated.fields.find((f) => f.name === 'status');
      expect(statusField).toBeDefined();
      expect(statusField?.type).toBe('enum');
      expect(statusField?.options).toBeDefined();
      expect(statusField?.options?.length).toBeGreaterThan(0);
    });

    it('should validate edge case fixture', () => {
      const spec = loadFixture('edge-case.json');
      const validated = UISpecSchema.parse(spec);
      
      expect(validated).toBeDefined();

      // Verify boolean field
      const completedField = validated.fields.find((f) => f.name === 'completed');
      expect(completedField).toBeDefined();
      expect(completedField?.type).toBe('boolean');

      // Verify enum field
      const priorityField = validated.fields.find((f) => f.name === 'priority');
      expect(priorityField).toBeDefined();
      expect(priorityField?.type).toBe('enum');
      expect(priorityField?.options).toBeDefined();
    });
  });

  describe('Renderer Safety Constraints', () => {
    it('should ensure all fixtures pass Zod validation', () => {
      const fixtures = [
        'simple-object.json',
        'enum-structure.json',
        'edge-case.json',
      ];

      fixtures.forEach((fixture) => {
        const spec = loadFixture(fixture);
        const validated = UISpecSchema.parse(spec);
        expect(validated).toBeDefined();
      });
    });

    it('should ensure table columns exist in fields', () => {
      const spec = loadFixture('simple-object.json');
      const validated = UISpecSchema.parse(spec);

      const fieldNames = new Set(validated.fields.map((f) => f.name));
      validated.table.columns.forEach((col) => {
        expect(fieldNames.has(col)).toBe(true);
      });
    });

    it('should ensure form fields exist in fields', () => {
      const spec = loadFixture('simple-object.json');
      const validated = UISpecSchema.parse(spec);

      const fieldNames = new Set(validated.fields.map((f) => f.name));
      validated.form.fields.forEach((field) => {
        expect(fieldNames.has(field)).toBe(true);
      });
    });

    it('should ensure filter fields exist in fields', () => {
      const spec = loadFixture('simple-object.json');
      const validated = UISpecSchema.parse(spec);

      const fieldNames = new Set(validated.fields.map((f) => f.name));
      validated.filters.forEach((filter) => {
        expect(fieldNames.has(filter)).toBe(true);
      });
    });

    it('should ensure enum fields have options array', () => {
      const spec = loadFixture('enum-structure.json');
      const validated = UISpecSchema.parse(spec);

      validated.fields.forEach((field) => {
        if (field.type === 'enum') {
          expect(field.options).toBeDefined();
          expect(Array.isArray(field.options)).toBe(true);
          expect(field.options?.length).toBeGreaterThan(0);
        }
      });
    });

    it('should reject invalid UISpec', () => {
      const badSpec = { entity: 123 };
      expect(() => UISpecSchema.parse(badSpec)).toThrow();
    });
  });

  describe('UISpec Logical Guarantees', () => {
    it('should ensure table has at least one column', () => {
      const spec = loadFixture('simple-object.json');
      const validated = UISpecSchema.parse(spec);

      expect(validated.table.columns.length).toBeGreaterThan(0);
    });

    it('should ensure form has at least one field', () => {
      const spec = loadFixture('simple-object.json');
      const validated = UISpecSchema.parse(spec);

      expect(validated.form.fields.length).toBeGreaterThan(0);
    });

    it('should ensure entity name is not empty', () => {
      const spec = loadFixture('simple-object.json');
      const validated = UISpecSchema.parse(spec);

      expect(validated.entity.length).toBeGreaterThan(0);
    });
  });
});
