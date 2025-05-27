import type { Task } from '@/data/task';

/**
 * Handles formatting tasks as markdown with embedded metadata for mapping
 */
export class TaskFormatter {
  /**
   * Format a task as markdown checkbox with hidden metadata for mapping and change tracking
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

    // Add hidden metadata comment for mapping and change tracking (if enabled)
    if (includeMetadata) {
      const taskHash = this.calculateTaskHash(task);
      line += ` <!-- todoist:${task.id}:${taskHash} -->`;
    }

    // Add properly formatted description if present
    if (task.description && task.description.trim()) {
      line += '\n' + this.formatDescription(task.description);
    }

    line += '\n';
    return line;
  }

  /**
   * Calculate a hash of the task content for change detection
   */
  static calculateTaskHash(task: Task): string {
    const hashData = {
      content: task.content,
      description: task.description || '',
      priority: task.priority,
      due: task.due?.date || null,
      labels: task.labels.map(l => l.name).sort(),
      project: task.project.id,
      section: task.section?.id || null,
      order: task.order
    };

    // Create a simple hash from the JSON string
    const jsonString = JSON.stringify(hashData);
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Format task description with proper indentation and structure
   */
  static formatDescription(description: string): string {
    if (!description || !description.trim()) {
      return '';
    }

    const lines = description.split('\n');
    const formattedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) {
        // Empty line - add spacing but maintain indentation
        formattedLines.push('');
        continue;
      }

      // Check if this looks like a header/section (starts with emoji or special chars)
      if (this.isDescriptionHeader(line)) {
        // Headers get double indentation for visual separation
        formattedLines.push(`    **${line}**`);
      } else if (line.startsWith('Includes:') || line.startsWith('Note:') || line.startsWith('Details:')) {
        // Sub-descriptions get triple indentation
        formattedLines.push(`      *${line}*`);
      } else if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
        // List items get standard indentation
        formattedLines.push(`    ${line}`);
      } else {
        // Regular description text gets standard indentation
        formattedLines.push(`    ${line}`);
      }
    }

    return formattedLines.join('\n');
  }

  /**
   * Check if a line looks like a description header
   */
  static isDescriptionHeader(line: string): boolean {
    // Check for common header patterns
    const headerPatterns = [
      /^[🎵🧘👣🎯📚💡🔧⚡🌟🎨🏃‍♂️🎪🎭🎬🎮🎲🎸🎤🎧🎼🎹🥁🎺🎻]/u, // Starts with emoji
      /^[A-Z][A-Za-z\s&]+:?\s*$/,  // Title case text possibly ending with colon
      /^\d+\./,  // Numbered items
      /^[A-Z]{2,}/,  // ALL CAPS
    ];

    return headerPatterns.some(pattern => pattern.test(line.trim()));
  }

  /**
   * Format subtasks with proper hierarchical indentation
   */
  static formatSubtasks(subtasks: Task[], parentIndent: string = ''): string {
    if (!subtasks || subtasks.length === 0) {
      return '';
    }

    let result = '';
    const indent = parentIndent + '  '; // Add 2 spaces for each level

    for (const subtask of subtasks) {
      // Format subtask with increased indentation
      result += `${indent}- [ ] ${subtask.content}`;

      // Add priority for subtasks
      if (subtask.priority > 1) {
        result += ` ${this.getPriorityEmoji(subtask.priority)}`;
      }

      // Add due date for subtasks
      if (subtask.due) {
        const dueDate = new Date(subtask.due.date);
        const isOverdue = dueDate < new Date();
        const dateStr = dueDate.toLocaleDateString();

        if (isOverdue) {
          result += ` 🔴 **OVERDUE: ${dateStr}**`;
        } else {
          result += ` 📅 ${dateStr}`;
        }
      }

      // Add labels for subtasks
      if (subtask.labels.length > 0) {
        const labelStr = subtask.labels.map(l => `#${l.name}`).join(' ');
        result += ` ${labelStr}`;
      }

      result += ` <!-- todoist:${subtask.id} -->\n`;

      // Add subtask description with deeper indentation
      if (subtask.description && subtask.description.trim()) {
        const descriptionLines = subtask.description.split('\n');
        for (const descLine of descriptionLines) {
          if (descLine.trim()) {
            result += `${indent}    ${descLine.trim()}\n`;
          }
        }
      }
    }

    return result;
  }

  /**
   * Parse a markdown task line to extract Todoist ID from hidden metadata
   */
  static extractTodoistId(markdownLine: string): string | null {
    const match = markdownLine.match(/<!-- todoist:([^:>]+)(?::[^>]+)? -->/);
    return match ? match[1] : null;
  }

  /**
   * Parse a markdown task line to extract Todoist ID and hash from hidden metadata
   */
  static extractTodoistMetadata(markdownLine: string): { id: string; hash: string } | null {
    const match = markdownLine.match(/<!-- todoist:([^:>]+):([^>]+) -->/);
    return match ? { id: match[1], hash: match[2] } : null;
  }

  /**
   * Check if a task has changed by comparing hashes
   */
  static hasTaskChanged(todoistTask: Task, obsidianHash: string): boolean {
    const currentHash = this.calculateTaskHash(todoistTask);
    return currentHash !== obsidianHash;
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
