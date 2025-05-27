/**
 * Tests for DurationParser - ADHD-Friendly Time Duration Support
 * 
 * Tests the bidirectional conversion between Obsidian ⏱️ syntax and Todoist duration field.
 * Critical for ADHD users with time blindness.
 */

import { describe, it, expect } from 'vitest';
import { DurationParser, ADHDDurationUtils } from '../src/core/sync/DurationParser';
import type { Duration } from '../src/api/domain/task';

describe('DurationParser', () => {
  describe('parseDuration', () => {
    it('should parse minute format', () => {
      const result = DurationParser.parseDuration('- [ ] Task ⏱️ 30min');
      expect(result).toEqual({ amount: 30, unit: 'minute' });
    });

    it('should parse hour format', () => {
      const result = DurationParser.parseDuration('- [ ] Task ⏱️ 2h');
      expect(result).toEqual({ amount: 120, unit: 'minute' });
    });

    it('should parse day format', () => {
      const result = DurationParser.parseDuration('- [ ] Task ⏱️ 1d');
      expect(result).toEqual({ amount: 1, unit: 'day' });
    });

    it('should parse complex hour format', () => {
      const result = DurationParser.parseDuration('- [ ] Task ⏱️ 3h30min');
      expect(result).toEqual({ amount: 210, unit: 'minute' });
    });

    it('should parse decimal hour format', () => {
      const result = DurationParser.parseDuration('- [ ] Task ⏱️ 2.5h');
      expect(result).toEqual({ amount: 150, unit: 'minute' });
    });

    it('should handle flexible spacing', () => {
      const result = DurationParser.parseDuration('- [ ] Task ⏱️  45min  🟡');
      expect(result).toEqual({ amount: 45, unit: 'minute' });
    });

    it('should return null for invalid format', () => {
      const result = DurationParser.parseDuration('- [ ] Task without duration');
      expect(result).toBeNull();
    });

    it('should return null for zero duration', () => {
      const result = DurationParser.parseDuration('- [ ] Task ⏱️ 0min');
      expect(result).toBeNull();
    });

    it('should work with complex task lines', () => {
      const result = DurationParser.parseDuration(
        '- [ ] Write report ⏱️ 2h 🟡 📅 1/15/2024 #work #urgent'
      );
      expect(result).toEqual({ amount: 120, unit: 'minute' });
    });
  });

  describe('formatDuration', () => {
    it('should format minutes', () => {
      const result = DurationParser.formatDuration({ amount: 30, unit: 'minute' });
      expect(result).toBe('⏱️ 30min');
    });

    it('should format hours', () => {
      const result = DurationParser.formatDuration({ amount: 120, unit: 'minute' });
      expect(result).toBe('⏱️ 2h');
    });

    it('should format complex hours', () => {
      const result = DurationParser.formatDuration({ amount: 150, unit: 'minute' });
      expect(result).toBe('⏱️ 2h30min');
    });

    it('should format days', () => {
      const result = DurationParser.formatDuration({ amount: 1, unit: 'day' });
      expect(result).toBe('⏱️ 1d');
    });

    it('should format multiple days', () => {
      const result = DurationParser.formatDuration({ amount: 3, unit: 'day' });
      expect(result).toBe('⏱️ 3d');
    });
  });

  describe('removeDuration', () => {
    it('should remove duration from task line', () => {
      const result = DurationParser.removeDuration('- [ ] Task ⏱️ 30min 🟡');
      expect(result).toBe('- [ ] Task 🟡');
    });

    it('should handle multiple duration patterns', () => {
      const result = DurationParser.removeDuration('- [ ] Task ⏱️ 2h30min #work');
      expect(result).toBe('- [ ] Task #work');
    });

    it('should not affect lines without duration', () => {
      const result = DurationParser.removeDuration('- [ ] Task without duration');
      expect(result).toBe('- [ ] Task without duration');
    });
  });

  describe('durationsEqual', () => {
    it('should return true for equal durations', () => {
      const d1: Duration = { amount: 30, unit: 'minute' };
      const d2: Duration = { amount: 30, unit: 'minute' };
      expect(DurationParser.durationsEqual(d1, d2)).toBe(true);
    });

    it('should return false for different amounts', () => {
      const d1: Duration = { amount: 30, unit: 'minute' };
      const d2: Duration = { amount: 60, unit: 'minute' };
      expect(DurationParser.durationsEqual(d1, d2)).toBe(false);
    });

    it('should return false for different units', () => {
      const d1: Duration = { amount: 1, unit: 'day' };
      const d2: Duration = { amount: 1, unit: 'minute' };
      expect(DurationParser.durationsEqual(d1, d2)).toBe(false);
    });

    it('should return true for both null', () => {
      expect(DurationParser.durationsEqual(null, null)).toBe(true);
    });

    it('should return false for one null', () => {
      const d1: Duration = { amount: 30, unit: 'minute' };
      expect(DurationParser.durationsEqual(d1, null)).toBe(false);
      expect(DurationParser.durationsEqual(null, d1)).toBe(false);
    });
  });

  describe('isValidDuration', () => {
    it('should accept null duration', () => {
      expect(DurationParser.isValidDuration(null)).toBe(true);
    });

    it('should accept valid minute duration', () => {
      expect(DurationParser.isValidDuration({ amount: 30, unit: 'minute' })).toBe(true);
    });

    it('should accept valid day duration', () => {
      expect(DurationParser.isValidDuration({ amount: 1, unit: 'day' })).toBe(true);
    });

    it('should reject zero amount', () => {
      expect(DurationParser.isValidDuration({ amount: 0, unit: 'minute' })).toBe(false);
    });

    it('should reject negative amount', () => {
      expect(DurationParser.isValidDuration({ amount: -30, unit: 'minute' })).toBe(false);
    });

    it('should reject excessive minutes (>24 hours)', () => {
      expect(DurationParser.isValidDuration({ amount: 1500, unit: 'minute' })).toBe(false);
    });

    it('should reject excessive days (>1 year)', () => {
      expect(DurationParser.isValidDuration({ amount: 400, unit: 'day' })).toBe(false);
    });
  });

  describe('toMinutes', () => {
    it('should return null for null duration', () => {
      expect(DurationParser.toMinutes(null)).toBeNull();
    });

    it('should return minutes for minute duration', () => {
      expect(DurationParser.toMinutes({ amount: 30, unit: 'minute' })).toBe(30);
    });

    it('should convert days to minutes', () => {
      expect(DurationParser.toMinutes({ amount: 1, unit: 'day' })).toBe(1440);
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve duration through round-trip', () => {
      const originalDuration: Duration = { amount: 90, unit: 'minute' };
      
      // Format to markdown
      const formatted = DurationParser.formatDuration(originalDuration);
      expect(formatted).toBe('⏱️ 1h30min');
      
      // Parse back from markdown
      const parsed = DurationParser.parseDuration(`- [ ] Task ${formatted}`);
      expect(parsed).toEqual(originalDuration);
    });

    it('should handle day duration round-trip', () => {
      const originalDuration: Duration = { amount: 2, unit: 'day' };
      
      const formatted = DurationParser.formatDuration(originalDuration);
      expect(formatted).toBe('⏱️ 2d');
      
      const parsed = DurationParser.parseDuration(`- [ ] Task ${formatted}`);
      expect(parsed).toEqual(originalDuration);
    });
  });
});

describe('ADHDDurationUtils', () => {
  describe('suggestDuration', () => {
    it('should suggest quick duration for email tasks', () => {
      const result = ADHDDurationUtils.suggestDuration('Check email');
      expect(result).toEqual({ amount: 15, unit: 'minute' });
    });

    it('should suggest medium duration for writing tasks', () => {
      const result = ADHDDurationUtils.suggestDuration('Write report');
      expect(result).toEqual({ amount: 45, unit: 'minute' });
    });

    it('should suggest long duration for project tasks', () => {
      const result = ADHDDurationUtils.suggestDuration('Develop new feature');
      expect(result).toEqual({ amount: 120, unit: 'minute' });
    });

    it('should provide default for unknown tasks', () => {
      const result = ADHDDurationUtils.suggestDuration('Unknown task');
      expect(result).toEqual({ amount: 30, unit: 'minute' });
    });
  });

  describe('isHyperfocusFriendly', () => {
    it('should return true for optimal hyperfocus range', () => {
      expect(ADHDDurationUtils.isHyperfocusFriendly({ amount: 45, unit: 'minute' })).toBe(true);
      expect(ADHDDurationUtils.isHyperfocusFriendly({ amount: 90, unit: 'minute' })).toBe(true);
    });

    it('should return false for too short tasks', () => {
      expect(ADHDDurationUtils.isHyperfocusFriendly({ amount: 15, unit: 'minute' })).toBe(false);
    });

    it('should return false for too long tasks', () => {
      expect(ADHDDurationUtils.isHyperfocusFriendly({ amount: 120, unit: 'minute' })).toBe(false);
    });

    it('should return false for null duration', () => {
      expect(ADHDDurationUtils.isHyperfocusFriendly(null)).toBe(false);
    });
  });

  describe('getTimeAwarenessLevel', () => {
    it('should categorize quick tasks', () => {
      expect(ADHDDurationUtils.getTimeAwarenessLevel({ amount: 10, unit: 'minute' })).toBe('quick');
    });

    it('should categorize focused tasks', () => {
      expect(ADHDDurationUtils.getTimeAwarenessLevel({ amount: 45, unit: 'minute' })).toBe('focused');
    });

    it('should categorize deep work', () => {
      expect(ADHDDurationUtils.getTimeAwarenessLevel({ amount: 120, unit: 'minute' })).toBe('deep');
    });

    it('should categorize project work', () => {
      expect(ADHDDurationUtils.getTimeAwarenessLevel({ amount: 240, unit: 'minute' })).toBe('project');
    });

    it('should default to quick for null duration', () => {
      expect(ADHDDurationUtils.getTimeAwarenessLevel(null)).toBe('quick');
    });
  });
});
