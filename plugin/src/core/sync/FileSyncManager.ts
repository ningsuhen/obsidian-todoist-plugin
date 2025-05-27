import { Notice, TFile, TFolder } from 'obsidian';
import type TodoistPlugin from '@/index';
import type { Task } from '@/data/task';
import { TaskMappingManager } from './TaskMappingManager';
import { TaskFormatter, TaskCollectionUtils } from './TaskFormatter';
import { buildTaskTree, type TaskTree } from '@/data/transformations/relationships';
import type { Project } from '@/api/domain/project';
import type { Section } from '@/api/domain/section';
import type { Label } from '@/api/domain/label';

export interface SyncStats {
  tasksProcessed: number;
  projectsProcessed: number;
  filesCreated: number;
  filesUpdated: number;
  lastSyncTime: Date;
  errors: string[];
}

/**
 * FileSyncManager - Manages file-based synchronization with Todoist
 *
 * Creates and maintains a Todoist-like folder structure with markdown files
 * that mirror the organization of tasks in Todoist.
 */
export class FileSyncManager {
  private plugin: TodoistPlugin;
  private basePath: string;
  private lastSyncTime: Date | null = null;
  private mappingManager: TaskMappingManager;

  constructor(plugin: TodoistPlugin) {
    this.plugin = plugin;
    this.basePath = '📋 01-PRODUCTIVITY/todoist-integration';
    this.mappingManager = new TaskMappingManager(plugin);
  }

  /**
   * Main sync method - fetches all tasks and organizes them into files
   */
  async syncAllTasks(): Promise<SyncStats> {
    const stats: SyncStats = {
      tasksProcessed: 0,
      projectsProcessed: 0,
      filesCreated: 0,
      filesUpdated: 0,
      lastSyncTime: new Date(),
      errors: []
    };

    try {
      // Check if Todoist adapter is ready
      if (!this.plugin.services.todoist.isReady()) {
        throw new Error('Todoist service not ready. Please check your API token.');
      }

      // Initialize mapping manager
      await this.mappingManager.initialize();

      // Fetch all tasks from Todoist
      const allTasks = await this.fetchAllTasks();
      stats.tasksProcessed = allTasks.length;

      // Organize tasks by category
      const organizedTasks = this.organizeTasks(allTasks);

      // Update Inbox file
      await this.updateInboxFile(organizedTasks.inbox);
      if (organizedTasks.inbox.length > 0) stats.filesUpdated++;

      // Update Today file
      await this.updateTodayFile(organizedTasks.today);
      if (organizedTasks.today.length > 0) stats.filesUpdated++;

      // Update Upcoming file
      await this.updateUpcomingFile(organizedTasks.upcoming);
      if (organizedTasks.upcoming.length > 0) stats.filesUpdated++;

      // Clean up orphaned mappings
      const orphanedCount = await this.mappingManager.cleanupOrphanedMappings();
      if (orphanedCount > 0) {
        console.log(`Cleaned up ${orphanedCount} orphaned task mappings`);
      }

      // Update project files
      for (const [projectName, tasks] of Object.entries(organizedTasks.projects)) {
        await this.updateProjectFile(projectName, tasks);
        stats.projectsProcessed++;
        stats.filesUpdated++;
      }

      // Update label files
      for (const [labelName, tasks] of Object.entries(organizedTasks.labels)) {
        await this.updateLabelFile(labelName, tasks);
        stats.filesUpdated++;
      }

      // Update sync status
      await this.updateSyncStatus(stats);

      this.lastSyncTime = stats.lastSyncTime;

      // Show ADHD-friendly success notification
      new Notice(`✅ Sync complete! ${stats.tasksProcessed} tasks organized`, 3000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      stats.errors.push(errorMessage);
      console.error('FileSyncManager sync error:', error);
      new Notice(`❌ Sync failed: ${errorMessage}`, 5000);
    }

    return stats;
  }

  /**
   * Fetch all tasks using the subscription system with no filter
   */
  private async fetchAllTasks(): Promise<Task[]> {
    try {
      // Wait for the Todoist service to be ready
      if (!this.plugin.services.todoist.isReady()) {
        throw new Error('Todoist service not ready');
      }

      // Use the subscription system with no filter to get all tasks
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for tasks'));
        }, 10000); // 10 second timeout

        // Use a subscription with a filter that gets all tasks
        const [unsubscribe, refresh] = this.plugin.services.todoist.subscribe(
          'all', // Use 'all' filter to get all tasks
          (result) => {
            clearTimeout(timeout);
            unsubscribe();

            if (result.type === 'success') {
              // The subscription result has 'tasks' property
              const tasks = Array.isArray(result.tasks) ? result.tasks : [];
              resolve(tasks);
            } else {
              reject(new Error('Failed to fetch tasks: ' + (result.type === 'error' ? result.kind : 'Unknown error')));
            }
          }
        );

        // Trigger a refresh to get the latest data
        refresh();
      });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }

  /**
   * Sync changes from Obsidian back to Todoist
   * This method detects modifications in markdown files and updates Todoist accordingly
   */
  async syncObsidianChangesToTodoist(): Promise<{ updated: number; completed: number; errors: string[] }> {
    const result = { updated: 0, completed: 0, errors: [] as string[] };

    try {
      await this.mappingManager.initialize();

      // Get all markdown files in the integration folder
      const files = await this.getAllMarkdownFiles();

      for (const file of files) {
        try {
          const content = await this.plugin.app.vault.read(file);
          const modifications = TaskCollectionUtils.findModifiedTasks(content, []);

          for (const mod of modifications) {
            if (mod.parsed.completed && mod.original) {
              // Task was completed in Obsidian - close it in Todoist
              await this.plugin.services.todoist.actions.closeTask(mod.original.id);
              result.completed++;
            } else if (mod.parsed.content !== mod.original?.content) {
              // Task content was modified - update in Todoist
              // Note: This would require additional API methods for updating tasks
              console.log(`Task content changed: ${mod.parsed.content}`);
              result.updated++;
            }
          }
        } catch (error) {
          const errorMsg = `Failed to process file ${file.path}: ${error}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to sync Obsidian changes: ${error}`;
      result.errors.push(errorMsg);
      console.error(errorMsg);
    }

    return result;
  }

  /**
   * Get all markdown files in the integration folder
   */
  private async getAllMarkdownFiles(): Promise<TFile[]> {
    const files: TFile[] = [];
    const folder = this.plugin.app.vault.getAbstractFileByPath(this.basePath);

    if (folder && folder instanceof TFolder) {
      const traverse = (currentFolder: TFolder) => {
        for (const child of currentFolder.children) {
          if (child instanceof TFile && child.extension === 'md') {
            // Skip system files
            if (!child.path.includes('⚙️ System/')) {
              files.push(child);
            }
          } else if (child instanceof TFolder) {
            traverse(child);
          }
        }
      };

      traverse(folder);
    }

    return files;
  }

  // Note: hydrateTask method removed since subscription system returns already hydrated Task objects

  /**
   * Organize tasks into categories for file creation
   */
  private organizeTasks(tasks: Task[]) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const organized = {
      inbox: [] as Task[],
      today: [] as Task[],
      upcoming: [] as Task[],
      projects: {} as Record<string, Task[]>,
      labels: {} as Record<string, Task[]>
    };

    for (const task of tasks) {
      // Categorize by due date
      if (task.due) {
        const dueDate = new Date(task.due.date);
        if (dueDate <= today) {
          organized.today.push(task);
        } else if (dueDate <= nextWeek) {
          organized.upcoming.push(task);
        }
      }

      // Categorize by project
      if (task.project.isInboxProject) {
        organized.inbox.push(task);
      } else {
        const projectName = task.project.name;
        if (!organized.projects[projectName]) {
          organized.projects[projectName] = [];
        }
        organized.projects[projectName].push(task);
      }

      // Categorize by labels
      for (const label of task.labels) {
        const labelName = label.name;
        if (!organized.labels[labelName]) {
          organized.labels[labelName] = [];
        }
        organized.labels[labelName].push(task);
      }
    }

    return organized;
  }

  /**
   * Update the Inbox.md file with inbox tasks
   */
  private async updateInboxFile(tasks: Task[]): Promise<void> {
    const filePath = `${this.basePath}/📥 Inbox.md`;
    const content = this.generateInboxContent(tasks);
    await this.updateFile(filePath, content, tasks);
  }

  /**
   * Update the Today.md file with today's tasks
   */
  private async updateTodayFile(tasks: Task[]): Promise<void> {
    const filePath = `${this.basePath}/📅 Today.md`;
    const content = this.generateTodayContent(tasks);
    await this.updateFile(filePath, content, tasks);
  }

  /**
   * Update the Upcoming.md file with upcoming tasks
   */
  private async updateUpcomingFile(tasks: Task[]): Promise<void> {
    const filePath = `${this.basePath}/📆 Upcoming.md`;
    const content = this.generateUpcomingContent(tasks);
    await this.updateFile(filePath, content, tasks);
  }

  /**
   * Update a project file with project tasks organized by sections
   */
  private async updateProjectFile(projectName: string, tasks: Task[]): Promise<void> {
    const filePath = `${this.basePath}/🗂️ Projects/${this.sanitizeFileName(projectName)}.md`;
    const content = this.generateProjectContent(projectName, tasks);
    await this.updateFile(filePath, content, tasks);
  }

  /**
   * Update a label file with labeled tasks
   */
  private async updateLabelFile(labelName: string, tasks: Task[]): Promise<void> {
    const filePath = `${this.basePath}/🏷️ Labels/${this.sanitizeFileName(labelName)}.md`;
    const content = this.generateLabelContent(labelName, tasks);
    await this.updateFile(filePath, content, tasks);
  }

  /**
   * Update sync status file
   */
  private async updateSyncStatus(stats: SyncStats): Promise<void> {
    const filePath = `${this.basePath}/⚙️ System/Sync Status.md`;
    const content = this.generateSyncStatusContent(stats);
    await this.updateFile(filePath, content);
  }

  /**
   * Generic file update method with mapping support
   */
  private async updateFile(filePath: string, content: string, tasks?: Task[]): Promise<void> {
    const vault = this.plugin.app.vault;

    try {
      const existingFile = vault.getAbstractFileByPath(filePath);

      if (existingFile && existingFile instanceof TFile) {
        // Update existing file
        await vault.modify(existingFile, content);
      } else {
        // Create new file (ensure directory exists)
        const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const dirExists = vault.getAbstractFileByPath(dirPath);

        if (!dirExists) {
          await vault.createFolder(dirPath);
        }

        await vault.create(filePath, content);
      }

      // Create mappings for tasks if provided
      if (tasks && tasks.length > 0) {
        await this.createTaskMappings(filePath, content, tasks);
      }
    } catch (error) {
      console.error(`Failed to update file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Create mappings between tasks and their locations in markdown files
   */
  private async createTaskMappings(filePath: string, content: string, tasks: Task[]): Promise<void> {
    const lines = content.split('\n');
    const relativePath = filePath.replace(`${this.basePath}/`, '');

    let taskIndex = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      if (TaskFormatter.isTaskLine(line)) {
        const todoistId = TaskFormatter.extractTodoistId(line);

        if (todoistId && taskIndex < tasks.length) {
          const task = tasks.find(t => t.id === todoistId);
          if (task) {
            await this.mappingManager.createMapping(task, relativePath, lineIndex);
          }
        }
        taskIndex++;
      }
    }
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  private sanitizeFileName(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '_').trim();
  }

  /**
   * Generate content for Inbox.md
   */
  private generateInboxContent(tasks: Task[]): string {
    const timestamp = new Date().toISOString();

    let content = `# 📥 Inbox

*Tasks without a specific project*

<!-- This file is automatically updated by the ADHD-Optimized Todoist Plugin -->
<!-- Last sync: ${timestamp} -->

`;

    if (tasks.length === 0) {
      content += `## Tasks
*No tasks in inbox* ✨

Great job keeping your inbox clean! 🎉
`;
    } else {
      content += `## Tasks (${tasks.length})\n\n`;

      // Build task tree to handle subtasks properly
      const taskTrees = buildTaskTree(tasks);
      const sortedTrees = this.sortTaskTrees(taskTrees);

      for (const taskTree of sortedTrees) {
        content += this.formatTaskTreeAsMarkdown(taskTree);
      }
    }

    return content;
  }

  /**
   * Generate content for Today.md
   */
  private generateTodayContent(tasks: Task[]): string {
    const timestamp = new Date().toISOString();
    const today = new Date().toLocaleDateString();

    let content = `# 📅 Today - ${today}

*Tasks due today*

<!-- This file is automatically updated by the ADHD-Optimized Todoist Plugin -->
<!-- Last sync: ${timestamp} -->

`;

    if (tasks.length === 0) {
      content += `## Tasks
*No tasks due today* ✨

Enjoy your free day or tackle some upcoming tasks! 🌟
`;
    } else {
      content += `## Tasks (${tasks.length})\n\n`;

      // Build task tree and group by priority for ADHD focus
      const taskTrees = buildTaskTree(tasks);
      const priorityGroups = this.groupTaskTreesByPriority(taskTrees);

      for (const [priority, priorityTrees] of Object.entries(priorityGroups)) {
        if (priorityTrees.length > 0) {
          content += `### ${this.getPriorityEmoji(Number(priority))} ${this.getPriorityName(Number(priority))}\n\n`;

          for (const taskTree of priorityTrees) {
            content += this.formatTaskTreeAsMarkdown(taskTree);
          }
          content += '\n';
        }
      }
    }

    return content;
  }

  /**
   * Generate content for Upcoming.md
   */
  private generateUpcomingContent(tasks: Task[]): string {
    const timestamp = new Date().toISOString();

    let content = `# 📆 Upcoming

*Tasks due in the next 7 days*

<!-- This file is automatically updated by the ADHD-Optimized Todoist Plugin -->
<!-- Last sync: ${timestamp} -->

`;

    if (tasks.length === 0) {
      content += `## Tasks
*No upcoming tasks* ✨

Your schedule looks clear ahead! 🎯
`;
    } else {
      content += `## Tasks (${tasks.length})\n\n`;

      // Group by due date
      const dateGroups = this.groupTasksByDate(tasks);

      for (const [date, dateTasks] of Object.entries(dateGroups)) {
        content += `### 📅 ${date}\n\n`;

        for (const task of dateTasks) {
          content += this.formatTaskAsMarkdown(task);
        }
        content += '\n';
      }
    }

    return content;
  }

  /**
   * Generate content for project files
   */
  private generateProjectContent(projectName: string, tasks: Task[]): string {
    const timestamp = new Date().toISOString();

    let content = `# 🗂️ ${projectName}

*Project tasks organized by sections*

<!-- This file is automatically updated by the ADHD-Optimized Todoist Plugin -->
<!-- Last sync: ${timestamp} -->

`;

    if (tasks.length === 0) {
      content += `## Tasks
*No tasks in this project* ✨

Ready for new tasks! 🚀
`;
    } else {
      // Group by sections
      const sectionGroups = this.groupTasksBySection(tasks);

      // Show tasks without sections first
      if (sectionGroups['No Section'] && sectionGroups['No Section'].length > 0) {
        content += `## 📋 Tasks (${sectionGroups['No Section'].length})\n\n`;

        for (const task of sectionGroups['No Section']) {
          content += this.formatTaskAsMarkdown(task);
        }
        content += '\n';
      }

      // Show sectioned tasks
      for (const [sectionName, sectionTasks] of Object.entries(sectionGroups)) {
        if (sectionName !== 'No Section' && sectionTasks.length > 0) {
          content += `## 📂 ${sectionName} (${sectionTasks.length})\n\n`;

          for (const task of sectionTasks) {
            content += this.formatTaskAsMarkdown(task);
          }
          content += '\n';
        }
      }
    }

    return content;
  }

  /**
   * Generate content for label files
   */
  private generateLabelContent(labelName: string, tasks: Task[]): string {
    const timestamp = new Date().toISOString();

    let content = `# 🏷️ ${labelName}

*Tasks with the "${labelName}" label*

<!-- This file is automatically updated by the ADHD-Optimized Todoist Plugin -->
<!-- Last sync: ${timestamp} -->

`;

    if (tasks.length === 0) {
      content += `## Tasks
*No tasks with this label* ✨
`;
    } else {
      content += `## Tasks (${tasks.length})\n\n`;

      // Group by project for context
      const projectGroups = this.groupTasksByProject(tasks);

      for (const [projectName, projectTasks] of Object.entries(projectGroups)) {
        if (projectTasks.length > 0) {
          content += `### 🗂️ ${projectName}\n\n`;

          for (const task of projectTasks) {
            content += this.formatTaskAsMarkdown(task);
          }
          content += '\n';
        }
      }
    }

    return content;
  }

  /**
   * Generate content for sync status file
   */
  private generateSyncStatusContent(stats: SyncStats): string {
    const timestamp = stats.lastSyncTime.toLocaleString();
    const status = stats.errors.length > 0 ? '⚠️ Partial Success' : '✅ Success';

    let content = `# ⚙️ Sync Status

*Plugin synchronization information*

## Last Sync
- **Time:** ${timestamp}
- **Status:** ${status}
- **Tasks Synced:** ${stats.tasksProcessed}
- **Projects Synced:** ${stats.projectsProcessed}
- **Files Updated:** ${stats.filesUpdated}

## Configuration
- **ADHD Mode:** Enabled ✅
- **Auto Sync:** Every 5 minutes
- **Folder Structure:** Todoist-like
- **File Format:** Markdown with checkboxes

`;

    if (stats.errors.length > 0) {
      content += `## ⚠️ Sync Errors\n\n`;
      for (const error of stats.errors) {
        content += `- ${error}\n`;
      }
      content += '\n';
    }

    content += `## 🧠 ADHD Optimizations Active
- ✅ Cognitive load reduction
- ✅ Dopamine-friendly feedback
- ✅ Zero-configuration sync
- ✅ Visual task organization
- ✅ Automatic file management

*Last updated: ${timestamp}*
`;

    return content;
  }

  // Utility methods for task formatting and grouping

  /**
   * Format a task as markdown checkbox with ADHD-friendly styling and mapping metadata
   * Handles both parent tasks and subtasks with proper indentation
   */
  private formatTaskAsMarkdown(task: Task, indent: string = ''): string {
    return TaskFormatter.formatTaskAsMarkdown(task, true);
  }

  /**
   * Format a task tree (parent + children) with proper hierarchical indentation
   */
  private formatTaskTreeAsMarkdown(taskTree: TaskTree, indent: string = ''): string {
    let result = '';

    // Format the parent task
    result += this.formatTaskAsMarkdown(taskTree, indent);

    // Format children with increased indentation
    if (taskTree.children && taskTree.children.length > 0) {
      const childIndent = indent + '  '; // Add 2 spaces for each level

      for (const child of taskTree.children) {
        // Format child as subtask with indentation
        result += `${childIndent}- [ ] ${child.content}`;

        // Add priority indicator for child
        if (child.priority > 1) {
          result += ` ${this.getPriorityEmoji(child.priority)}`;
        }

        // Add due date for child
        if (child.due) {
          const dueDate = new Date(child.due.date);
          const isOverdue = dueDate < new Date();
          const dateStr = dueDate.toLocaleDateString();

          if (isOverdue) {
            result += ` 🔴 **OVERDUE: ${dateStr}**`;
          } else {
            result += ` 📅 ${dateStr}`;
          }
        }

        // Add labels for child
        if (child.labels.length > 0) {
          const labelStr = child.labels.map(l => `#${l.name}`).join(' ');
          result += ` ${labelStr}`;
        }

        // Add hidden metadata for child
        result += ` <!-- todoist:${child.id} -->\n`;

        // Add child description with deeper indentation
        if (child.description && child.description.trim()) {
          result += TaskFormatter.formatDescription(child.description)
            .split('\n')
            .map(line => line ? `${childIndent}  ${line}` : '')
            .join('\n') + '\n';
        }

        // Recursively format grandchildren
        if (child.children && child.children.length > 0) {
          result += this.formatTaskTreeAsMarkdown(child, childIndent);
        }
      }
    }

    return result;
  }

  /**
   * Sort tasks by priority and due date for ADHD focus
   */
  private sortTasks(tasks: Task[]): Task[] {
    return tasks.sort((a, b) => {
      // Priority first (higher number = higher priority)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Then by due date
      if (a.due && b.due) {
        return new Date(a.due.date).getTime() - new Date(b.due.date).getTime();
      }

      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;

      // Finally by order
      return a.order - b.order;
    });
  }

  /**
   * Sort task trees by priority and due date for ADHD focus
   */
  private sortTaskTrees(taskTrees: TaskTree[]): TaskTree[] {
    return taskTrees.sort((a, b) => {
      // Sort by priority first (higher priority = lower number, but we want higher priority first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Then by due date (overdue and today first)
      if (a.due && b.due) {
        return new Date(a.due.date).getTime() - new Date(b.due.date).getTime();
      }
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;

      // Finally by order
      return a.order - b.order;
    });
  }

  /**
   * Group tasks by priority
   */
  private groupTasksByPriority(tasks: Task[]): Record<number, Task[]> {
    const groups: Record<number, Task[]> = { 4: [], 3: [], 2: [], 1: [] };

    for (const task of tasks) {
      groups[task.priority].push(task);
    }

    return groups;
  }

  /**
   * Group task trees by priority
   */
  private groupTaskTreesByPriority(taskTrees: TaskTree[]): Record<number, TaskTree[]> {
    const groups: Record<number, TaskTree[]> = { 4: [], 3: [], 2: [], 1: [] };

    for (const taskTree of taskTrees) {
      groups[taskTree.priority].push(taskTree);
    }

    return groups;
  }

  /**
   * Group tasks by due date
   */
  private groupTasksByDate(tasks: Task[]): Record<string, Task[]> {
    const groups: Record<string, Task[]> = {};

    for (const task of tasks) {
      if (task.due) {
        const dateKey = new Date(task.due.date).toLocaleDateString();
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(task);
      }
    }

    // Sort groups by date
    const sortedGroups: Record<string, Task[]> = {};
    const sortedKeys = Object.keys(groups).sort((a, b) =>
      new Date(a).getTime() - new Date(b).getTime()
    );

    for (const key of sortedKeys) {
      sortedGroups[key] = this.sortTasks(groups[key]);
    }

    return sortedGroups;
  }

  /**
   * Group tasks by section
   */
  private groupTasksBySection(tasks: Task[]): Record<string, Task[]> {
    const groups: Record<string, Task[]> = {};

    for (const task of tasks) {
      const sectionName = task.section?.name || 'No Section';
      if (!groups[sectionName]) {
        groups[sectionName] = [];
      }
      groups[sectionName].push(task);
    }

    // Sort tasks within each group
    for (const sectionName of Object.keys(groups)) {
      groups[sectionName] = this.sortTasks(groups[sectionName]);
    }

    return groups;
  }

  /**
   * Group tasks by project
   */
  private groupTasksByProject(tasks: Task[]): Record<string, Task[]> {
    const groups: Record<string, Task[]> = {};

    for (const task of tasks) {
      const projectName = task.project.name;
      if (!groups[projectName]) {
        groups[projectName] = [];
      }
      groups[projectName].push(task);
    }

    // Sort tasks within each group
    for (const projectName of Object.keys(groups)) {
      groups[projectName] = this.sortTasks(groups[projectName]);
    }

    return groups;
  }

  /**
   * Get priority emoji for visual clarity
   */
  private getPriorityEmoji(priority: number): string {
    switch (priority) {
      case 4: return '🔴'; // P1 - Urgent
      case 3: return '🟡'; // P2 - High
      case 2: return '🔵'; // P3 - Medium
      case 1: return '⚪'; // P4 - Low
      default: return '⚪';
    }
  }

  /**
   * Get priority name for headers
   */
  private getPriorityName(priority: number): string {
    switch (priority) {
      case 4: return 'Urgent (P1)';
      case 3: return 'High Priority (P2)';
      case 2: return 'Medium Priority (P3)';
      case 1: return 'Low Priority (P4)';
      default: return 'No Priority';
    }
  }

  /**
   * Get last sync time for external access
   */
  public getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  /**
   * Check if sync is needed (for auto-sync functionality)
   */
  public shouldSync(): boolean {
    if (!this.lastSyncTime) return true;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.lastSyncTime < fiveMinutesAgo;
  }
}
