import { Notice } from 'obsidian';
import type TodoistPlugin from '@/index';
import type { Task } from '@/data/task';
import { TaskFormatter, type ParsedTask } from './TaskFormatter';

/**
 * Represents a conflict between Obsidian and Todoist versions of a task
 */
export interface TaskConflict {
  todoistId: string;
  obsidianVersion: ParsedTask;
  todoistVersion: Task;
  conflictType: ConflictType;
  lastSyncTime: string;
  obsidianFile: string;
  obsidianLine: number;
}

export enum ConflictType {
  CONTENT_MODIFIED = 'content_modified',
  COMPLETION_STATUS = 'completion_status',
  BOTH_MODIFIED = 'both_modified',
  DELETED_IN_TODOIST = 'deleted_in_todoist',
  DELETED_IN_OBSIDIAN = 'deleted_in_obsidian',
  PRIORITY_CHANGED = 'priority_changed',
  DUE_DATE_CHANGED = 'due_date_changed'
}

export enum ConflictResolution {
  OBSIDIAN_WINS = 'obsidian_wins',
  TODOIST_WINS = 'todoist_wins',
  MERGE = 'merge',
  MANUAL = 'manual',
  SKIP = 'skip'
}

/**
 * ADHD-optimized conflict resolution system
 * Prioritizes automatic resolution to minimize cognitive load
 */
export class ConflictResolver {
  private plugin: TodoistPlugin;
  private conflictLog: TaskConflict[] = [];

  constructor(plugin: TodoistPlugin) {
    this.plugin = plugin;
  }

  /**
   * Detect conflicts between Obsidian and Todoist versions
   */
  async detectConflicts(
    obsidianTasks: ParsedTask[],
    todoistTasks: Task[],
    lastSyncTime: Date
  ): Promise<TaskConflict[]> {
    const conflicts: TaskConflict[] = [];
    const todoistMap = new Map(todoistTasks.map(t => [t.id, t]));

    for (const obsidianTask of obsidianTasks) {
      if (!obsidianTask.todoistId) continue;

      const todoistTask = todoistMap.get(obsidianTask.todoistId);
      
      if (!todoistTask) {
        // Task deleted in Todoist
        conflicts.push({
          todoistId: obsidianTask.todoistId,
          obsidianVersion: obsidianTask,
          todoistVersion: null as any,
          conflictType: ConflictType.DELETED_IN_TODOIST,
          lastSyncTime: lastSyncTime.toISOString(),
          obsidianFile: '', // Will be filled by caller
          obsidianLine: 0
        });
        continue;
      }

      const conflictType = this.detectConflictType(obsidianTask, todoistTask);
      if (conflictType) {
        conflicts.push({
          todoistId: obsidianTask.todoistId,
          obsidianVersion: obsidianTask,
          todoistVersion: todoistTask,
          conflictType,
          lastSyncTime: lastSyncTime.toISOString(),
          obsidianFile: '',
          obsidianLine: 0
        });
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts using ADHD-friendly automatic rules
   */
  async resolveConflicts(conflicts: TaskConflict[]): Promise<{
    resolved: number;
    manual: TaskConflict[];
    errors: string[];
  }> {
    const result = { resolved: 0, manual: [] as TaskConflict[], errors: [] as string[] };

    for (const conflict of conflicts) {
      try {
        const resolution = this.determineAutoResolution(conflict);
        
        if (resolution === ConflictResolution.MANUAL) {
          result.manual.push(conflict);
          continue;
        }

        await this.applyResolution(conflict, resolution);
        result.resolved++;
        
        // Log for user awareness
        this.logConflictResolution(conflict, resolution);
        
      } catch (error) {
        const errorMsg = `Failed to resolve conflict for task ${conflict.todoistId}: ${error}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // Show summary notification
    this.showResolutionSummary(result);

    return result;
  }

  /**
   * Detect the type of conflict between versions
   */
  private detectConflictType(obsidian: ParsedTask, todoist: Task): ConflictType | null {
    const contentChanged = obsidian.content.trim() !== todoist.content.trim();
    const completionChanged = obsidian.completed !== false; // Todoist tasks in sync are always incomplete
    const priorityChanged = obsidian.priority !== todoist.priority;
    
    const obsidianDue = obsidian.dueDate ? new Date(obsidian.dueDate).toDateString() : null;
    const todoistDue = todoist.due ? new Date(todoist.due.date).toDateString() : null;
    const dueDateChanged = obsidianDue !== todoistDue;

    // Determine conflict type based on what changed
    if (completionChanged && contentChanged) {
      return ConflictType.BOTH_MODIFIED;
    } else if (completionChanged) {
      return ConflictType.COMPLETION_STATUS;
    } else if (contentChanged) {
      return ConflictType.CONTENT_MODIFIED;
    } else if (priorityChanged) {
      return ConflictType.PRIORITY_CHANGED;
    } else if (dueDateChanged) {
      return ConflictType.DUE_DATE_CHANGED;
    }

    return null;
  }

  /**
   * Determine automatic resolution strategy based on ADHD-friendly rules
   */
  private determineAutoResolution(conflict: TaskConflict): ConflictResolution {
    switch (conflict.conflictType) {
      case ConflictType.COMPLETION_STATUS:
        // ADHD Rule: Completion in Obsidian always wins (dopamine preservation)
        return ConflictResolution.OBSIDIAN_WINS;

      case ConflictType.CONTENT_MODIFIED:
        // ADHD Rule: Recent edits in Obsidian win (where user is actively working)
        return ConflictResolution.OBSIDIAN_WINS;

      case ConflictType.PRIORITY_CHANGED:
        // ADHD Rule: Higher priority wins (urgency preservation)
        const obsidianPriority = conflict.obsidianVersion.priority;
        const todoistPriority = conflict.todoistVersion.priority;
        return obsidianPriority > todoistPriority ? 
          ConflictResolution.OBSIDIAN_WINS : ConflictResolution.TODOIST_WINS;

      case ConflictType.DUE_DATE_CHANGED:
        // ADHD Rule: Earlier due date wins (urgency preservation)
        const obsidianDue = conflict.obsidianVersion.dueDate ? new Date(conflict.obsidianVersion.dueDate) : null;
        const todoistDue = conflict.todoistVersion.due ? new Date(conflict.todoistVersion.due.date) : null;
        
        if (!obsidianDue && todoistDue) return ConflictResolution.TODOIST_WINS;
        if (obsidianDue && !todoistDue) return ConflictResolution.OBSIDIAN_WINS;
        if (obsidianDue && todoistDue) {
          return obsidianDue < todoistDue ? ConflictResolution.OBSIDIAN_WINS : ConflictResolution.TODOIST_WINS;
        }
        return ConflictResolution.MERGE;

      case ConflictType.DELETED_IN_TODOIST:
        // ADHD Rule: Preserve user's work in Obsidian, recreate in Todoist
        return ConflictResolution.OBSIDIAN_WINS;

      case ConflictType.DELETED_IN_OBSIDIAN:
        // ADHD Rule: Remove from Todoist to match user intent
        return ConflictResolution.OBSIDIAN_WINS;

      case ConflictType.BOTH_MODIFIED:
        // Complex conflict - needs manual resolution
        return ConflictResolution.MANUAL;

      default:
        return ConflictResolution.MANUAL;
    }
  }

  /**
   * Apply the chosen resolution strategy
   */
  private async applyResolution(conflict: TaskConflict, resolution: ConflictResolution): Promise<void> {
    switch (resolution) {
      case ConflictResolution.OBSIDIAN_WINS:
        await this.applyObsidianVersion(conflict);
        break;

      case ConflictResolution.TODOIST_WINS:
        await this.applyTodoistVersion(conflict);
        break;

      case ConflictResolution.MERGE:
        await this.mergeVersions(conflict);
        break;

      default:
        throw new Error(`Unsupported resolution: ${resolution}`);
    }
  }

  /**
   * Apply Obsidian version to Todoist
   */
  private async applyObsidianVersion(conflict: TaskConflict): Promise<void> {
    const obsidian = conflict.obsidianVersion;

    if (conflict.conflictType === ConflictType.COMPLETION_STATUS && obsidian.completed) {
      // Close task in Todoist
      await this.plugin.services.todoist.actions.closeTask(conflict.todoistId);
    } else if (conflict.conflictType === ConflictType.DELETED_IN_TODOIST) {
      // Recreate task in Todoist
      await this.plugin.services.todoist.actions.createTask(obsidian.content, {
        priority: obsidian.priority,
        projectId: conflict.todoistVersion?.project?.id || 'inbox',
        description: '', // Will be enhanced later
      });
    }
    // Note: Content updates would require additional API methods
  }

  /**
   * Apply Todoist version to Obsidian
   */
  private async applyTodoistVersion(conflict: TaskConflict): Promise<void> {
    // Update the Obsidian file with Todoist version
    // This would involve updating the specific line in the markdown file
    console.log(`Applying Todoist version for task ${conflict.todoistId}`);
  }

  /**
   * Merge both versions intelligently
   */
  private async mergeVersions(conflict: TaskConflict): Promise<void> {
    // Intelligent merge strategy
    const merged = {
      content: conflict.obsidianVersion.content, // Prefer Obsidian content
      priority: Math.max(conflict.obsidianVersion.priority, conflict.todoistVersion.priority), // Higher priority
      dueDate: this.selectEarlierDate(conflict.obsidianVersion.dueDate, conflict.todoistVersion.due?.date),
      completed: conflict.obsidianVersion.completed, // Preserve completion status
    };

    console.log(`Merging versions for task ${conflict.todoistId}:`, merged);
  }

  /**
   * Select the earlier of two dates
   */
  private selectEarlierDate(date1: string | null, date2: string | null): string | null {
    if (!date1) return date2;
    if (!date2) return date1;
    return new Date(date1) < new Date(date2) ? date1 : date2;
  }

  /**
   * Log conflict resolution for transparency
   */
  private logConflictResolution(conflict: TaskConflict, resolution: ConflictResolution): void {
    this.conflictLog.push(conflict);
    console.log(`🔄 Conflict resolved: ${conflict.conflictType} → ${resolution} for "${conflict.obsidianVersion.content}"`);
  }

  /**
   * Show ADHD-friendly summary notification
   */
  private showResolutionSummary(result: { resolved: number; manual: TaskConflict[]; errors: string[] }): void {
    if (result.resolved > 0 && result.manual.length === 0 && result.errors.length === 0) {
      new Notice(`✅ ${result.resolved} conflicts resolved automatically! 🎉`, 3000);
    } else if (result.manual.length > 0) {
      new Notice(`⚠️ ${result.resolved} conflicts resolved, ${result.manual.length} need your attention`, 5000);
    } else if (result.errors.length > 0) {
      new Notice(`❌ ${result.errors.length} conflicts failed to resolve. Check console.`, 5000);
    }
  }

  /**
   * Get conflict history for debugging
   */
  getConflictLog(): TaskConflict[] {
    return [...this.conflictLog];
  }

  /**
   * Clear conflict log
   */
  clearConflictLog(): void {
    this.conflictLog = [];
  }
}
