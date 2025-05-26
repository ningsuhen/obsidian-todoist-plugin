import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetupOrchestrator, SetupStep } from './SetupOrchestrator';
import type TodoistPlugin from '@/index';

// Mock dependencies
vi.mock('@/api', () => ({
  TodoistApiClient: vi.fn().mockImplementation(() => ({
    getProjects: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('@/api/fetcher', () => ({
  ObsidianFetcher: vi.fn()
}));

vi.mock('obsidian', () => ({
  Notice: vi.fn(),
  TFolder: vi.fn()
}));

describe('SetupOrchestrator', () => {
  let mockPlugin: Partial<TodoistPlugin>;
  let setupOrchestrator: SetupOrchestrator;

  beforeEach(() => {
    // Mock plugin with required services
    mockPlugin = {
      app: {
        vault: {
          getAbstractFileByPath: vi.fn().mockReturnValue(null),
          createFolder: vi.fn().mockResolvedValue(undefined),
          getMarkdownFiles: vi.fn().mockReturnValue([]),
          read: vi.fn().mockResolvedValue('')
        }
      } as any,
      services: {
        token: {
          write: vi.fn().mockResolvedValue(undefined),
          read: vi.fn().mockResolvedValue('test-token'),
          exists: vi.fn().mockResolvedValue(false)
        },
        todoist: {
          initialize: vi.fn().mockResolvedValue(undefined)
        }
      } as any,
      writeOptions: vi.fn().mockResolvedValue(undefined)
    };

    setupOrchestrator = new SetupOrchestrator(mockPlugin as TodoistPlugin);
  });

  describe('startSetup', () => {
    it('should complete setup successfully with valid token', async () => {
      const result = await setupOrchestrator.startSetup('valid-token');

      expect(result.success).toBe(true);
      expect(result.stepsCompleted).toBe(6);
      expect(result.stepsFailed).toBe(0);
      expect(result.configurationApplied.adhdOptimizations).toBe(true);
    });

    it('should handle invalid token gracefully', async () => {
      // Mock API client to throw error for invalid token
      vi.doMock('@/api', () => ({
        TodoistApiClient: vi.fn().mockImplementation(() => ({
          getProjects: vi.fn().mockRejectedValue(new Error('Invalid token'))
        }))
      }));

      const result = await setupOrchestrator.startSetup('invalid-token');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Invalid API token');
    });

    it('should complete setup within 2 minutes', async () => {
      const startTime = Date.now();
      await setupOrchestrator.startSetup('valid-token');
      const duration = Date.now() - startTime;

      // Should complete well under 2 minutes (120,000ms)
      expect(duration).toBeLessThan(120000);
    });

    it('should call progress callbacks during setup', async () => {
      const progressCallback = vi.fn();
      setupOrchestrator.onSetupProgress(progressCallback);

      await setupOrchestrator.startSetup('valid-token');

      // Should have called progress callback multiple times
      expect(progressCallback).toHaveBeenCalledTimes(6); // Once per step
    });

    it('should call completion callback on success', async () => {
      const completionCallback = vi.fn();
      setupOrchestrator.onSetupComplete(completionCallback);

      await setupOrchestrator.startSetup('valid-token');

      expect(completionCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          stepsCompleted: 6
        })
      );
    });
  });

  describe('ADHD-specific requirements', () => {
    it('should apply ADHD-optimized defaults', async () => {
      await setupOrchestrator.startSetup('valid-token');

      expect(mockPlugin.writeOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          fadeToggle: false, // Reduce visual distractions
          autoRefreshToggle: true, // Keep data fresh automatically
          autoRefreshInterval: 30, // More frequent updates
          enableDopamineFeedback: true,
          cognitiveLoadReduction: true,
          zeroConfigMode: true
        })
      );
    });

    it('should create organized folder structure', async () => {
      await setupOrchestrator.startSetup('valid-token');

      expect(mockPlugin.app.vault.createFolder).toHaveBeenCalledWith('Todoist');
      expect(mockPlugin.app.vault.createFolder).toHaveBeenCalledWith('Todoist/Personal');
      expect(mockPlugin.app.vault.createFolder).toHaveBeenCalledWith('Todoist/Work');
      expect(mockPlugin.app.vault.createFolder).toHaveBeenCalledWith('Todoist/Projects');
    });

    it('should provide clear progress feedback', async () => {
      const progressCallback = vi.fn();
      setupOrchestrator.onSetupProgress(progressCallback);

      await setupOrchestrator.startSetup('valid-token');

      // Check that progress updates include ADHD-friendly descriptions
      const progressCalls = progressCallback.mock.calls;
      expect(progressCalls.some(call => 
        call[0].currentOperation.includes('ADHD-optimized')
      )).toBe(true);
    });

    it('should handle errors with ADHD-friendly messaging', async () => {
      // Mock folder creation to fail
      mockPlugin.app.vault.createFolder = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const errorCallback = vi.fn();
      setupOrchestrator.onSetupError(errorCallback);

      await setupOrchestrator.startSetup('valid-token');

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          recoverable: true,
          userAction: expect.stringContaining('Please')
        })
      );
    });
  });

  describe('migration functionality', () => {
    it('should detect existing Obsidian Tasks plugin data', async () => {
      // Mock vault with existing task files
      mockPlugin.app.vault.getMarkdownFiles = vi.fn().mockReturnValue([
        { path: 'test.md' }
      ]);
      mockPlugin.app.vault.read = vi.fn().mockResolvedValue(`
        # Test Note
        - [ ] Task 1
        - [x] Task 2
        - [ ] Task 3
      `);

      const result = await setupOrchestrator.startSetup('valid-token');

      expect(result.migrationResults?.tasksImported).toBe(3);
      expect(result.migrationResults?.dataSource).toBe('Obsidian Tasks Plugin');
    });

    it('should handle migration gracefully when no existing data', async () => {
      const result = await setupOrchestrator.startSetup('valid-token');

      expect(result.migrationResults?.tasksImported).toBe(0);
      expect(result.migrationResults?.dataSource).toBe('');
    });
  });

  describe('performance requirements', () => {
    it('should provide progress updates within reasonable intervals', async () => {
      const progressCallback = vi.fn();
      setupOrchestrator.onSetupProgress(progressCallback);

      const startTime = Date.now();
      await setupOrchestrator.startSetup('valid-token');

      // Check that progress updates happened at reasonable intervals
      const progressCalls = progressCallback.mock.calls;
      expect(progressCalls.length).toBeGreaterThan(0);
      
      // Each step should complete reasonably quickly
      for (let i = 1; i < progressCalls.length; i++) {
        const timeBetweenUpdates = progressCalls[i][0].estimatedTimeRemaining - 
                                  progressCalls[i-1][0].estimatedTimeRemaining;
        expect(Math.abs(timeBetweenUpdates)).toBeLessThan(60); // Less than 60 seconds between updates
      }
    });

    it('should maintain accurate progress percentage', async () => {
      const progressCallback = vi.fn();
      setupOrchestrator.onSetupProgress(progressCallback);

      await setupOrchestrator.startSetup('valid-token');

      const progressCalls = progressCallback.mock.calls;
      
      // Progress should increase monotonically
      for (let i = 1; i < progressCalls.length; i++) {
        const currentProgress = progressCalls[i][0].progressPercentage;
        const previousProgress = progressCalls[i-1][0].progressPercentage;
        expect(currentProgress).toBeGreaterThanOrEqual(previousProgress);
      }

      // Final progress should be 100%
      const finalProgress = progressCalls[progressCalls.length - 1][0].progressPercentage;
      expect(finalProgress).toBe(100);
    });
  });

  describe('error recovery', () => {
    it('should provide actionable error messages', async () => {
      // Mock token validation to fail
      vi.doMock('@/api', () => ({
        TodoistApiClient: vi.fn().mockImplementation(() => ({
          getProjects: vi.fn().mockRejectedValue(new Error('Network error'))
        }))
      }));

      const result = await setupOrchestrator.startSetup('invalid-token');

      expect(result.errors[0]).toMatchObject({
        recoverable: true,
        userAction: expect.stringContaining('try again')
      });
    });

    it('should handle partial failures gracefully', async () => {
      // Mock folder creation to fail for some folders
      let callCount = 0;
      mockPlugin.app.vault.createFolder = vi.fn().mockImplementation((path) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Permission denied');
        }
        return Promise.resolve();
      });

      const result = await setupOrchestrator.startSetup('valid-token');

      // Should still attempt to complete other steps
      expect(result.stepsCompleted).toBeGreaterThan(0);
    });
  });
});
