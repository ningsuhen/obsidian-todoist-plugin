/**
 * RecurringTaskParser - Phase 1: Core Recurring Support
 *
 * Handles parsing and formatting of recurring task patterns in ADHD-friendly syntax.
 * Uses Todoist's native recurring patterns directly for seamless bidirectional sync.
 *
 * Phase 1 Features:
 * - Todoist native recurring patterns (every day, every saturday, etc.)
 * - ADHD-friendly visual indicators (🔄 icon)
 * - Direct bidirectional sync with Todoist
 * - No pattern conversion needed
 */

/**
 * Parsed recurring information from markdown
 */
export type RecurringInfo = {
  todoistPattern: string; // Todoist's native pattern like "every day", "every saturday"
  originalText: string; // The original text that was parsed
};

/**
 * Core recurring task parser for ADHD-friendly syntax
 */
export class RecurringTaskParser {

  /**
   * Regex patterns for parsing recurring syntax with Todoist patterns
   */
  private static readonly RECURRING_PATTERNS = {
    // 🔄 followed by any Todoist pattern: "🔄 every day", "🔄 every saturday", etc.
    withEmoji: /🔄\s+(.+?)(?=\s+(?:🔴|🟡|🔵|⚪|📅|#|⏱️)|$)/i,

    // Fallback: Todoist patterns without emoji (for compatibility)
    withoutEmoji: /\b(every\s+(?:\d+\s+)?(?:day|days|week|weeks|month|months|year|years|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend)(?:\s+at\s+\d{1,2}(?::\d{2})?(?:am|pm)?)?)\b/i
  };

  /**
   * Parse recurring pattern from markdown line
   *
   * Supported formats:
   * - "🔄 every day" -> Todoist pattern "every day"
   * - "🔄 every saturday" -> Todoist pattern "every saturday"
   * - "🔄 every 2 weeks" -> Todoist pattern "every 2 weeks"
   *
   * @param markdownLine The markdown task line to parse
   * @returns RecurringInfo if recurring pattern found, null otherwise
   */
  static parseRecurring(markdownLine: string): RecurringInfo | null {
    // Try emoji-based patterns first (preferred for ADHD visual clarity)
    let match = markdownLine.match(this.RECURRING_PATTERNS.withEmoji);
    if (match) {
      const todoistPattern = match[1].trim();
      return {
        todoistPattern,
        originalText: match[0]
      };
    }

    // Fallback to text-only patterns (for compatibility)
    match = markdownLine.match(this.RECURRING_PATTERNS.withoutEmoji);
    if (match) {
      const todoistPattern = match[1].trim();
      return {
        todoistPattern,
        originalText: match[0]
      };
    }

    return null;
  }

  /**
   * Format Todoist recurring pattern to ADHD-friendly markdown syntax
   *
   * @param todoistPattern Todoist pattern like "every day", "every saturday"
   * @returns Formatted markdown string with 🔄 emoji
   */
  static formatRecurring(todoistPattern: string): string {
    return `🔄 ${todoistPattern}`;
  }

  /**
   * Remove recurring syntax from markdown line
   *
   * @param markdownLine The line to clean
   * @returns Line with recurring syntax removed
   */
  static removeRecurring(markdownLine: string): string {
    let cleaned = markdownLine;

    // Remove recurring patterns
    cleaned = cleaned.replace(this.RECURRING_PATTERNS.withEmoji, '');
    cleaned = cleaned.replace(this.RECURRING_PATTERNS.withoutEmoji, '');

    // Clean up extra whitespace
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  /**
   * Check if a string contains a Todoist recurring pattern
   */
  static isRecurringPattern(dueString: string): boolean {
    if (!dueString) return false;

    const lowerDueString = dueString.toLowerCase();

    // Check for common recurring patterns
    return (
      lowerDueString.includes('every') ||
      lowerDueString.includes('daily') ||
      lowerDueString.includes('weekly') ||
      lowerDueString.includes('monthly') ||
      lowerDueString.includes('yearly')
    );
  }
}

/**
 * ADHD-specific utilities for recurring tasks (Phase 1 basic version)
 */
export class ADHDRecurringUtils {

  /**
   * Suggest Todoist recurring pattern based on task content
   * Phase 1: Basic keyword-based suggestions
   */
  static suggestRecurrence(taskContent: string): string | null {
    const content = taskContent.toLowerCase();

    // Check monthly keywords first (most specific)
    if (content.includes('monthly') || content.includes('budget') ||
        content.includes('bills') || content.includes('rent') ||
        content.includes('subscription')) {
      return 'every month';
    }

    // Daily routine keywords
    if (content.includes('medication') || content.includes('pills') ||
        content.includes('morning') || content.includes('evening') ||
        content.includes('daily') || content.includes('routine')) {
      return 'every day';
    }

    // Weekly routine keywords (check last to avoid conflicts)
    if (content.includes('weekly') || content.includes('review') ||
        content.includes('planning') || content.includes('grocery') ||
        content.includes('laundry') || content.includes('clean')) {
      return 'every week';
    }

    return null; // No suggestion
  }

  /**
   * Get user-friendly description of Todoist recurring pattern
   */
  static getPatternDescription(todoistPattern: string): string {
    // Just return the pattern as-is since Todoist patterns are already user-friendly
    return todoistPattern;
  }
}
