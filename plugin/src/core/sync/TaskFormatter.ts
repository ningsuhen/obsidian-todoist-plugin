import type { Task } from '@/data/task';

/**
 * Handles formatting tasks as markdown with embedded metadata for mapping
 */
export class TaskFormatter {
  /**
   * Format a task as markdown checkbox with hidden metadata for mapping
   */
  static formatTaskAsMarkdown(task: Task, includeMetadata: boolean = true): string {
    let line = `- [ ] ${task.content}`;

    // Add priority indicator
    if (task.priority > 1) {
      line += ` ${this.getPriorityEmoji(task.priority)}`;
    }

    // Add due date if present
    if (task.due) {
      const dueDate = new Date(task.due.date);
      const isOverdue = dueDate < new Date();
      const dateStr = dueDate.toLocaleDateString();

      if (isOverdue) {
        line += ` 🔴 **OVERDUE: ${dateStr}**`;
      } else {
        line += ` 📅 ${dateStr}`;
      }
    }

    // Add labels
    if (task.labels.length > 0) {
      const labelStr = task.labels.map(l => `#${l.name}`).join(' ');
      line += ` ${labelStr}`;
    }

    // Add hidden metadata comment for mapping (if enabled)
    if (includeMetadata) {
      line += ` <!-- todoist:${task.id} -->`;
    }

    // Add description if present
    if (task.description) {
      line += `\n  > ${task.description}`;
    }

    line += '\n';
    return line;
  }

  /**
   * Parse a markdown task line to extract Todoist ID from hidden metadata
   */
  static extractTodoistId(markdownLine: string): string | null {
    const match = markdownLine.match(/<!-- todoist:([^>]+) -->/);
    return match ? match[1] : null;
  }

  /**
   * Parse a markdown task line to extract task content
   */
  static extractTaskContent(markdownLine: string): string | null {
    const match = markdownLine.match(/^- \[([ x])\] (.+?)(?:\s+🔴|📅|#|\s*<!--)/);
    return match ? match[2].trim() : null;
  }

  /**
   * Check if a markdown line represents a task checkbox
   */
  static isTaskLine(line: string): boolean {
    return /^- \[([ x])\]/.test(line.trim());
  }

  /**
   * Check if a task is completed based on markdown
   */
  static isTaskCompleted(markdownLine: string): boolean {
    return markdownLine.includes('- [x]');
  }

  /**
   * Update a task line to mark it as completed or incomplete
   */
  static updateTaskCompletion(markdownLine: string, completed: boolean): string {
    const checkbox = completed ? '[x]' : '[ ]';
    return markdownLine.replace(/^- \[([ x])\]/, `- ${checkbox}`);
  }

  /**
   * Remove Todoist metadata from a task line (for clean display)
   */
  static removeMetadata(markdownLine: string): string {
    return markdownLine.replace(/\s*<!-- todoist:[^>]+ -->/, '');
  }

  /**
   * Extract all task information from a markdown line
   */
  static parseTaskLine(markdownLine: string): ParsedTask | null {
    if (!this.isTaskLine(markdownLine)) {
      return null;
    }

    const todoistId = this.extractTodoistId(markdownLine);
    const content = this.extractTaskContent(markdownLine);
    const completed = this.isTaskCompleted(markdownLine);

    if (!content) {
      return null;
    }

    // Extract due date
    const dueDateMatch = markdownLine.match(/📅 (\d{1,2}\/\d{1,2}\/\d{4})/);
    const dueDate = dueDateMatch ? dueDateMatch[1] : null;

    // Extract overdue date
    const overdueDateMatch = markdownLine.match(/🔴 \*\*OVERDUE: (\d{1,2}\/\d{1,2}\/\d{4})\*\*/);
    const overdueDate = overdueDateMatch ? overdueDateMatch[1] : null;

    // Extract priority
    let priority = 1;
    if (markdownLine.includes('🔴')) priority = 4; // P1
    else if (markdownLine.includes('🟡')) priority = 3; // P2
    else if (markdownLine.includes('🔵')) priority = 2; // P3

    // Extract labels
    const labelMatches = markdownLine.match(/#(\w+)/g);
    const labels = labelMatches ? labelMatches.map(l => l.substring(1)) : [];

    return {
      todoistId,
      content,
      completed,
      dueDate: overdueDate || dueDate,
      isOverdue: !!overdueDate,
      priority,
      labels,
    };
  }

  /**
   * Generate a task line with updated content while preserving metadata
   */
  static updateTaskContent(
    originalLine: string,
    newContent: string,
    preserveMetadata: boolean = true
  ): string {
    if (!this.isTaskLine(originalLine)) {
      return originalLine;
    }

    const todoistId = preserveMetadata ? this.extractTodoistId(originalLine) : null;
    const completed = this.isTaskCompleted(originalLine);
    
    // Extract existing metadata (priority, due date, labels)
    const dueDateMatch = originalLine.match(/(📅 \d{1,2}\/\d{1,2}\/\d{4})/);
    const overdueMatch = originalLine.match(/(🔴 \*\*OVERDUE: \d{1,2}\/\d{1,2}\/\d{4}\*\*)/);
    const priorityMatch = originalLine.match(/(🔴|🟡|🔵)/);
    const labelsMatch = originalLine.match(/(#\w+(?:\s+#\w+)*)/);

    // Build new line
    const checkbox = completed ? '[x]' : '[ ]';
    let newLine = `- ${checkbox} ${newContent}`;

    // Add back existing metadata
    if (priorityMatch && !overdueMatch) {
      newLine += ` ${priorityMatch[1]}`;
    }

    if (overdueMatch) {
      newLine += ` ${overdueMatch[1]}`;
    } else if (dueDateMatch) {
      newLine += ` ${dueDateMatch[1]}`;
    }

    if (labelsMatch) {
      newLine += ` ${labelsMatch[1]}`;
    }

    // Add back Todoist ID if preserving metadata
    if (todoistId && preserveMetadata) {
      newLine += ` <!-- todoist:${todoistId} -->`;
    }

    return newLine;
  }

  /**
   * Get priority emoji for a given priority level
   */
  private static getPriorityEmoji(priority: number): string {
    switch (priority) {
      case 4: return '🔴'; // P1 - Urgent
      case 3: return '🟡'; // P2 - High
      case 2: return '🔵'; // P3 - Medium
      default: return '⚪'; // P4 - Low
    }
  }

  /**
   * Get priority name for a given priority level
   */
  static getPriorityName(priority: number): string {
    switch (priority) {
      case 4: return 'Urgent (P1)';
      case 3: return 'High Priority (P2)';
      case 2: return 'Medium Priority (P3)';
      default: return 'Low Priority (P4)';
    }
  }
}

/**
 * Represents a parsed task from markdown
 */
export interface ParsedTask {
  todoistId: string | null;
  content: string;
  completed: boolean;
  dueDate: string | null;
  isOverdue: boolean;
  priority: number;
  labels: string[];
}

/**
 * Utility functions for working with task collections
 */
export class TaskCollectionUtils {
  /**
   * Find tasks that have been modified in Obsidian
   */
  static findModifiedTasks(
    markdownContent: string,
    originalTasks: Task[]
  ): { line: number; parsed: ParsedTask; original: Task | null }[] {
    const lines = markdownContent.split('\n');
    const modifications: { line: number; parsed: ParsedTask; original: Task | null }[] = [];

    lines.forEach((line, index) => {
      const parsed = TaskFormatter.parseTaskLine(line);
      if (!parsed || !parsed.todoistId) return;

      const original = originalTasks.find(t => t.id === parsed.todoistId);
      
      // Check if content has changed
      if (original && original.content !== parsed.content) {
        modifications.push({ line: index, parsed, original });
      }

      // Check if completion status has changed
      if (original && parsed.completed) {
        modifications.push({ line: index, parsed, original });
      }
    });

    return modifications;
  }

  /**
   * Find new tasks added in Obsidian (no Todoist ID)
   */
  static findNewTasks(markdownContent: string): { line: number; content: string }[] {
    const lines = markdownContent.split('\n');
    const newTasks: { line: number; content: string }[] = [];

    lines.forEach((line, index) => {
      const parsed = TaskFormatter.parseTaskLine(line);
      if (parsed && !parsed.todoistId) {
        newTasks.push({ line: index, content: parsed.content });
      }
    });

    return newTasks;
  }
}
