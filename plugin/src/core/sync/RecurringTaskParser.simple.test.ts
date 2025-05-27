/**
 * Simple tests for RecurringTaskParser - Phase 1: Core Recurring Support
 */

import { ADHDRecurringUtils, RecurringTaskParser } from './RecurringTaskParser';

describe('RecurringTaskParser - Simplified', () => {
  describe('parseRecurring', () => {
    it('should parse emoji-based patterns', () => {
      const testCases = [
        { input: '- [ ] Take medication 🔄 every day', expected: 'every day' },
        { input: '- [ ] Weekly review 🔄 every saturday', expected: 'every saturday' },
        { input: '- [ ] Exercise 🔄 every 2 days', expected: 'every 2 days' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = RecurringTaskParser.parseRecurring(input);
        expect(result).not.toBeNull();
        expect(result!.todoistPattern).toBe(expected);
        expect(result!.originalText).toContain('🔄');
      });
    });

    it('should parse text-only patterns', () => {
      const testCases = [
        { input: '- [ ] Take medication every day', expected: 'every day' },
        { input: '- [ ] Weekly review every week', expected: 'every week' },
        { input: '- [ ] Monthly budget every month', expected: 'every month' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = RecurringTaskParser.parseRecurring(input);
        expect(result).not.toBeNull();
        expect(result!.todoistPattern).toBe(expected);
      });
    });

    it('should return null for non-recurring tasks', () => {
      const testCases = [
        '- [ ] One-time task',
        '- [ ] Buy groceries',
        '- [ ] Call mom',
      ];

      testCases.forEach(input => {
        const result = RecurringTaskParser.parseRecurring(input);
        expect(result).toBeNull();
      });
    });
  });

  describe('formatRecurring', () => {
    it('should format Todoist patterns with emoji', () => {
      const testCases = [
        { pattern: 'every day', expected: '🔄 every day' },
        { pattern: 'every saturday', expected: '🔄 every saturday' },
        { pattern: 'every 2 weeks', expected: '🔄 every 2 weeks' },
      ];

      testCases.forEach(({ pattern, expected }) => {
        const result = RecurringTaskParser.formatRecurring(pattern);
        expect(result).toBe(expected);
      });
    });
  });

  describe('removeRecurring', () => {
    it('should remove recurring patterns from markdown lines', () => {
      const testCases = [
        {
          input: '- [ ] Take medication 🔄 every day 🟡 📅 2024-01-15',
          expected: '- [ ] Take medication 🟡 📅 2024-01-15'
        },
        {
          input: '- [ ] Exercise every 2 days ⏱️ 30min',
          expected: '- [ ] Exercise ⏱️ 30min'
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = RecurringTaskParser.removeRecurring(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('isRecurringPattern', () => {
    it('should detect recurring patterns', () => {
      const testCases = [
        { input: 'every day', expected: true },
        { input: 'every saturday', expected: true },
        { input: 'daily', expected: true },
        { input: 'weekly', expected: true },
        { input: 'monthly', expected: true },
        { input: 'today', expected: false },
        { input: 'tomorrow', expected: false },
        { input: 'next week', expected: false },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = RecurringTaskParser.isRecurringPattern(input);
        expect(result).toBe(expected);
      });
    });
  });
});

describe('ADHDRecurringUtils', () => {
  describe('suggestRecurrence', () => {
    it('should suggest daily patterns for routine keywords', () => {
      const testCases = [
        'Take medication',
        'Morning routine',
        'Evening pills',
        'Daily standup',
        'Check routine',
      ];

      testCases.forEach(input => {
        const result = ADHDRecurringUtils.suggestRecurrence(input);
        expect(result).toBe('every day');
      });
    });

    it('should suggest weekly patterns for weekly keywords', () => {
      const testCases = [
        'Weekly review',
        'Planning session',
        'Grocery shopping',
        'Laundry day',
        'Clean apartment',
      ];

      testCases.forEach(input => {
        const result = ADHDRecurringUtils.suggestRecurrence(input);
        expect(result).toBe('every week');
      });
    });

    it('should suggest monthly patterns for monthly keywords', () => {
      const testCases = [
        'Monthly budget',
        'Pay bills',
        'Rent payment',
        'Subscription review',
      ];

      testCases.forEach(input => {
        const result = ADHDRecurringUtils.suggestRecurrence(input);
        expect(result).toBe('every month');
      });
    });

    it('should return null for non-routine tasks', () => {
      const testCases = [
        'Buy new laptop',
        'Call dentist',
        'Fix bug #123',
        'Meeting with client',
      ];

      testCases.forEach(input => {
        const result = ADHDRecurringUtils.suggestRecurrence(input);
        expect(result).toBeNull();
      });
    });
  });

  describe('getPatternDescription', () => {
    it('should return Todoist patterns as-is', () => {
      const testCases = [
        { pattern: 'every day', expected: 'every day' },
        { pattern: 'every saturday', expected: 'every saturday' },
        { pattern: 'every 2 weeks', expected: 'every 2 weeks' },
        { pattern: 'every month', expected: 'every month' },
      ];

      testCases.forEach(({ pattern, expected }) => {
        const result = ADHDRecurringUtils.getPatternDescription(pattern);
        expect(result).toBe(expected);
      });
    });
  });
});
