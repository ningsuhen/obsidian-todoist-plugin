/**
 * Duration Parser for ADHD-Friendly Time Estimates
 *
 * Handles bidirectional conversion between Obsidian ⏱️ syntax and Todoist duration field.
 * Supports ADHD users with time blindness through visual time indicators.
 *
 * Supported formats:
 * - ⏱️ 30min (30 minutes)
 * - ⏱️ 2h (2 hours = 120 minutes)
 * - ⏱️ 1d (1 day)
 * - ⏱️ 3h30min (3.5 hours = 210 minutes)
 */

import type { Duration } from '../../api/domain/task';

export class DurationParser {
  /**
   * Parse duration from Obsidian markdown syntax
   *
   * @param markdownLine - The markdown line containing potential duration syntax
   * @returns Duration object or null if no valid duration found
   *
   * @example
   * ```typescript
   * DurationParser.parseDuration('- [ ] Task ⏱️ 30min')
   * // Returns: { amount: 30, unit: 'minute' }
   *
   * DurationParser.parseDuration('- [ ] Task ⏱️ 2h')
   * // Returns: { amount: 120, unit: 'minute' }
   *
   * DurationParser.parseDuration('- [ ] Task ⏱️ 1d')
   * // Returns: { amount: 1, unit: 'day' }
   * ```
   */
  static parseDuration(markdownLine: string): Duration | null {
    // Match ⏱️ followed by duration with flexible spacing
    // Supports: 30min, 2h, 1d, 3h30min
    const durationMatch = markdownLine.match(/⏱️\s*(\d+(?:\.\d+)?)(min|h|d)(?:(\d+)min)?/);

    if (!durationMatch) {
      return null;
    }

    const [, primaryAmount, primaryUnit, extraMinutes] = durationMatch;
    let totalMinutes = 0;

    switch (primaryUnit) {
      case 'min':
        totalMinutes = parseInt(primaryAmount);
        break;

      case 'h':
        // Convert hours to minutes
        totalMinutes = parseFloat(primaryAmount) * 60;

        // Add extra minutes if present (e.g., 3h30min)
        if (extraMinutes) {
          totalMinutes += parseInt(extraMinutes);
        }
        break;

      case 'd':
        // Days are handled differently in Todoist API
        return {
          amount: parseInt(primaryAmount),
          unit: 'day'
        };
    }

    // Ensure we have a valid minute amount
    if (totalMinutes <= 0) {
      return null;
    }

    return {
      amount: Math.round(totalMinutes),
      unit: 'minute'
    };
  }

  /**
   * Format duration for Obsidian markdown display
   *
   * @param duration - Duration object to format
   * @returns Formatted duration string with ⏱️ icon
   *
   * @example
   * ```typescript
   * DurationParser.formatDuration({ amount: 30, unit: 'minute' })
   * // Returns: '⏱️ 30min'
   *
   * DurationParser.formatDuration({ amount: 120, unit: 'minute' })
   * // Returns: '⏱️ 2h'
   *
   * DurationParser.formatDuration({ amount: 150, unit: 'minute' })
   * // Returns: '⏱️ 2h30min'
   * ```
   */
  static formatDuration(duration: Duration): string {
    if (duration.unit === 'day') {
      return `⏱️ ${duration.amount}d`;
    }

    // Convert minutes to human-friendly format
    if (duration.amount >= 60) {
      const hours = Math.floor(duration.amount / 60);
      const minutes = duration.amount % 60;

      if (minutes > 0) {
        return `⏱️ ${hours}h${minutes}min`;
      } else {
        return `⏱️ ${hours}h`;
      }
    }

    return `⏱️ ${duration.amount}min`;
  }

  /**
   * Remove duration syntax from markdown line
   *
   * @param markdownLine - The markdown line to clean
   * @returns Markdown line with duration syntax removed
   *
   * @example
   * ```typescript
   * DurationParser.removeDuration('- [ ] Task ⏱️ 30min 🟡')
   * // Returns: '- [ ] Task 🟡'
   * ```
   */
  static removeDuration(markdownLine: string): string {
    return markdownLine.replace(/⏱️\s*\d+(?:\.\d+)?(?:min|h|d)(?:\d+min)?\s*/g, '').trim();
  }

  /**
   * Check if two durations are equal
   *
   * @param d1 - First duration (can be null)
   * @param d2 - Second duration (can be null)
   * @returns True if durations are equal, false otherwise
   */
  static durationsEqual(d1: Duration | null, d2: Duration | null): boolean {
    // Both null
    if (!d1 && !d2) return true;

    // One null, one not
    if (!d1 || !d2) return false;

    // Both present - compare values
    return d1.amount === d2.amount && d1.unit === d2.unit;
  }

  /**
   * Validate duration format and constraints
   *
   * @param duration - Duration to validate
   * @returns True if valid, false otherwise
   */
  static isValidDuration(duration: Duration | null): boolean {
    if (!duration) return true; // null is valid (no duration)

    // Check valid units
    if (!['minute', 'day'].includes(duration.unit)) {
      return false;
    }

    // Check positive amounts
    if (duration.amount <= 0) {
      return false;
    }

    // Check reasonable limits
    if (duration.unit === 'minute' && duration.amount > 1440) { // 24 hours
      return false;
    }

    if (duration.unit === 'day' && duration.amount > 365) { // 1 year
      return false;
    }

    return true;
  }

  /**
   * Convert duration to minutes for comparison and calculations
   *
   * @param duration - Duration to convert
   * @returns Total minutes, or null if duration is null
   */
  static toMinutes(duration: Duration | null): number | null {
    if (!duration) return null;

    if (duration.unit === 'minute') {
      return duration.amount;
    }

    if (duration.unit === 'day') {
      return duration.amount * 24 * 60; // days to minutes
    }

    return null;
  }

  /**
   * Get all duration patterns for regex matching
   * Used for comprehensive duration detection
   */
  static getDurationPatterns(): RegExp[] {
    return [
      /⏱️\s*\d+min/g,           // ⏱️ 30min
      /⏱️\s*\d+h/g,             // ⏱️ 2h
      /⏱️\s*\d+d/g,             // ⏱️ 1d
      /⏱️\s*\d+h\d+min/g,       // ⏱️ 3h30min
      /⏱️\s*\d+\.\d+h/g         // ⏱️ 2.5h
    ];
  }
}

/**
 * ADHD-Specific Duration Utilities
 *
 * Additional utilities for ADHD users to work with time estimates
 */
export class ADHDDurationUtils {
  /**
   * Suggest realistic duration based on task content
   * Helps ADHD users with time estimation challenges
   */
  static suggestDuration(taskContent: string): Duration | null {
    const content = taskContent.toLowerCase();

    // Quick tasks (5-15 minutes)
    const quickKeywords = ['email', 'call', 'text', 'quick', 'check', 'review'];
    if (quickKeywords.some(keyword => content.includes(keyword))) {
      return { amount: 15, unit: 'minute' };
    }

    // Medium tasks (30-60 minutes)
    const mediumKeywords = ['write', 'plan', 'research', 'meeting', 'organize'];
    if (mediumKeywords.some(keyword => content.includes(keyword))) {
      return { amount: 45, unit: 'minute' };
    }

    // Long tasks (2+ hours)
    const longKeywords = ['project', 'deep', 'focus', 'create', 'develop'];
    if (longKeywords.some(keyword => content.includes(keyword))) {
      return { amount: 120, unit: 'minute' };
    }

    // Default suggestion for unknown tasks
    return { amount: 30, unit: 'minute' };
  }

  /**
   * Check if duration is suitable for hyperfocus session
   * ADHD users often have optimal focus periods
   */
  static isHyperfocusFriendly(duration: Duration | null): boolean {
    if (!duration) return false;

    const minutes = DurationParser.toMinutes(duration);
    if (!minutes) return false;

    // Optimal hyperfocus range: 25-90 minutes
    return minutes >= 25 && minutes <= 90;
  }

  /**
   * Get time awareness level for ADHD users
   * Helps with time blindness by categorizing time commitments
   */
  static getTimeAwarenessLevel(duration: Duration | null): 'quick' | 'focused' | 'deep' | 'project' {
    if (!duration) return 'quick';

    const minutes = DurationParser.toMinutes(duration);
    if (!minutes) return 'quick';

    if (minutes <= 15) return 'quick';      // Quick tasks
    if (minutes <= 60) return 'focused';    // Focused work
    if (minutes <= 180) return 'deep';      // Deep work sessions
    return 'project';                       // Project-level work
  }
}
