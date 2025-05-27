import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TodoistBackupManager } from '../TodoistBackupManager';
import type TodoistPlugin from '@/index';

// Mock the plugin and its dependencies
const mockPlugin = {
  app: {
    vault: {
      create: vi.fn(),
      getAbstractFileByPath: vi.fn(),
      read: vi.fn(),
      adapter: {
        list: vi.fn(),
      },
    },
  },
  services: {
    todoist: {
      data: vi.fn(() => ({
        tasks: {
          iter: vi.fn(),
        },
        projects: {
          iter: vi.fn(),
        },
        sections: {
          iter: vi.fn(),
        },
        labels: {
          iter: vi.fn(),
        },
      })),
    },
  },
} as unknown as TodoistPlugin;

describe('TodoistBackupManager', () => {
  let backupManager: TodoistBackupManager;

  beforeEach(() => {
    vi.clearAllMocks();
    backupManager = new TodoistBackupManager(mockPlugin);
  });

  describe('Backup Creation', () => {
    it('should create comprehensive backup with all data types', async () => {
      const mockTasks = [
        { id: '1', content: 'Task 1', project: { id: 'proj1' } },
        { id: '2', content: 'Task 2', project: { id: 'proj2' } },
      ];

      const mockProjects = [
        { id: 'proj1', name: 'Project 1', parentId: null },
        { id: 'proj2', name: 'Project 2', parentId: 'proj1' },
      ];

      const mockSections = [
        { id: 'sec1', name: 'Section 1', projectId: 'proj1' },
      ];

      const mockLabels = [
        { id: 'label1', name: 'urgent', color: 'red' },
      ];

      // Mock data fetching
      mockPlugin.services.todoist.data().tasks.iter.mockReturnValue(mockTasks);
      mockPlugin.services.todoist.data().projects.iter.mockReturnValue(mockProjects);
      mockPlugin.services.todoist.data().sections.iter.mockReturnValue(mockSections);
      mockPlugin.services.todoist.data().labels.iter.mockReturnValue(mockLabels);

      // Mock file creation
      mockPlugin.app.vault.create.mockResolvedValue({ path: 'backup.json' });

      const result = await backupManager.createPreSyncBackup();

      expect(result.success).toBe(true);
      expect(result.backupFile).toContain('backup-');
      expect(result.backupFile).toContain('.json');

      // Verify backup content structure
      const createCall = mockPlugin.app.vault.create.mock.calls[0];
      const backupContent = JSON.parse(createCall[1]);

      expect(backupContent.metadata.version).toBe('3.0.0');
      expect(backupContent.metadata.timestamp).toBeTruthy();
      expect(backupContent.metadata.type).toBe('pre-sync-backup');

      expect(backupContent.data.tasks).toEqual(mockTasks);
      expect(backupContent.data.projects).toEqual(mockProjects);
      expect(backupContent.data.sections).toEqual(mockSections);
      expect(backupContent.data.labels).toEqual(mockLabels);
    });

    it('should handle backup creation failure gracefully', async () => {
      // Mock data fetching to succeed
      mockPlugin.services.todoist.data().tasks.iter.mockReturnValue([]);
      mockPlugin.services.todoist.data().projects.iter.mockReturnValue([]);
      mockPlugin.services.todoist.data().sections.iter.mockReturnValue([]);
      mockPlugin.services.todoist.data().labels.iter.mockReturnValue([]);

      // Mock file creation to fail
      mockPlugin.app.vault.create.mockRejectedValue(new Error('Disk full'));

      const result = await backupManager.createPreSyncBackup();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Disk full');
      expect(result.backupFile).toBe('');
    });

    it('should handle data fetching failure gracefully', async () => {
      // Mock data fetching to fail
      mockPlugin.services.todoist.data().tasks.iter.mockImplementation(() => {
        throw new Error('API error');
      });

      const result = await backupManager.createPreSyncBackup();

      expect(result.success).toBe(false);
      expect(result.error).toContain('API error');
    });
  });

  describe('Backup File Management', () => {
    it('should generate unique backup filenames', async () => {
      const filename1 = (backupManager as any).generateBackupFilename();
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const filename2 = (backupManager as any).generateBackupFilename();

      expect(filename1).not.toBe(filename2);
      expect(filename1).toMatch(/^📋 01-PRODUCTIVITY\/todoist-integration\/⚙️ System\/backup-\d{13}\.json$/);
      expect(filename2).toMatch(/^📋 01-PRODUCTIVITY\/todoist-integration\/⚙️ System\/backup-\d{13}\.json$/);
    });

    it('should list existing backup files', async () => {
      const mockFiles = [
        { path: '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/backup-1234567890123.json' },
        { path: '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/backup-1234567890124.json' },
        { path: '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/other-file.txt' },
      ];

      mockPlugin.app.vault.adapter.list.mockResolvedValue({
        files: mockFiles.map(f => f.path),
        folders: [],
      });

      const backupFiles = await backupManager.listBackupFiles();

      expect(backupFiles).toHaveLength(2);
      expect(backupFiles[0]).toContain('backup-1234567890123.json');
      expect(backupFiles[1]).toContain('backup-1234567890124.json');
    });

    it('should handle missing backup directory gracefully', async () => {
      mockPlugin.app.vault.adapter.list.mockRejectedValue(new Error('Directory not found'));

      const backupFiles = await backupManager.listBackupFiles();

      expect(backupFiles).toEqual([]);
    });
  });

  describe('Backup Validation', () => {
    it('should validate backup file structure', async () => {
      const validBackup = {
        metadata: {
          version: '3.0.0',
          timestamp: new Date().toISOString(),
          type: 'pre-sync-backup',
        },
        data: {
          tasks: [],
          projects: [],
          sections: [],
          labels: [],
        },
      };

      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue({ path: 'backup.json' });
      mockPlugin.app.vault.read.mockResolvedValue(JSON.stringify(validBackup));

      const isValid = await backupManager.validateBackup('backup.json');

      expect(isValid).toBe(true);
    });

    it('should reject invalid backup structure', async () => {
      const invalidBackup = {
        metadata: {
          version: '3.0.0',
          // Missing timestamp and type
        },
        // Missing data section
      };

      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue({ path: 'backup.json' });
      mockPlugin.app.vault.read.mockResolvedValue(JSON.stringify(invalidBackup));

      const isValid = await backupManager.validateBackup('backup.json');

      expect(isValid).toBe(false);
    });

    it('should handle corrupted backup files', async () => {
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue({ path: 'backup.json' });
      mockPlugin.app.vault.read.mockResolvedValue('invalid json content');

      const isValid = await backupManager.validateBackup('backup.json');

      expect(isValid).toBe(false);
    });

    it('should handle missing backup files', async () => {
      mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(null);

      const isValid = await backupManager.validateBackup('nonexistent.json');

      expect(isValid).toBe(false);
    });
  });

  describe('Backup Cleanup', () => {
    it('should clean up old backup files', async () => {
      const now = Date.now();
      const oldBackups = [
        `backup-${now - 8 * 24 * 60 * 60 * 1000}.json`, // 8 days old
        `backup-${now - 15 * 24 * 60 * 60 * 1000}.json`, // 15 days old
      ];
      const recentBackups = [
        `backup-${now - 1 * 24 * 60 * 60 * 1000}.json`, // 1 day old
        `backup-${now - 3 * 24 * 60 * 60 * 1000}.json`, // 3 days old
      ];

      const allBackups = [...oldBackups, ...recentBackups].map(
        name => `📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/${name}`
      );

      mockPlugin.app.vault.adapter.list.mockResolvedValue({
        files: allBackups,
        folders: [],
      });

      // Mock file deletion
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      mockPlugin.app.vault.delete = mockDelete;
      mockPlugin.app.vault.getAbstractFileByPath.mockImplementation((path: string) => ({ path }));

      const deletedCount = await backupManager.cleanupOldBackups(7); // Keep 7 days

      expect(deletedCount).toBe(2); // Should delete 2 old backups
      expect(mockDelete).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockPlugin.app.vault.adapter.list.mockRejectedValue(new Error('Permission denied'));

      const deletedCount = await backupManager.cleanupOldBackups(7);

      expect(deletedCount).toBe(0);
    });
  });

  describe('Backup Statistics', () => {
    it('should provide backup statistics', async () => {
      const mockBackups = [
        '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/backup-1234567890123.json',
        '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/backup-1234567890124.json',
        '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/backup-1234567890125.json',
      ];

      mockPlugin.app.vault.adapter.list.mockResolvedValue({
        files: mockBackups,
        folders: [],
      });

      const stats = await backupManager.getBackupStatistics();

      expect(stats.totalBackups).toBe(3);
      expect(stats.oldestBackup).toContain('backup-1234567890123.json');
      expect(stats.newestBackup).toContain('backup-1234567890125.json');
      expect(stats.totalSizeBytes).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty backup directory', async () => {
      mockPlugin.app.vault.adapter.list.mockResolvedValue({
        files: [],
        folders: [],
      });

      const stats = await backupManager.getBackupStatistics();

      expect(stats.totalBackups).toBe(0);
      expect(stats.oldestBackup).toBe('');
      expect(stats.newestBackup).toBe('');
      expect(stats.totalSizeBytes).toBe(0);
    });
  });
});
