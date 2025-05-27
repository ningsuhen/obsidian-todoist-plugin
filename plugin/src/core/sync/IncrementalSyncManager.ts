import type TodoistPlugin from '@/index';
import type { Task } from '@/data/task';
import { TaskFormatter } from './TaskFormatter';

/**
 * Manages incremental sync by tracking task changes through hashes
 * Only syncs tasks that have actually changed since last sync
 */
export class IncrementalSyncManager {
  private plugin: TodoistPlugin;

  constructor(plugin: TodoistPlugin) {
    this.plugin = plugin;
  }

  /**
   * Identify tasks that have changed since last sync (Todoist → Obsidian)
   */
  async identifyChangedTasks(
    todoistTasks: Task[],
    markdownFiles: string[]
  ): Promise<{
    newTasks: Task[];
    changedTasks: Task[];
    unchangedTasks: Task[];
    deletedTasks: string[];
  }> {
    const result = {
      newTasks: [] as Task[],
      changedTasks: [] as Task[],
      unchangedTasks: [] as Task[],
      deletedTasks: [] as string[]
    };

    // Get existing task hashes from Obsidian files
    const existingTaskHashes = await this.extractExistingTaskHashes(markdownFiles);

    // Categorize Todoist tasks
    for (const todoistTask of todoistTasks) {
      const existingHash = existingTaskHashes.get(todoistTask.id);

      if (!existingHash) {
        // Task doesn't exist in Obsidian - it's new
        result.newTasks.push(todoistTask);
      } else {
        // Task exists - check if it changed
        if (TaskFormatter.hasTaskChanged(todoistTask, existingHash)) {
          result.changedTasks.push(todoistTask);
        } else {
          result.unchangedTasks.push(todoistTask);
        }
      }
    }

    // Find deleted tasks (exist in Obsidian but not in Todoist)
    const todoistTaskIds = new Set(todoistTasks.map(t => t.id));
    for (const [taskId] of existingTaskHashes) {
      if (!todoistTaskIds.has(taskId)) {
        result.deletedTasks.push(taskId);
      }
    }

    return result;
  }

  /**
   * Extract existing task hashes from markdown files
   */
  private async extractExistingTaskHashes(markdownFiles: string[]): Promise<Map<string, string>> {
    const taskHashes = new Map<string, string>();

    for (const filePath of markdownFiles) {
      try {
        const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
        if (!file) continue;

        const content = await this.plugin.app.vault.read(file as any);
        const lines = content.split('\n');

        for (const line of lines) {
          const metadata = TaskFormatter.extractTodoistMetadata(line);
          if (metadata) {
            taskHashes.set(metadata.id, metadata.hash);
          }
        }
      } catch (error) {
        console.warn(`Failed to extract hashes from ${filePath}:`, error);
      }
    }

    return taskHashes;
  }

  /**
   * Update task hash in markdown line
   */
  static updateTaskHash(markdownLine: string, newTask: Task): string {
    const newHash = TaskFormatter.calculateTaskHash(newTask);

    // Replace existing hash or add new one
    const hasMetadata = markdownLine.includes('<!-- todoist:');

    if (hasMetadata) {
      // Update existing metadata
      return markdownLine.replace(
        /<!-- todoist:([^:>]+)(?::[^>]+)? -->/,
        `<!-- todoist:${newTask.id}:${newHash} -->`
      );
    } else {
      // Add new metadata
      const taskPart = markdownLine.match(/^- \[[x ]\] .+?(?=\s*$)/)?.[0] || markdownLine.trim();
      return `${taskPart} <!-- todoist:${newTask.id}:${newHash} -->`;
    }
  }

  /**
   * Generate incremental sync report
   */
  generateSyncReport(changes: {
    newTasks: Task[];
    changedTasks: Task[];
    unchangedTasks: Task[];
    deletedTasks: string[];
  }): string {
    const total = changes.newTasks.length + changes.changedTasks.length +
                  changes.unchangedTasks.length + changes.deletedTasks.length;

    let report = `📊 Incremental Sync Analysis\n`;
    report += `═══════════════════════════\n\n`;

    report += `📈 Total Tasks: ${total}\n`;
    report += `🆕 New Tasks: ${changes.newTasks.length}\n`;
    report += `🔄 Changed Tasks: ${changes.changedTasks.length}\n`;
    report += `✅ Unchanged Tasks: ${changes.unchangedTasks.length}\n`;
    report += `🗑️ Deleted Tasks: ${changes.deletedTasks.length}\n\n`;

    if (changes.newTasks.length > 0) {
      report += `🆕 New Tasks:\n`;
      changes.newTasks.slice(0, 5).forEach(task => {
        report += `   • ${task.content.substring(0, 50)}${task.content.length > 50 ? '...' : ''}\n`;
      });
      if (changes.newTasks.length > 5) {
        report += `   ... and ${changes.newTasks.length - 5} more\n`;
      }
      report += '\n';
    }

    if (changes.changedTasks.length > 0) {
      report += `🔄 Changed Tasks:\n`;
      changes.changedTasks.slice(0, 5).forEach(task => {
        report += `   • ${task.content.substring(0, 50)}${task.content.length > 50 ? '...' : ''}\n`;
      });
      if (changes.changedTasks.length > 5) {
        report += `   ... and ${changes.changedTasks.length - 5} more\n`;
      }
      report += '\n';
    }

    if (changes.deletedTasks.length > 0) {
      report += `🗑️ Deleted Tasks:\n`;
      changes.deletedTasks.slice(0, 5).forEach(taskId => {
        report += `   • Task ID: ${taskId}\n`;
      });
      if (changes.deletedTasks.length > 5) {
        report += `   ... and ${changes.deletedTasks.length - 5} more\n`;
      }
      report += '\n';
    }

    const efficiency = total > 0 ?
      Math.round(((changes.unchangedTasks.length / total) * 100)) : 0;

    report += `⚡ Sync Efficiency: ${efficiency}% (${changes.unchangedTasks.length}/${total} tasks unchanged)\n`;

    if (efficiency > 80) {
      report += `🎉 Excellent! Most tasks are already in sync.\n`;
    } else if (efficiency > 50) {
      report += `👍 Good sync efficiency.\n`;
    } else {
      report += `🔄 Many changes detected - this might be the first sync.\n`;
    }

    return report;
  }

  /**
   * Check if incremental sync is beneficial
   */
  shouldUseIncrementalSync(changes: {
    newTasks: Task[];
    changedTasks: Task[];
    unchangedTasks: Task[];
    deletedTasks: string[];
  }): boolean {
    const totalTasks = changes.newTasks.length + changes.changedTasks.length + changes.unchangedTasks.length;
    const changedTasks = changes.newTasks.length + changes.changedTasks.length + changes.deletedTasks.length;

    // Use incremental sync if less than 30% of tasks changed
    return totalTasks > 10 && (changedTasks / totalTasks) < 0.3;
  }

  /**
   * Get tasks that need to be synced (new + changed)
   */
  getTasksToSync(changes: {
    newTasks: Task[];
    changedTasks: Task[];
    unchangedTasks: Task[];
    deletedTasks: string[];
  }): Task[] {
    return [...changes.newTasks, ...changes.changedTasks];
  }

  /**
   * Identify Obsidian tasks that have changed and need to sync back to Todoist
   */
  async identifyObsidianChanges(
    todoistTasks: Task[],
    markdownFiles: string[]
  ): Promise<{
    completedTasks: ObsidianTaskChange[];
    modifiedTasks: ObsidianTaskChange[];
    newTasks: ObsidianTaskChange[];
    unchangedTasks: string[];
  }> {
    const result = {
      completedTasks: [] as ObsidianTaskChange[],
      modifiedTasks: [] as ObsidianTaskChange[],
      newTasks: [] as ObsidianTaskChange[],
      unchangedTasks: [] as string[]
    };

    // Create a map of Todoist tasks for quick lookup
    const todoistMap = new Map(todoistTasks.map(t => [t.id, t]));

    // Analyze each markdown file
    for (const filePath of markdownFiles) {
      try {
        const obsidianTasks = await this.extractObsidianTasks(filePath);

        for (const obsidianTask of obsidianTasks) {
          if (!obsidianTask.todoistId) {
            // Task has no Todoist ID - it's new
            result.newTasks.push(obsidianTask);
            continue;
          }

          const todoistTask = todoistMap.get(obsidianTask.todoistId);
          if (!todoistTask) {
            // Task exists in Obsidian but not in Todoist - might be deleted
            continue;
          }

          // Check for completion
          if (obsidianTask.completed && !this.isTaskCompleted(todoistTask)) {
            result.completedTasks.push(obsidianTask);
            continue;
          }

          // Check for content changes by comparing with expected hash
          if (obsidianTask.storedHash) {
            const currentTodoistHash = TaskFormatter.calculateTaskHash(todoistTask);

            if (obsidianTask.storedHash !== currentTodoistHash) {
              // Hash mismatch - either Todoist changed or Obsidian changed
              // Need to determine which one changed by comparing content
              if (this.hasObsidianTaskChanged(obsidianTask, todoistTask)) {
                result.modifiedTasks.push(obsidianTask);
              } else {
                // Todoist changed, Obsidian didn't - mark as unchanged for this direction
                result.unchangedTasks.push(obsidianTask.todoistId);
              }
            } else {
              // Hashes match - no changes
              result.unchangedTasks.push(obsidianTask.todoistId);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to analyze Obsidian changes in ${filePath}:`, error);
      }
    }

    return result;
  }

  /**
   * Extract Obsidian tasks from a markdown file with their metadata
   */
  private async extractObsidianTasks(filePath: string): Promise<ObsidianTaskChange[]> {
    const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!file) return [];

    const content = await this.plugin.app.vault.read(file as any);
    const lines = content.split('\n');
    const tasks: ObsidianTaskChange[] = [];

    lines.forEach((line, lineNumber) => {
      const parsed = TaskFormatter.parseTaskLine(line);
      if (parsed) {
        const metadata = TaskFormatter.extractTodoistMetadata(line);

        tasks.push({
          todoistId: metadata?.id || null,
          storedHash: metadata?.hash || null,
          content: parsed.content,
          completed: parsed.completed,
          priority: parsed.priority,
          dueDate: parsed.dueDate,
          labels: parsed.labels,
          filePath,
          lineNumber,
          originalLine: line
        });
      }
    });

    return tasks;
  }

  /**
   * Check if an Obsidian task has been modified compared to its Todoist counterpart
   */
  private hasObsidianTaskChanged(obsidianTask: ObsidianTaskChange, todoistTask: Task): boolean {
    // Compare key fields to see if Obsidian version differs from Todoist

    // Content comparison (normalize whitespace and remove metadata)
    const obsidianContent = obsidianTask.content.trim();
    const todoistContent = todoistTask.content.trim();
    if (obsidianContent !== todoistContent) {
      return true;
    }

    // Priority comparison
    if (obsidianTask.priority !== todoistTask.priority) {
      return true;
    }

    // Due date comparison
    const obsidianDue = obsidianTask.dueDate ? new Date(obsidianTask.dueDate).toDateString() : null;
    const todoistDue = todoistTask.due ? new Date(todoistTask.due.date).toDateString() : null;
    if (obsidianDue !== todoistDue) {
      return true;
    }

    // Labels comparison
    const obsidianLabels = obsidianTask.labels.sort();
    const todoistLabels = todoistTask.labels.map(l => l.name).sort();
    if (JSON.stringify(obsidianLabels) !== JSON.stringify(todoistLabels)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a Todoist task is completed
   */
  private isTaskCompleted(task: Task): boolean {
    return (task as any).isCompleted || false;
  }

  /**
   * Log incremental sync statistics
   */
  logSyncStats(changes: {
    newTasks: Task[];
    changedTasks: Task[];
    unchangedTasks: Task[];
    deletedTasks: string[];
  }): void {
    const total = changes.newTasks.length + changes.changedTasks.length + changes.unchangedTasks.length;
    const efficiency = total > 0 ? Math.round(((changes.unchangedTasks.length / total) * 100)) : 0;

    console.log(`📊 Incremental Sync Stats:`);
    console.log(`   🆕 New: ${changes.newTasks.length}`);
    console.log(`   🔄 Changed: ${changes.changedTasks.length}`);
    console.log(`   ✅ Unchanged: ${changes.unchangedTasks.length}`);
    console.log(`   🗑️ Deleted: ${changes.deletedTasks.length}`);
    console.log(`   ⚡ Efficiency: ${efficiency}%`);

    if (this.shouldUseIncrementalSync(changes)) {
      console.log(`   🚀 Using incremental sync (${efficiency}% efficiency)`);
    } else {
      console.log(`   🔄 Using full sync (low efficiency or first sync)`);
    }
  }

  /**
   * Log Obsidian change statistics
   */
  logObsidianChangeStats(changes: {
    completedTasks: ObsidianTaskChange[];
    modifiedTasks: ObsidianTaskChange[];
    newTasks: ObsidianTaskChange[];
    unchangedTasks: string[];
  }): void {
    const total = changes.completedTasks.length + changes.modifiedTasks.length +
                  changes.newTasks.length + changes.unchangedTasks.length;
    const changedCount = changes.completedTasks.length + changes.modifiedTasks.length + changes.newTasks.length;
    const efficiency = total > 0 ? Math.round(((changes.unchangedTasks.length / total) * 100)) : 0;

    console.log(`📊 Obsidian → Todoist Change Stats:`);
    console.log(`   ✅ Completed: ${changes.completedTasks.length}`);
    console.log(`   🔄 Modified: ${changes.modifiedTasks.length}`);
    console.log(`   🆕 New: ${changes.newTasks.length}`);
    console.log(`   ⚪ Unchanged: ${changes.unchangedTasks.length}`);
    console.log(`   ⚡ Efficiency: ${efficiency}% (${changedCount}/${total} need sync)`);
  }
}

/**
 * Represents an Obsidian task with change tracking information
 */
export interface ObsidianTaskChange {
  todoistId: string | null;
  storedHash: string | null;
  content: string;
  completed: boolean;
  priority: number;
  dueDate: string | null;
  labels: string[];
  filePath: string;
  lineNumber: number;
  originalLine: string;
}
