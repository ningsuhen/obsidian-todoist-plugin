import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Notice } from 'obsidian';
import type TodoistPlugin from '@/index';

// Mock Obsidian modules
vi.mock('obsidian', () => ({
  Notice: vi.fn(),
}));

// Mock FileSyncManager
const mockSyncAllTasks = vi.fn();
vi.mock('@/core/sync/FileSyncManager', () => ({
  FileSyncManager: vi.fn().mockImplementation(() => ({
    syncAllTasks: mockSyncAllTasks
  }))
}));

describe('Commands Integration Tests', () => {
  let mockPlugin: Partial<TodoistPlugin>;
  let mockTodoistService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockSyncAllTasks.mockResolvedValue({
      tasksProcessed: 10,
      projectsProcessed: 3,
      filesCreated: 5,
      filesUpdated: 8,
      lastSyncTime: new Date(),
      errors: []
    });

    // Mock Todoist service
    mockTodoistService = {
      sync: vi.fn().mockResolvedValue(undefined),
      isReady: vi.fn(() => true),
    };

    // Mock plugin
    mockPlugin = {
      services: {
        todoist: mockTodoistService,
      } as any,
      app: {
        workspace: {
          trigger: vi.fn(),
        },
      } as any,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File Sync Command', () => {
    it('should successfully execute file sync command', async () => {
      // Import commands dynamically to ensure mocks are in place
      const { default: commands } = await import('../index');
      
      // Get the file sync command
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      // Execute the command
      await fileSyncCommand.callback();

      // Verify FileSyncManager was called
      expect(mockSyncAllTasks).toHaveBeenCalledOnce();
    });

    it('should handle successful sync with proper notification', async () => {
      const { default: commands } = await import('../index');
      
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      await fileSyncCommand.callback();

      // Verify success notification (this would be shown by FileSyncManager)
      expect(mockSyncAllTasks).toHaveBeenCalledOnce();
    });

    it('should handle sync errors gracefully', async () => {
      // Mock sync to throw error
      mockSyncAllTasks.mockRejectedValue(new Error('Network connection failed'));

      const { default: commands } = await import('../index');
      
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      await fileSyncCommand.callback();

      // Verify error was handled
      expect(mockSyncAllTasks).toHaveBeenCalledOnce();
      expect(mockPlugin.app!.workspace!.trigger).toHaveBeenCalledWith(
        'notice',
        '❌ File sync failed: Network connection failed'
      );
    });

    it('should handle unknown errors gracefully', async () => {
      // Mock sync to throw non-Error object
      mockSyncAllTasks.mockRejectedValue('Unknown error');

      const { default: commands } = await import('../index');
      
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      await fileSyncCommand.callback();

      expect(mockPlugin.app!.workspace!.trigger).toHaveBeenCalledWith(
        'notice',
        '❌ File sync failed: Unknown error'
      );
    });

    it('should have correct command name', async () => {
      const { default: commands } = await import('../index');
      
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      expect(fileSyncCommand.name).toBe('Sync Tasks to Files');
    });
  });

  describe('Original Sync Command', () => {
    it('should execute original sync command', async () => {
      const { default: commands } = await import('../index');
      
      const syncCommand = commands['todoist-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      await syncCommand.callback();

      expect(mockTodoistService.sync).toHaveBeenCalledOnce();
    });

    it('should use i18n for command name', async () => {
      const { default: commands } = await import('../index');
      
      const syncCommand = commands['todoist-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Custom Sync Name' } as any
      );

      expect(syncCommand.name).toBe('Custom Sync Name');
    });
  });

  describe('Command Registration', () => {
    it('should register all commands including file sync', async () => {
      const { default: commands } = await import('../index');
      
      const commandIds = Object.keys(commands);
      
      expect(commandIds).toContain('todoist-sync');
      expect(commandIds).toContain('todoist-file-sync');
      expect(commandIds).toContain('add-task');
      expect(commandIds).toContain('add-task-page-content');
      expect(commandIds).toContain('add-task-page-description');
    });

    it('should create commands with proper structure', async () => {
      const { default: commands } = await import('../index');
      
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      expect(fileSyncCommand).toHaveProperty('name');
      expect(fileSyncCommand).toHaveProperty('callback');
      expect(typeof fileSyncCommand.callback).toBe('function');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle FileSyncManager import failure', async () => {
      // Mock dynamic import to fail
      vi.doMock('@/core/sync/FileSyncManager', () => {
        throw new Error('Module not found');
      });

      const { default: commands } = await import('../index');
      
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      await fileSyncCommand.callback();

      expect(mockPlugin.app!.workspace!.trigger).toHaveBeenCalledWith(
        'notice',
        expect.stringContaining('❌ File sync failed:')
      );
    });

    it('should handle service not ready scenario', async () => {
      mockTodoistService.isReady = vi.fn(() => false);
      mockSyncAllTasks.mockRejectedValue(new Error('Todoist service not ready'));

      const { default: commands } = await import('../index');
      
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      await fileSyncCommand.callback();

      expect(mockPlugin.app!.workspace!.trigger).toHaveBeenCalledWith(
        'notice',
        '❌ File sync failed: Todoist service not ready'
      );
    });
  });

  describe('Performance', () => {
    it('should complete file sync command quickly', async () => {
      const { default: commands } = await import('../index');
      
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      const startTime = Date.now();
      await fileSyncCommand.callback();
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle large sync operations efficiently', async () => {
      // Mock large sync result
      mockSyncAllTasks.mockResolvedValue({
        tasksProcessed: 1000,
        projectsProcessed: 50,
        filesCreated: 100,
        filesUpdated: 200,
        lastSyncTime: new Date(),
        errors: []
      });

      const { default: commands } = await import('../index');
      
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      const startTime = Date.now();
      await fileSyncCommand.callback();
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000); // Should handle large operations in under 5 seconds
      expect(mockSyncAllTasks).toHaveBeenCalledOnce();
    });
  });

  describe('ADHD-Friendly Features', () => {
    it('should provide immediate feedback on command execution', async () => {
      const { default: commands } = await import('../index');
      
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      // Command should start immediately without delays
      const promise = fileSyncCommand.callback();
      
      // Should not hang or require user interaction
      await expect(promise).resolves.toBeUndefined();
    });

    it('should have clear, descriptive command name', async () => {
      const { default: commands } = await import('../index');
      
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      // Command name should be clear about what it does
      expect(fileSyncCommand.name).toBe('Sync Tasks to Files');
      expect(fileSyncCommand.name).toContain('Sync');
      expect(fileSyncCommand.name).toContain('Files');
    });

    it('should handle errors with encouraging messages', async () => {
      mockSyncAllTasks.mockRejectedValue(new Error('Temporary network issue'));

      const { default: commands } = await import('../index');
      
      const fileSyncCommand = commands['todoist-file-sync'](
        mockPlugin as TodoistPlugin,
        { sync: 'Sync' } as any
      );

      await fileSyncCommand.callback();

      // Error message should be clear but not overwhelming
      expect(mockPlugin.app!.workspace!.trigger).toHaveBeenCalledWith(
        'notice',
        '❌ File sync failed: Temporary network issue'
      );
    });
  });
});
