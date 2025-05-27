import { TFile } from 'obsidian';
import type TodoistPlugin from '@/index';
import type { Task } from '@/data/task';

/**
 * Represents the mapping between an Obsidian task and a Todoist task
 */
export interface TaskMapping {
  todoistId: string;
  obsidianFile: string;
  obsidianLineNumber: number;
  content: string;
  lastSyncTime: string;
  checksum: string; // For detecting changes
}

/**
 * Manages the bidirectional mapping between Obsidian tasks and Todoist tasks
 * Uses multiple strategies to maintain reliable associations
 */
export class TaskMappingManager {
  private plugin: TodoistPlugin;
  private mappings: Map<string, TaskMapping> = new Map(); // todoistId -> mapping
  private reverseMap: Map<string, string> = new Map(); // obsidianKey -> todoistId
  private mappingFile = '⚙️ System/Task Mappings.json';

  constructor(plugin: TodoistPlugin) {
    this.plugin = plugin;
  }

  /**
   * Initialize the mapping manager by loading existing mappings
   */
  async initialize(): Promise<void> {
    await this.loadMappings();
  }

  /**
   * Create or update a mapping between a Todoist task and its Obsidian representation
   */
  async createMapping(
    todoistTask: Task,
    obsidianFile: string,
    lineNumber: number
  ): Promise<void> {
    const obsidianKey = this.getObsidianKey(obsidianFile, lineNumber);
    const checksum = this.calculateChecksum(todoistTask);

    const mapping: TaskMapping = {
      todoistId: todoistTask.id,
      obsidianFile,
      obsidianLineNumber: lineNumber,
      content: todoistTask.content,
      lastSyncTime: new Date().toISOString(),
      checksum,
    };

    // Update mappings
    this.mappings.set(todoistTask.id, mapping);
    this.reverseMap.set(obsidianKey, todoistTask.id);

    await this.saveMappings();
  }

  /**
   * Find the Todoist task ID for a given Obsidian task location
   */
  getTodoistId(obsidianFile: string, lineNumber: number): string | null {
    const obsidianKey = this.getObsidianKey(obsidianFile, lineNumber);
    return this.reverseMap.get(obsidianKey) || null;
  }

  /**
   * Find the Obsidian location for a given Todoist task ID
   */
  getObsidianLocation(todoistId: string): { file: string; line: number } | null {
    const mapping = this.mappings.get(todoistId);
    if (!mapping) return null;

    return {
      file: mapping.obsidianFile,
      line: mapping.obsidianLineNumber,
    };
  }

  /**
   * Remove a mapping when a task is deleted
   */
  async removeMapping(todoistId: string): Promise<void> {
    const mapping = this.mappings.get(todoistId);
    if (mapping) {
      const obsidianKey = this.getObsidianKey(mapping.obsidianFile, mapping.obsidianLineNumber);
      this.reverseMap.delete(obsidianKey);
      this.mappings.delete(todoistId);
      await this.saveMappings();
    }
  }

  /**
   * Update mapping when a task moves to a different line or file
   */
  async updateMapping(
    todoistId: string,
    newFile: string,
    newLineNumber: number
  ): Promise<void> {
    const mapping = this.mappings.get(todoistId);
    if (!mapping) return;

    // Remove old reverse mapping
    const oldKey = this.getObsidianKey(mapping.obsidianFile, mapping.obsidianLineNumber);
    this.reverseMap.delete(oldKey);

    // Update mapping
    mapping.obsidianFile = newFile;
    mapping.obsidianLineNumber = newLineNumber;
    mapping.lastSyncTime = new Date().toISOString();

    // Add new reverse mapping
    const newKey = this.getObsidianKey(newFile, newLineNumber);
    this.reverseMap.set(newKey, todoistId);

    await this.saveMappings();
  }

  /**
   * Detect if a task has been modified by comparing checksums
   */
  hasTaskChanged(todoistTask: Task): boolean {
    const mapping = this.mappings.get(todoistTask.id);
    if (!mapping) return true;

    const currentChecksum = this.calculateChecksum(todoistTask);
    return mapping.checksum !== currentChecksum;
  }

  /**
   * Update the checksum for a task after sync
   */
  async updateChecksum(todoistTask: Task): Promise<void> {
    const mapping = this.mappings.get(todoistTask.id);
    if (mapping) {
      mapping.checksum = this.calculateChecksum(todoistTask);
      mapping.lastSyncTime = new Date().toISOString();
      await this.saveMappings();
    }
  }

  /**
   * Find orphaned mappings (Obsidian tasks that no longer exist)
   */
  async findOrphanedMappings(): Promise<TaskMapping[]> {
    const orphaned: TaskMapping[] = [];

    for (const mapping of this.mappings.values()) {
      const file = this.plugin.app.vault.getAbstractFileByPath(
        `📋 01-PRODUCTIVITY/todoist-integration/${mapping.obsidianFile}`
      );

      if (!file || !(file instanceof TFile)) {
        orphaned.push(mapping);
        continue;
      }

      try {
        const content = await this.plugin.app.vault.read(file);
        const lines = content.split('\n');

        if (mapping.obsidianLineNumber >= lines.length) {
          orphaned.push(mapping);
          continue;
        }

        const line = lines[mapping.obsidianLineNumber];
        if (!line.includes('- [ ]') && !line.includes('- [x]')) {
          orphaned.push(mapping);
        }
      } catch (error) {
        orphaned.push(mapping);
      }
    }

    return orphaned;
  }

  /**
   * Clean up orphaned mappings
   */
  async cleanupOrphanedMappings(): Promise<number> {
    const orphaned = await this.findOrphanedMappings();

    for (const mapping of orphaned) {
      await this.removeMapping(mapping.todoistId);
    }

    return orphaned.length;
  }

  /**
   * Get all current mappings for debugging/inspection
   */
  getAllMappings(): TaskMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Generate a unique key for an Obsidian task location
   */
  private getObsidianKey(file: string, lineNumber: number): string {
    return `${file}:${lineNumber}`;
  }

  /**
   * Calculate a checksum for a task to detect changes
   * Uses Unicode-safe encoding to handle emojis and special characters
   */
  private calculateChecksum(task: Task): string {
    const data = {
      content: task.content,
      description: task.description,
      priority: task.priority,
      due: task.due?.date,
      labels: task.labels.map(l => l.name).sort(),
      project: task.project.id,
      section: task.section?.id,
    };

    // Use Unicode-safe encoding instead of btoa
    const jsonString = JSON.stringify(data);
    return this.unicodeSafeEncode(jsonString);
  }

  /**
   * Unicode-safe base64 encoding that handles emojis and special characters
   */
  private unicodeSafeEncode(str: string): string {
    try {
      // Convert to UTF-8 bytes first, then encode
      const utf8Bytes = new TextEncoder().encode(str);
      const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
      return btoa(binaryString);
    } catch (error) {
      // Fallback to simple hash if encoding fails
      console.warn('Failed to encode checksum, using simple hash:', error);
      return this.simpleHash(str);
    }
  }

  /**
   * Simple hash function as fallback for checksum calculation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Load mappings from the mapping file with corruption recovery
   */
  private async loadMappings(): Promise<void> {
    try {
      const mappingPath = `📋 01-PRODUCTIVITY/todoist-integration/${this.mappingFile}`;
      const file = this.plugin.app.vault.getAbstractFileByPath(mappingPath);

      if (!file || !(file instanceof TFile)) {
        return; // No mappings file exists yet
      }

      const content = await this.plugin.app.vault.read(file);

      // Try to parse JSON with corruption recovery
      let data;
      try {
        data = JSON.parse(content);
      } catch (jsonError) {
        console.warn('Corrupted mappings file detected, attempting recovery:', jsonError);

        // Try to recover by creating backup and starting fresh
        const backupPath = `📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/corrupted-mappings-backup-${Date.now()}.json`;
        try {
          await this.plugin.app.vault.create(backupPath, content);
          console.log(`Corrupted mappings backed up to: ${backupPath}`);
        } catch (backupError) {
          console.warn('Failed to backup corrupted mappings:', backupError);
        }

        // Delete corrupted file and start fresh
        await this.plugin.app.vault.delete(file);
        console.log('Corrupted mappings file deleted, starting with fresh mappings');

        this.mappings.clear();
        this.reverseMap.clear();
        return;
      }

      this.mappings.clear();
      this.reverseMap.clear();

      for (const mapping of data.mappings || []) {
        if (mapping.todoistId && mapping.obsidianFile !== undefined && mapping.obsidianLineNumber !== undefined) {
          this.mappings.set(mapping.todoistId, mapping);
          const obsidianKey = this.getObsidianKey(mapping.obsidianFile, mapping.obsidianLineNumber);
          this.reverseMap.set(obsidianKey, mapping.todoistId);
        }
      }

      console.log(`Loaded ${this.mappings.size} task mappings successfully`);
    } catch (error) {
      console.warn('Failed to load task mappings, starting fresh:', error);
      // Start with empty mappings if loading fails
      this.mappings.clear();
      this.reverseMap.clear();
    }
  }

  /**
   * Save mappings to the mapping file
   */
  private async saveMappings(): Promise<void> {
    try {
      const mappingPath = `📋 01-PRODUCTIVITY/todoist-integration/${this.mappingFile}`;

      const data = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        mappings: Array.from(this.mappings.values()),
      };

      const content = JSON.stringify(data, null, 2);

      // Ensure the file exists
      const file = this.plugin.app.vault.getAbstractFileByPath(mappingPath);
      if (file && file instanceof TFile) {
        await this.plugin.app.vault.modify(file, content);
      } else {
        await this.plugin.app.vault.create(mappingPath, content);
      }
    } catch (error) {
      console.error('Failed to save task mappings:', error);
    }
  }
}
