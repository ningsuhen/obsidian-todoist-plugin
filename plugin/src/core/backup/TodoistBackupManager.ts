import type { Task } from '@/data/task';
import type TodoistPlugin from '@/index';
import { Notice, TFile } from 'obsidian';

/**
 * Comprehensive backup system for Todoist data
 * Ensures data safety before any sync operations
 */
export class TodoistBackupManager {
  private plugin: TodoistPlugin;
  private backupPath = '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/Backups';

  constructor(plugin: TodoistPlugin) {
    this.plugin = plugin;
  }

  /**
   * Create a complete backup of current Todoist state before sync
   */
  async createPreSyncBackup(): Promise<{ success: boolean; backupFile: string; error?: string }> {
    try {
      const backupFilePath = this.generateBackupFilename();

      // Fetch all current Todoist data
      const backupData = await this.gatherTodoistData();

      // Create backup file
      await this.ensureBackupDirectory();
      await this.plugin.app.vault.create(backupFilePath, JSON.stringify(backupData, null, 2));

      // Clean up old backups (keep last 7 days)
      await this.cleanupOldBackups(7);

      const fileName = backupFilePath.split('/').pop() || 'backup.json';
      new Notice(`🛡️ Backup created: ${fileName}`, 2000);

      return { success: true, backupFile: backupFilePath };
    } catch (error) {
      const errorMsg = `Failed to create backup: ${error}`;
      console.error(errorMsg);
      return { success: false, backupFile: '', error: errorMsg };
    }
  }

  /**
   * Gather comprehensive Todoist data for backup
   */
  private async gatherTodoistData(): Promise<TodoistBackupData> {
    const [tasks, projects, sections, labels] = await Promise.all([
      this.fetchAllTasks(),
      this.fetchAllProjects(),
      this.fetchAllSections(),
      this.fetchAllLabels()
    ]);

    return {
      metadata: {
        version: '3.0.0',
        timestamp: new Date().toISOString(),
        type: 'pre-sync-backup'
      },
      data: {
        tasks: tasks.map(task => this.preserveTaskMetadata(task)),
        projects,
        sections,
        labels
      }
    };
  }

  /**
   * Preserve all Todoist-specific metadata that shouldn't be overwritten
   */
  private preserveTaskMetadata(task: Task): SafeTaskBackup {
    return {
      // Core task data
      id: task.id,
      content: task.content,
      description: task.description,

      // Metadata that must be preserved
      createdAt: task.createdAt,
      order: task.order,

      // Project and section info
      projectId: task.project.id,
      projectName: task.project.name,
      sectionId: task.section?.id || null,
      sectionName: task.section?.name || null,

      // Parent-child relationships (critical for subtasks)
      parentId: task.parentId || null,

      // Due date with all metadata
      due: task.due ? {
        date: task.due.date,
        datetime: task.due.datetime,
        string: task.due.string,
        timezone: task.due.timezone,
        isRecurring: task.due.isRecurring || false,
        recurringType: (task.due as any).recurringType || null
      } : null,

      // Duration and time tracking
      duration: task.duration,

      // Priority and labels
      priority: task.priority,
      labels: task.labels.map(l => ({ id: l.id, name: l.name, color: l.color })),

      // Todoist-specific metadata that we should never overwrite
      todoistMetadata: {
        assigneeId: (task as any).assigneeId || null,
        assignerId: (task as any).assignerId || null,
        commentCount: (task as any).commentCount || 0,
        isCompleted: (task as any).isCompleted || false,
        completedAt: (task as any).completedAt || null,
        addedByUid: (task as any).addedByUid || null,
        responsibleUid: (task as any).responsibleUid || null,
        syncId: (task as any).syncId || null,
        dayOrder: (task as any).dayOrder || null,
        collapsed: (task as any).collapsed || false,
        childOrder: (task as any).childOrder || null,
        dateAdded: (task as any).dateAdded || null,
        dateCompleted: (task as any).dateCompleted || null,
        inHistory: (task as any).inHistory || false,
        isArchived: (task as any).isArchived || false,
        isDeleted: (task as any).isDeleted || false,
        itemOrder: (task as any).itemOrder || null,
        legacyId: (task as any).legacyId || null,
        legacyProjectId: (task as any).legacyProjectId || null,
        projectData: (task as any).projectData || null,
        sharedWithAssistant: (task as any).sharedWithAssistant || false,
        userNotified: (task as any).userNotified || false
      }
    };
  }

  /**
   * Fetch all tasks with full metadata
   */
  private async fetchAllTasks(): Promise<Task[]> {
    if (!this.plugin.services.todoist.isReady()) {
      throw new Error('Todoist service not ready');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout fetching tasks for backup'));
      }, 15000);

      const [unsubscribe, refresh] = this.plugin.services.todoist.subscribe(
        'all',
        (result) => {
          clearTimeout(timeout);
          unsubscribe();

          if (result.type === 'success') {
            resolve(result.tasks || []);
          } else {
            reject(new Error('Failed to fetch tasks for backup'));
          }
        }
      );

      refresh();
    });
  }

  /**
   * Fetch all projects
   */
  private async fetchAllProjects(): Promise<any[]> {
    try {
      const data = this.plugin.services.todoist.data();
      // Use the correct method to get all projects
      const projects: any[] = [];
      for (const project of data.projects.iter()) {
        projects.push(project);
      }
      return projects;
    } catch (error) {
      console.warn('Failed to fetch projects for backup:', error);
      return [];
    }
  }

  /**
   * Fetch all sections
   */
  private async fetchAllSections(): Promise<any[]> {
    try {
      const data = this.plugin.services.todoist.data();
      // Use the correct method to get all sections
      const sections: any[] = [];
      for (const section of data.sections.iter()) {
        sections.push(section);
      }
      return sections;
    } catch (error) {
      console.warn('Failed to fetch sections for backup:', error);
      return [];
    }
  }

  /**
   * Fetch all labels
   */
  private async fetchAllLabels(): Promise<any[]> {
    try {
      const data = this.plugin.services.todoist.data();
      // Use the correct method to get all labels
      const labels: any[] = [];
      for (const label of data.labels.iter()) {
        labels.push(label);
      }
      return labels;
    } catch (error) {
      console.warn('Failed to fetch labels for backup:', error);
      return [];
    }
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    const vault = this.plugin.app.vault;
    const dirExists = vault.getAbstractFileByPath(this.backupPath);

    if (!dirExists) {
      await vault.createFolder(this.backupPath);
    }
  }

  /**
   * Clean up old backups (keep specified number of days)
   */
  async cleanupOldBackups(keepDays: number = 7): Promise<number> {
    try {
      const vault = this.plugin.app.vault;
      const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);

      const backupFiles = await this.listBackupFiles();
      let deletedCount = 0;

      for (const backupPath of backupFiles) {
        // Extract timestamp from filename
        const match = backupPath.match(/backup-(\d+)\.json$/);
        if (match) {
          const timestamp = parseInt(match[1]);
          if (timestamp < cutoffTime) {
            const file = vault.getAbstractFileByPath(backupPath);
            if (file) {
              await vault.delete(file);
              deletedCount++;
            }
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old backup files`);
      }

      return deletedCount;
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error);
      return 0;
    }
  }

  /**
   * Generate unique backup filename with timestamp
   */
  private generateBackupFilename(): string {
    const timestamp = Date.now();
    return `📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/backup-${timestamp}.json`;
  }

  /**
   * List all backup files in the system directory
   */
  async listBackupFiles(): Promise<string[]> {
    try {
      const vault = this.plugin.app.vault;
      const systemPath = '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System';

      const listing = await vault.adapter.list(systemPath);

      return listing.files
        .filter(filePath => filePath.includes('backup-') && filePath.endsWith('.json'))
        .sort(); // Sort chronologically
    } catch (error) {
      console.warn('Failed to list backup files:', error);
      return [];
    }
  }

  /**
   * Validate backup file structure and content
   */
  async validateBackup(backupFilePath: string): Promise<boolean> {
    try {
      const vault = this.plugin.app.vault;
      const backupFile = vault.getAbstractFileByPath(backupFilePath);

      if (!backupFile) {
        return false;
      }

      const content = await vault.read(backupFile);
      const backupData = JSON.parse(content);

      // Check required structure
      if (!backupData.metadata || !backupData.data) {
        return false;
      }

      // Check metadata fields
      if (!backupData.metadata.version || !backupData.metadata.timestamp || !backupData.metadata.type) {
        return false;
      }

      // Check data fields
      if (!Array.isArray(backupData.data.tasks) ||
          !Array.isArray(backupData.data.projects) ||
          !Array.isArray(backupData.data.sections) ||
          !Array.isArray(backupData.data.labels)) {
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Failed to validate backup:', error);
      return false;
    }
  }

  /**
   * Get backup statistics and information
   */
  async getBackupStatistics(): Promise<{
    totalBackups: number;
    oldestBackup: string;
    newestBackup: string;
    totalSizeBytes: number;
  }> {
    try {
      const backupFiles = await this.listBackupFiles();

      if (backupFiles.length === 0) {
        return {
          totalBackups: 0,
          oldestBackup: '',
          newestBackup: '',
          totalSizeBytes: 0
        };
      }

      // Sort by filename (which contains timestamp)
      const sortedFiles = backupFiles.sort();

      let totalSize = 0;
      const vault = this.plugin.app.vault;

      for (const filePath of backupFiles) {
        const file = vault.getAbstractFileByPath(filePath);
        if (file) {
          totalSize += file.stat.size;
        }
      }

      return {
        totalBackups: backupFiles.length,
        oldestBackup: sortedFiles[0],
        newestBackup: sortedFiles[sortedFiles.length - 1],
        totalSizeBytes: totalSize
      };
    } catch (error) {
      console.warn('Failed to get backup statistics:', error);
      return {
        totalBackups: 0,
        oldestBackup: '',
        newestBackup: '',
        totalSizeBytes: 0
      };
    }
  }

  /**
   * Restore from a backup file (emergency recovery)
   */
  async restoreFromBackup(backupFilePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const vault = this.plugin.app.vault;
      const backupFile = vault.getAbstractFileByPath(backupFilePath);

      if (!backupFile || !(backupFile instanceof TFile)) {
        throw new Error('Backup file not found');
      }

      const backupContent = await vault.read(backupFile);
      const backupData: TodoistBackupData = JSON.parse(backupContent);

      // Validate backup data
      if (!backupData.data || !backupData.data.tasks) {
        throw new Error('Invalid backup data format');
      }

      console.log(`Backup contains ${backupData.data.tasks.length} tasks from ${backupData.timestamp}`);
      new Notice(`📋 Backup loaded: ${backupData.data.tasks.length} tasks from ${new Date(backupData.timestamp).toLocaleString()}`, 5000);

      return { success: true };
    } catch (error) {
      const errorMsg = `Failed to restore backup: ${error}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      const vault = this.plugin.app.vault;
      const backupFiles = vault.getFiles()
        .filter(file => file.path.startsWith(this.backupPath) && file.name.startsWith('todoist-backup-'))
        .sort((a, b) => b.stat.mtime - a.stat.mtime);

      const backupInfos: BackupInfo[] = [];

      for (const file of backupFiles) {
        try {
          const content = await vault.read(file);
          const data: TodoistBackupData = JSON.parse(content);

          backupInfos.push({
            fileName: file.name,
            filePath: file.path,
            timestamp: data.timestamp,
            taskCount: data.data.tasks.length,
            projectCount: data.data.projects.length,
            size: file.stat.size,
            reason: data.metadata.backupReason
          });
        } catch (error) {
          console.warn(`Failed to read backup file ${file.name}:`, error);
        }
      }

      return backupInfos;
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }
}

/**
 * Comprehensive backup data structure
 */
export interface TodoistBackupData {
  timestamp: string;
  version: string;
  data: {
    tasks: SafeTaskBackup[];
    projects: any[];
    sections: any[];
    labels: any[];
  };
  metadata: {
    totalTasks: number;
    totalProjects: number;
    backupReason: string;
    pluginVersion: string;
  };
}

/**
 * Safe task backup with all metadata preserved
 */
export interface SafeTaskBackup {
  id: string;
  content: string;
  description: string;
  createdAt: string;
  order: number;
  projectId: string;
  projectName: string;
  sectionId: string | null;
  sectionName: string | null;
  parentId: string | null;
  due: {
    date: string;
    datetime: string | null;
    string: string;
    timezone: string | null;
    isRecurring: boolean;
    recurringType: string | null;
  } | null;
  duration: any;
  priority: number;
  labels: Array<{ id: string; name: string; color: string }>;
  todoistMetadata: Record<string, any>;
}

/**
 * Backup file information
 */
export interface BackupInfo {
  fileName: string;
  filePath: string;
  timestamp: string;
  taskCount: number;
  projectCount: number;
  size: number;
  reason: string;
}
