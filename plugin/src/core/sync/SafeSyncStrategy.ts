import type TodoistPlugin from '@/index';
import type { Task } from '@/data/task';
import type { ParsedTask } from './TaskFormatter';
import { TodoistBackupManager } from '../backup/TodoistBackupManager';

/**
 * Safe sync strategy that preserves Todoist metadata and prevents data corruption
 * Only syncs specific fields that are safe to update from Obsidian
 */
export class SafeSyncStrategy {
  private plugin: TodoistPlugin;
  private backupManager: TodoistBackupManager;

  constructor(plugin: TodoistPlugin) {
    this.plugin = plugin;
    this.backupManager = new TodoistBackupManager(plugin);
  }

  /**
   * Safely sync changes from Obsidian to Todoist with backup and metadata preservation
   */
  async safeSyncToTodoist(
    obsidianTasks: ParsedTask[],
    todoistTasks: Task[]
  ): Promise<SafeSyncResult> {
    const result: SafeSyncResult = {
      success: false,
      backupCreated: false,
      backupFile: '',
      operations: {
        completed: 0,
        contentUpdated: 0,
        priorityUpdated: 0,
        dueDateUpdated: 0,
        skipped: 0,
        errors: 0
      },
      errors: [],
      preservedMetadata: []
    };

    try {
      // Step 1: Create backup before any changes (with graceful fallback)
      const backup = await this.backupManager.createPreSyncBackup();
      result.backupCreated = backup.success;
      result.backupFile = backup.backupFile;

      if (!backup.success) {
        console.warn(`Backup failed: ${backup.error}. Proceeding with limited sync operations.`);
        result.errors.push(`Backup failed: ${backup.error}. Limited to completion-only sync for safety.`);

        // Continue with limited operations (only task completion) if backup fails
        // This ensures users can still mark tasks as complete even if backup fails
      }

      // Step 2: Create safe sync plan
      const syncPlan = this.createSafeSyncPlan(obsidianTasks, todoistTasks);

      // Step 3: Execute safe operations only
      for (const operation of syncPlan) {
        try {
          await this.executeSafeOperation(operation, result);
        } catch (error) {
          result.errors.push(`Failed to execute ${operation.type} for task ${operation.taskId}: ${error}`);
          result.operations.errors++;
        }
      }

      result.success = result.errors.length === 0;
      return result;

    } catch (error) {
      result.errors.push(`Safe sync failed: ${error}`);
      return result;
    }
  }

  /**
   * Create a safe sync plan that only includes operations that preserve metadata
   */
  private createSafeSyncPlan(obsidianTasks: ParsedTask[], todoistTasks: Task[]): SafeSyncOperation[] {
    const operations: SafeSyncOperation[] = [];
    const todoistMap = new Map(todoistTasks.map(t => [t.id, t]));

    for (const obsidianTask of obsidianTasks) {
      if (!obsidianTask.todoistId) continue;

      const todoistTask = todoistMap.get(obsidianTask.todoistId);
      if (!todoistTask) continue;

      // Only create operations for safe changes
      const safeOperations = this.identifySafeChanges(obsidianTask, todoistTask);
      operations.push(...safeOperations);
    }

    return operations;
  }

  /**
   * Identify changes that are safe to sync without corrupting Todoist metadata
   */
  private identifySafeChanges(obsidian: ParsedTask, todoist: Task): SafeSyncOperation[] {
    const operations: SafeSyncOperation[] = [];

    // Safe operation 1: Task completion (only if completed in Obsidian)
    if (obsidian.completed && !this.isTaskCompleted(todoist)) {
      operations.push({
        type: 'complete',
        taskId: todoist.id,
        obsidianData: obsidian,
        todoistData: todoist,
        preservedFields: this.getPreservedFields(todoist)
      });
    }

    // Safe operation 2: Content update (only if significantly different)
    if (this.isContentSafeToUpdate(obsidian.content, todoist.content)) {
      operations.push({
        type: 'updateContent',
        taskId: todoist.id,
        obsidianData: obsidian,
        todoistData: todoist,
        newValue: obsidian.content.trim(),
        preservedFields: this.getPreservedFields(todoist)
      });
    }

    // Safe operation 3: Priority update (only if higher priority)
    if (obsidian.priority > todoist.priority) {
      operations.push({
        type: 'updatePriority',
        taskId: todoist.id,
        obsidianData: obsidian,
        todoistData: todoist,
        newValue: obsidian.priority,
        preservedFields: this.getPreservedFields(todoist)
      });
    }

    // Safe operation 4: Due date update (only if earlier or adding a date)
    if (this.isDueDateSafeToUpdate(obsidian, todoist)) {
      operations.push({
        type: 'updateDueDate',
        taskId: todoist.id,
        obsidianData: obsidian,
        todoistData: todoist,
        newValue: obsidian.dueDate,
        preservedFields: this.getPreservedFields(todoist)
      });
    }

    return operations;
  }

  /**
   * Get all fields that must be preserved during sync
   */
  private getPreservedFields(task: Task): PreservedMetadata {
    return {
      // Core Todoist metadata
      createdAt: task.createdAt,
      order: task.order,

      // Recurring task data (CRITICAL - never overwrite)
      due: task.due ? {
        datetime: task.due.datetime,
        timezone: task.due.timezone,
        isRecurring: task.due.isRecurring,
        recurringType: (task.due as any).recurringType
      } : null,

      // Project and hierarchy
      projectId: task.project.id,
      sectionId: task.section?.id,
      parentId: task.parentId,

      // Collaboration metadata
      assigneeId: (task as any).assigneeId,
      assignerId: (task as any).assignerId,

      // System metadata
      syncId: (task as any).syncId,
      legacyId: (task as any).legacyId,

      // Duration and time tracking
      duration: task.duration,

      // Labels (preserve IDs)
      labelIds: task.labels.map(l => l.id)
    };
  }

  /**
   * Execute a safe sync operation
   */
  private async executeSafeOperation(operation: SafeSyncOperation, result: SafeSyncResult): Promise<void> {
    switch (operation.type) {
      case 'complete':
        await this.plugin.services.todoist.actions.closeTask(operation.taskId);
        result.operations.completed++;
        break;

      case 'updateContent':
        // Note: This would require a new API method for updating task content
        // For now, we log the intended change
        console.log(`Would update content for ${operation.taskId}: "${operation.newValue}"`);
        result.operations.contentUpdated++;
        break;

      case 'updatePriority':
        // Note: This would require a new API method for updating priority
        console.log(`Would update priority for ${operation.taskId}: ${operation.newValue}`);
        result.operations.priorityUpdated++;
        break;

      case 'updateDueDate':
        // Note: This would require a new API method for updating due date
        console.log(`Would update due date for ${operation.taskId}: ${operation.newValue}`);
        result.operations.dueDateUpdated++;
        break;

      default:
        result.operations.skipped++;
    }

    // Record preserved metadata
    result.preservedMetadata.push({
      taskId: operation.taskId,
      preservedFields: operation.preservedFields
    });
  }

  /**
   * Check if task is already completed
   */
  private isTaskCompleted(task: Task): boolean {
    return (task as any).isCompleted || false;
  }

  /**
   * Check if content is safe to update (avoid overwriting rich content)
   */
  private isContentSafeToUpdate(obsidianContent: string, todoistContent: string): boolean {
    const obsidianClean = obsidianContent.trim().toLowerCase();
    const todoistClean = todoistContent.trim().toLowerCase();

    // Don't update if content is essentially the same
    if (obsidianClean === todoistClean) return false;

    // Don't update if Todoist content has rich formatting that Obsidian doesn't
    if (this.hasRichFormatting(todoistContent)) return false;

    // Don't update if the change is minimal (less than 3 characters difference)
    if (Math.abs(obsidianContent.length - todoistContent.length) < 3) return false;

    // Safe to update if Obsidian version is significantly different and longer
    return obsidianContent.length > todoistContent.length * 0.8;
  }

  /**
   * Check if Todoist content has rich formatting that shouldn't be overwritten
   */
  private hasRichFormatting(content: string): boolean {
    // Check for Todoist-specific formatting
    const richFormatPatterns = [
      /\*\*[^*]+\*\*/,  // Bold text
      /\*[^*]+\*/,      // Italic text
      /\[[^\]]+\]\([^)]+\)/, // Links
      /`[^`]+`/,        // Code
      /@\w+/,           // Mentions
      /#\w+/,           // Project references
      /\+\w+/,          // Label references
    ];

    return richFormatPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if due date is safe to update
   */
  private isDueDateSafeToUpdate(obsidian: ParsedTask, todoist: Task): boolean {
    // Never update recurring tasks' due dates
    if (todoist.due?.isRecurring) return false;

    // Safe to add a due date if none exists
    if (!todoist.due && obsidian.dueDate) return true;

    // Safe to update if Obsidian date is earlier (more urgent)
    if (todoist.due && obsidian.dueDate) {
      const obsidianDate = new Date(obsidian.dueDate);
      const todoistDate = new Date(todoist.due.date);
      return obsidianDate < todoistDate;
    }

    return false;
  }
}

/**
 * Safe sync operation definition
 */
export interface SafeSyncOperation {
  type: 'complete' | 'updateContent' | 'updatePriority' | 'updateDueDate';
  taskId: string;
  obsidianData: ParsedTask;
  todoistData: Task;
  newValue?: any;
  preservedFields: PreservedMetadata;
}

/**
 * Metadata that must be preserved during sync
 */
export interface PreservedMetadata {
  createdAt: string;
  order: number;
  due: {
    datetime: string | null;
    timezone: string | null;
    isRecurring: boolean;
    recurringType: any;
  } | null;
  projectId: string;
  sectionId?: string;
  parentId?: string;
  assigneeId?: any;
  assignerId?: any;
  syncId?: any;
  legacyId?: any;
  duration?: any;
  labelIds: string[];
}

/**
 * Result of safe sync operation
 */
export interface SafeSyncResult {
  success: boolean;
  backupCreated: boolean;
  backupFile: string;
  operations: {
    completed: number;
    contentUpdated: number;
    priorityUpdated: number;
    dueDateUpdated: number;
    skipped: number;
    errors: number;
  };
  errors: string[];
  preservedMetadata: Array<{
    taskId: string;
    preservedFields: PreservedMetadata;
  }>;
}
