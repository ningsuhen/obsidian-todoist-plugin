import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IncrementalSyncManager } from '../IncrementalSyncManager';
import { TaskFormatter } from '../TaskFormatter';
import type TodoistPlugin from '@/index';
import type { Task } from '@/data/task';

// Mock the plugin and its dependencies
const mockPlugin = {
  app: {
    vault: {
      getAbstractFileByPath: vi.fn(),
      read: vi.fn(),
    },
  },
} as unknown as TodoistPlugin;

describe('IncrementalSyncManager', () => {
  let incrementalSyncManager: IncrementalSyncManager;

  beforeEach(() => {
    vi.clearAllMocks();
    incrementalSyncManager = new IncrementalSyncManager(mockPlugin);
  });

  describe('Task Change Detection', () => {
    it('should identify new tasks correctly', async () => {
      const todoistTasks: Task[] = [
        {
          id: '1',
          content: 'New task',
          priority: 1,
          due: null,
          labels: [],
          project: { id: 'proj1', name: 'Project 1' },
          section: null,
          order: 1,
        } as Task,
      ];

      const markdownFiles = ['test.md'];
      
      // Mock empty existing hashes (no tasks in Obsidian yet)
      vi.spyOn(incrementalSyncManager as any, 'extractExistingTaskHashes')
        .mockResolvedValue(new Map());

      const changes = await incrementalSyncManager.identifyChangedTasks(todoistTasks, markdownFiles);

      expect(changes.newTasks).toHaveLength(1);
      expect(changes.newTasks[0].id).toBe('1');
      expect(changes.changedTasks).toHaveLength(0);
      expect(changes.unchangedTasks).toHaveLength(0);
      expect(changes.deletedTasks).toHaveLength(0);
    });

    it('should identify changed tasks correctly', async () => {
      const todoistTasks: Task[] = [
        {
          id: '1',
          content: 'Updated task content',
          priority: 2,
          due: null,
          labels: [],
          project: { id: 'proj1', name: 'Project 1' },
          section: null,
          order: 1,
        } as Task,
      ];

      const markdownFiles = ['test.md'];
      
      // Mock existing hash that doesn't match current task
      const existingHashes = new Map([['1', 'old_hash_123']]);
      vi.spyOn(incrementalSyncManager as any, 'extractExistingTaskHashes')
        .mockResolvedValue(existingHashes);

      // Mock TaskFormatter to return different hash
      vi.spyOn(TaskFormatter, 'hasTaskChanged').mockReturnValue(true);

      const changes = await incrementalSyncManager.identifyChangedTasks(todoistTasks, markdownFiles);

      expect(changes.newTasks).toHaveLength(0);
      expect(changes.changedTasks).toHaveLength(1);
      expect(changes.changedTasks[0].id).toBe('1');
      expect(changes.unchangedTasks).toHaveLength(0);
      expect(changes.deletedTasks).toHaveLength(0);
    });

    it('should identify unchanged tasks correctly', async () => {
      const todoistTasks: Task[] = [
        {
          id: '1',
          content: 'Unchanged task',
          priority: 1,
          due: null,
          labels: [],
          project: { id: 'proj1', name: 'Project 1' },
          section: null,
          order: 1,
        } as Task,
      ];

      const markdownFiles = ['test.md'];
      
      // Mock existing hash that matches current task
      const existingHashes = new Map([['1', 'matching_hash_123']]);
      vi.spyOn(incrementalSyncManager as any, 'extractExistingTaskHashes')
        .mockResolvedValue(existingHashes);

      // Mock TaskFormatter to return same hash
      vi.spyOn(TaskFormatter, 'hasTaskChanged').mockReturnValue(false);

      const changes = await incrementalSyncManager.identifyChangedTasks(todoistTasks, markdownFiles);

      expect(changes.newTasks).toHaveLength(0);
      expect(changes.changedTasks).toHaveLength(0);
      expect(changes.unchangedTasks).toHaveLength(1);
      expect(changes.unchangedTasks[0].id).toBe('1');
      expect(changes.deletedTasks).toHaveLength(0);
    });

    it('should identify deleted tasks correctly', async () => {
      const todoistTasks: Task[] = []; // No tasks in Todoist

      const markdownFiles = ['test.md'];
      
      // Mock existing hash for task that no longer exists in Todoist
      const existingHashes = new Map([['deleted_task_1', 'hash_123']]);
      vi.spyOn(incrementalSyncManager as any, 'extractExistingTaskHashes')
        .mockResolvedValue(existingHashes);

      const changes = await incrementalSyncManager.identifyChangedTasks(todoistTasks, markdownFiles);

      expect(changes.newTasks).toHaveLength(0);
      expect(changes.changedTasks).toHaveLength(0);
      expect(changes.unchangedTasks).toHaveLength(0);
      expect(changes.deletedTasks).toHaveLength(1);
      expect(changes.deletedTasks[0]).toBe('deleted_task_1');
    });
  });

  describe('Hash Extraction', () => {
    it('should extract task hashes from markdown files', async () => {
      const markdownFiles = ['test.md'];
      const fileContent = `
# Test File

- [ ] Task 1 <!-- todoist:123:hash_abc -->
- [x] Task 2 <!-- todoist:456:hash_def -->
- [ ] Task without metadata
- [ ] Task 3 <!-- todoist:789:hash_ghi -->
      `;

      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue({ path: 'test.md' });
      mockPlugin.app.vault.read.mockResolvedValue(fileContent);

      // Mock TaskFormatter metadata extraction
      vi.spyOn(TaskFormatter, 'extractTodoistMetadata')
        .mockImplementation((line: string) => {
          if (line.includes('123:hash_abc')) return { id: '123', hash: 'hash_abc' };
          if (line.includes('456:hash_def')) return { id: '456', hash: 'hash_def' };
          if (line.includes('789:hash_ghi')) return { id: '789', hash: 'hash_ghi' };
          return null;
        });

      const hashes = await (incrementalSyncManager as any).extractExistingTaskHashes(markdownFiles);

      expect(hashes.size).toBe(3);
      expect(hashes.get('123')).toBe('hash_abc');
      expect(hashes.get('456')).toBe('hash_def');
      expect(hashes.get('789')).toBe('hash_ghi');
    });

    it('should handle files that cannot be read', async () => {
      const markdownFiles = ['nonexistent.md'];

      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(null);

      const hashes = await (incrementalSyncManager as any).extractExistingTaskHashes(markdownFiles);

      expect(hashes.size).toBe(0);
    });
  });

  describe('Sync Efficiency Calculation', () => {
    it('should recommend incremental sync for high efficiency', () => {
      const changes = {
        newTasks: [],
        changedTasks: [{ id: '1' }] as Task[], // 1 changed
        unchangedTasks: Array(19).fill({ id: 'unchanged' }) as Task[], // 19 unchanged
        deletedTasks: [],
      };

      const shouldUseIncremental = incrementalSyncManager.shouldUseIncrementalSync(changes);

      expect(shouldUseIncremental).toBe(true); // 5% changed (1/20) < 30% threshold
    });

    it('should recommend full sync for low efficiency', () => {
      const changes = {
        newTasks: Array(8).fill({ id: 'new' }) as Task[], // 8 new
        changedTasks: Array(2).fill({ id: 'changed' }) as Task[], // 2 changed
        unchangedTasks: Array(5).fill({ id: 'unchanged' }) as Task[], // 5 unchanged
        deletedTasks: ['deleted1', 'deleted2'], // 2 deleted
      };

      const shouldUseIncremental = incrementalSyncManager.shouldUseIncrementalSync(changes);

      expect(shouldUseIncremental).toBe(false); // 80% changed (12/15) > 30% threshold
    });

    it('should recommend full sync for small datasets', () => {
      const changes = {
        newTasks: [],
        changedTasks: [{ id: '1' }] as Task[], // 1 changed
        unchangedTasks: Array(5).fill({ id: 'unchanged' }) as Task[], // 5 unchanged
        deletedTasks: [],
      };

      const shouldUseIncremental = incrementalSyncManager.shouldUseIncrementalSync(changes);

      expect(shouldUseIncremental).toBe(false); // Total tasks (6) < 10 threshold
    });
  });

  describe('Sync Report Generation', () => {
    it('should generate comprehensive sync report', () => {
      const changes = {
        newTasks: [
          { id: '1', content: 'New task 1' },
          { id: '2', content: 'New task 2' },
        ] as Task[],
        changedTasks: [
          { id: '3', content: 'Changed task' },
        ] as Task[],
        unchangedTasks: Array(47).fill({ id: 'unchanged' }) as Task[],
        deletedTasks: ['deleted1'],
      };

      const report = incrementalSyncManager.generateSyncReport(changes);

      expect(report).toContain('📊 Incremental Sync Analysis');
      expect(report).toContain('📈 Total Tasks: 51');
      expect(report).toContain('🆕 New Tasks: 2');
      expect(report).toContain('🔄 Changed Tasks: 1');
      expect(report).toContain('✅ Unchanged Tasks: 47');
      expect(report).toContain('🗑️ Deleted Tasks: 1');
      expect(report).toContain('⚡ Sync Efficiency: 92%');
      expect(report).toContain('🎉 Excellent! Most tasks are already in sync.');
    });

    it('should show task details in report', () => {
      const changes = {
        newTasks: [
          { id: '1', content: 'This is a very long task name that should be truncated in the report' },
        ] as Task[],
        changedTasks: [],
        unchangedTasks: [],
        deletedTasks: ['deleted_task_id'],
      };

      const report = incrementalSyncManager.generateSyncReport(changes);

      expect(report).toContain('🆕 New Tasks:');
      expect(report).toContain('This is a very long task name that should be trunca...');
      expect(report).toContain('🗑️ Deleted Tasks:');
      expect(report).toContain('Task ID: deleted_task_id');
    });
  });

  describe('Task Filtering', () => {
    it('should return only tasks that need syncing', () => {
      const changes = {
        newTasks: [{ id: '1' }, { id: '2' }] as Task[],
        changedTasks: [{ id: '3' }] as Task[],
        unchangedTasks: [{ id: '4' }, { id: '5' }] as Task[],
        deletedTasks: ['deleted1'],
      };

      const tasksToSync = incrementalSyncManager.getTasksToSync(changes);

      expect(tasksToSync).toHaveLength(3);
      expect(tasksToSync.map(t => t.id)).toEqual(['1', '2', '3']);
    });
  });
});
