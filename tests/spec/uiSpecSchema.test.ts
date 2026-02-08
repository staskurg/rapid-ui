import { describe, it, expect } from 'vitest';
import { UISpecSchema, type UISpec } from '@/lib/spec/schema';

describe('UISpec Schema Validation', () => {
  describe('Valid Specs', () => {
    it('should accept a valid UISpec with all required fields', () => {
      const validSpec: UISpec = {
        entity: 'User',
        fields: [
          {
            name: 'id',
            label: 'ID',
            type: 'number',
            required: true,
          },
          {
            name: 'name',
            label: 'Name',
            type: 'string',
            required: true,
          },
        ],
        table: {
          columns: ['id', 'name'],
        },
        form: {
          fields: ['name'],
        },
        filters: ['name'],
      };

      expect(() => UISpecSchema.parse(validSpec)).not.toThrow();
      const parsed = UISpecSchema.parse(validSpec);
      expect(parsed.entity).toBe('User');
      expect(parsed.fields).toHaveLength(2);
    });

    it('should accept a valid spec with enum field', () => {
      const validSpec: UISpec = {
        entity: 'Product',
        fields: [
          {
            name: 'status',
            label: 'Status',
            type: 'enum',
            required: false,
            options: ['active', 'inactive', 'pending'],
          },
        ],
        table: {
          columns: ['status'],
        },
        form: {
          fields: ['status'],
        },
        filters: [],
      };

      expect(() => UISpecSchema.parse(validSpec)).not.toThrow();
    });

    it('should accept a valid spec with boolean field', () => {
      const validSpec: UISpec = {
        entity: 'Feature',
        fields: [
          {
            name: 'enabled',
            label: 'Enabled',
            type: 'boolean',
            required: false,
          },
        ],
        table: {
          columns: ['enabled'],
        },
        form: {
          fields: ['enabled'],
        },
        filters: [],
      };

      expect(() => UISpecSchema.parse(validSpec)).not.toThrow();
    });
  });

  describe('Invalid Specs - Missing Required Fields', () => {
    it('should reject spec missing entity name', () => {
      const invalidSpec = {
        fields: [
          {
            name: 'id',
            label: 'ID',
            type: 'number',
            required: true,
          },
        ],
        table: { columns: ['id'] },
        form: { fields: ['id'] },
        filters: [],
      };

      expect(() => UISpecSchema.parse(invalidSpec)).toThrow();
    });

    it('should reject spec missing fields array', () => {
      const invalidSpec = {
        entity: 'User',
        table: { columns: ['id'] },
        form: { fields: ['id'] },
        filters: [],
      };

      expect(() => UISpecSchema.parse(invalidSpec)).toThrow();
    });

    it('should reject spec with empty fields array', () => {
      const invalidSpec = {
        entity: 'User',
        fields: [],
        table: { columns: ['id'] },
        form: { fields: ['id'] },
        filters: [],
      };

      expect(() => UISpecSchema.parse(invalidSpec)).toThrow();
    });

    it('should reject spec missing table config', () => {
      const invalidSpec = {
        entity: 'User',
        fields: [
          {
            name: 'id',
            label: 'ID',
            type: 'number',
            required: true,
          },
        ],
        form: { fields: ['id'] },
        filters: [],
      };

      expect(() => UISpecSchema.parse(invalidSpec)).toThrow();
    });

    it('should reject spec missing form config', () => {
      const invalidSpec = {
        entity: 'User',
        fields: [
          {
            name: 'id',
            label: 'ID',
            type: 'number',
            required: true,
          },
        ],
        table: { columns: ['id'] },
        filters: [],
      };

      expect(() => UISpecSchema.parse(invalidSpec)).toThrow();
    });
  });

  describe('Invalid Specs - Invalid Field Types', () => {
    it('should reject field with invalid type', () => {
      const invalidSpec = {
        entity: 'User',
        fields: [
          {
            name: 'id',
            label: 'ID',
            type: 'invalid-type', // Invalid type
            required: true,
          },
        ],
        table: { columns: ['id'] },
        form: { fields: ['id'] },
        filters: [],
      };

      expect(() => UISpecSchema.parse(invalidSpec)).toThrow();
    });
  });

  describe('Invalid Specs - Enum Fields', () => {
    it('should reject enum field without options array', () => {
      const invalidSpec = {
        entity: 'Product',
        fields: [
          {
            name: 'status',
            label: 'Status',
            type: 'enum',
            required: false,
            // Missing options array
          },
        ],
        table: { columns: ['status'] },
        form: { fields: ['status'] },
        filters: [],
      };

      expect(() => UISpecSchema.parse(invalidSpec)).toThrow();
    });

    it('should reject enum field with empty options array', () => {
      const invalidSpec = {
        entity: 'Product',
        fields: [
          {
            name: 'status',
            label: 'Status',
            type: 'enum',
            required: false,
            options: [], // Empty options array
          },
        ],
        table: { columns: ['status'] },
        form: { fields: ['status'] },
        filters: [],
      };

      expect(() => UISpecSchema.parse(invalidSpec)).toThrow();
    });
  });

  describe('Invalid Specs - Broken Field References', () => {
    it('should reject table columns referencing non-existent field', () => {
      const invalidSpec = {
        entity: 'User',
        fields: [
          {
            name: 'id',
            label: 'ID',
            type: 'number',
            required: true,
          },
        ],
        table: {
          columns: ['id', 'nonExistentField'], // References non-existent field
        },
        form: { fields: ['id'] },
        filters: [],
      };

      expect(() => UISpecSchema.parse(invalidSpec)).toThrow();
    });

    it('should reject form fields referencing non-existent field', () => {
      const invalidSpec = {
        entity: 'User',
        fields: [
          {
            name: 'id',
            label: 'ID',
            type: 'number',
            required: true,
          },
        ],
        table: { columns: ['id'] },
        form: {
          fields: ['id', 'nonExistentField'], // References non-existent field
        },
        filters: [],
      };

      expect(() => UISpecSchema.parse(invalidSpec)).toThrow();
    });

    it('should reject filters referencing non-existent field', () => {
      const invalidSpec = {
        entity: 'User',
        fields: [
          {
            name: 'id',
            label: 'ID',
            type: 'number',
            required: true,
          },
        ],
        table: { columns: ['id'] },
        form: { fields: ['id'] },
        filters: ['nonExistentField'], // References non-existent field
      };

      expect(() => UISpecSchema.parse(invalidSpec)).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should accept empty filters array', () => {
      const validSpec: UISpec = {
        entity: 'User',
        fields: [
          {
            name: 'id',
            label: 'ID',
            type: 'number',
            required: true,
          },
        ],
        table: { columns: ['id'] },
        form: { fields: ['id'] },
        filters: [],
      };

      expect(() => UISpecSchema.parse(validSpec)).not.toThrow();
    });

    it('should accept field with required: false', () => {
      const validSpec: UISpec = {
        entity: 'User',
        fields: [
          {
            name: 'optionalField',
            label: 'Optional Field',
            type: 'string',
            required: false,
          },
        ],
        table: { columns: ['optionalField'] },
        form: { fields: ['optionalField'] },
        filters: [],
      };

      expect(() => UISpecSchema.parse(validSpec)).not.toThrow();
    });
  });
});
