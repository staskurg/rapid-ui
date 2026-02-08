import { describe, it, expect } from 'vitest';
import { parsePayload } from '@/lib/inference/payload-parser';

describe('Field Inference Logic', () => {
  describe('Type Inference', () => {
    it('should infer string type from string value', () => {
      const payload = { name: 'Alice' };
      const parsed = parsePayload(payload);
      
      const nameField = parsed.fields.find((f) => f.name === 'name');
      expect(nameField).toBeDefined();
      expect(nameField?.type).toBe('string');
      expect(nameField?.label).toBe('Name');
    });

    it('should infer number type from number value', () => {
      const payload = { age: 42 };
      const parsed = parsePayload(payload);
      
      const ageField = parsed.fields.find((f) => f.name === 'age');
      expect(ageField).toBeDefined();
      expect(ageField?.type).toBe('number');
      expect(ageField?.label).toBe('Age');
    });

    it('should infer boolean type from boolean value', () => {
      const payload = { active: true };
      const parsed = parsePayload(payload);
      
      const activeField = parsed.fields.find((f) => f.name === 'active');
      expect(activeField).toBeDefined();
      expect(activeField?.type).toBe('boolean');
      expect(activeField?.label).toBe('Active');
    });

    it('should infer enum type from limited distinct string values (≤5)', () => {
      const payload = [
        { role: 'admin' },
        { role: 'user' },
        { role: 'admin' },
      ];
      const parsed = parsePayload(payload);
      
      const roleField = parsed.fields.find((f) => f.name === 'role');
      expect(roleField).toBeDefined();
      expect(roleField?.type).toBe('enum');
      expect(roleField?.options).toEqual(['admin', 'user']);
    });

    it('should infer string type when enum has more than 5 distinct values', () => {
      const payload = [
        { category: 'cat1' },
        { category: 'cat2' },
        { category: 'cat3' },
        { category: 'cat4' },
        { category: 'cat5' },
        { category: 'cat6' }, // 6 distinct values
      ];
      const parsed = parsePayload(payload);
      
      const categoryField = parsed.fields.find((f) => f.name === 'category');
      expect(categoryField).toBeDefined();
      expect(categoryField?.type).toBe('string'); // Should be string, not enum
    });
  });

  describe('Array Handling', () => {
    it('should use first element structure from array', () => {
      const payload = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
      ];
      const parsed = parsePayload(payload);
      
      // Should include all fields from all records
      const fieldNames = parsed.fields.map((f) => f.name);
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
    });

    it('should handle single object (not array)', () => {
      const payload = { id: 1, name: 'Alice' };
      const parsed = parsePayload(payload);
      
      expect(parsed.fields).toHaveLength(2);
      expect(parsed.fields.find((f) => f.name === 'id')).toBeDefined();
      expect(parsed.fields.find((f) => f.name === 'name')).toBeDefined();
    });

    it('should throw error for empty array', () => {
      const payload: unknown[] = [];
      
      expect(() => parsePayload(payload)).toThrow('Payload array is empty');
    });
  });

  describe('Nested Object Flattening', () => {
    it('should flatten nested objects with dot notation', () => {
      const payload = {
        id: 1,
        user: {
          name: 'Alice',
          email: 'alice@example.com',
        },
      };
      const parsed = parsePayload(payload);
      
      const fieldNames = parsed.fields.map((f) => f.name);
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('user.name');
      expect(fieldNames).toContain('user.email');
      
      const userNameField = parsed.fields.find((f) => f.name === 'user.name');
      // Label generation converts dot notation: "user.name" -> "User.name" (preserves dots)
      expect(userNameField?.label).toBe('User.name');
    });

    it('should handle deeply nested objects', () => {
      const payload = {
        id: 1,
        address: {
          street: {
            name: 'Main St',
            number: 123,
          },
        },
      };
      const parsed = parsePayload(payload);
      
      const fieldNames = parsed.fields.map((f) => f.name);
      expect(fieldNames).toContain('address.street.name');
      expect(fieldNames).toContain('address.street.number');
    });
  });

  describe('Required Field Detection', () => {
    it('should mark field as required if all records have non-null values', () => {
      const payload = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      const parsed = parsePayload(payload);
      
      const idField = parsed.fields.find((f) => f.name === 'id');
      const nameField = parsed.fields.find((f) => f.name === 'name');
      
      expect(idField?.required).toBe(true);
      expect(nameField?.required).toBe(true);
    });

    it('should mark field as optional if some records have null/undefined values', () => {
      const payload = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob' }, // email missing
      ];
      const parsed = parsePayload(payload);
      
      const emailField = parsed.fields.find((f) => f.name === 'email');
      expect(emailField?.required).toBe(false);
    });
  });

  describe('Label Generation', () => {
    it('should convert camelCase to Title Case', () => {
      const payload = { firstName: 'Alice' };
      const parsed = parsePayload(payload);
      
      const field = parsed.fields.find((f) => f.name === 'firstName');
      expect(field?.label).toBe('First Name');
    });

    it('should handle single word field names', () => {
      const payload = { name: 'Alice' };
      const parsed = parsePayload(payload);
      
      const field = parsed.fields.find((f) => f.name === 'name');
      expect(field?.label).toBe('Name');
    });

    it('should handle multiple camelCase words', () => {
      const payload = { userName: 'alice', userEmail: 'alice@example.com' };
      const parsed = parsePayload(payload);
      
      const userNameField = parsed.fields.find((f) => f.name === 'userName');
      const userEmailField = parsed.fields.find((f) => f.name === 'userEmail');
      
      expect(userNameField?.label).toBe('User Name');
      expect(userEmailField?.label).toBe('User Email');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values gracefully', () => {
      const payload = [
        { id: 1, name: 'Alice', email: null },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
      ];
      const parsed = parsePayload(payload);
      
      const emailField = parsed.fields.find((f) => f.name === 'email');
      expect(emailField).toBeDefined();
      expect(emailField?.required).toBe(false);
    });

    it('should handle undefined values gracefully', () => {
      const payload = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
      ];
      const parsed = parsePayload(payload);
      
      const emailField = parsed.fields.find((f) => f.name === 'email');
      expect(emailField).toBeDefined();
      expect(emailField?.required).toBe(false);
    });

    it('should throw error for invalid payload types', () => {
      expect(() => parsePayload(null)).toThrow();
      expect(() => parsePayload('string')).toThrow();
      expect(() => parsePayload(123)).toThrow();
    });

    it('should default to string type when no values found', () => {
      const payload = [{ emptyField: null }];
      const parsed = parsePayload(payload);
      
      const emptyField = parsed.fields.find((f) => f.name === 'emptyField');
      expect(emptyField?.type).toBe('string');
      expect(emptyField?.required).toBe(false);
    });
  });
});
