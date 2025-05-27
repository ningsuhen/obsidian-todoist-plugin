import type TodoistPlugin from '@/index';
import { Notice, TFile, TFolder, Vault } from 'obsidian';
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupOrchestrator } from '../SetupOrchestrator';

// Mock Obsidian modules
vi.mock('obsidian', () => ({
  Notice: vi.fn(),
  TFile: vi.fn(),
  TFolder: vi.fn(),
}));

// Mock API client and fetcher
vi.mock('@/api', () => ({
  TodoistApiClient: vi.fn().mockImplementation(() => ({
    getProjects: vi.fn().mockResolvedValue([]),
    getTasks: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/api/fetcher', () => ({
  ObsidianFetcher: vi.fn().mockImplementation(() => ({})),
}));

// Mock FileSyncManager
vi.mock('@/core/sync/FileSyncManager', () => ({
  FileSyncManager: vi.fn().mockImplementation(() => ({
    initializeDirectoryStructure: vi.fn().mockResolvedValue(undefined),
    syncAllTasks: vi.fn().mockResolvedValue({
      tasksProcessed: 5,
      projectsProcessed: 2,
      filesCreated: 8,
      filesUpdated: 3,
      lastSyncTime: new Date(),
      errors: []
    })
  }))
}));

describe('SetupOrchestrator Integration Tests', () => {
  let setupOrchestrator: SetupOrchestrator;
  let mockPlugin: Partial<TodoistPlugin>;
  let mockVault: Partial<Vault>;
  let mockServices: any;
  let createdFiles: Map<string, string>;
  let createdFolders: Set<string>;
  let progressCallbacks: Function[];
  let completionCallbacks: Function[];
  let errorCallbacks: Function[];

  beforeEach(() => {
    vi.clearAllMocks();
    createdFiles = new Map();
    createdFolders = new Set();
    progressCallbacks = [];
    completionCallbacks = [];
    errorCallbacks = [];

    // Mock vault operations
    mockVault = {
      getAbstractFileByPath: vi.fn((path: string) => {
        if (createdFolders.has(path)) {
          return { path } as TFolder;
        }
        if (createdFiles.has(path)) {
          return { path } as TFile;
        }
        return null;
      }),
      createFolder: vi.fn(async (path: string) => {
        createdFolders.add(path);
        return { path } as TFolder;
      }),
      create: vi.fn(async (path: string, content: string) => {
        createdFiles.set(path, content);
        return { path, content } as any;
      }),
      getMarkdownFiles: vi.fn(() => []),
      read: vi.fn(async (file: TFile) => ''),
    };

    // Mock services
    mockServices = {
      token: {
        write: vi.fn().mockResolvedValue(undefined),
      },
      todoist: {
        initialize: vi.fn().mockResolvedValue(undefined),
        isReady: vi.fn(() => true),
      },
    };

    // Mock plugin
    mockPlugin = {
      app: {
        vault: mockVault as Vault,
      } as any,
      services: mockServices,
      writeOptions: vi.fn().mockResolvedValue(undefined),
    };

    setupOrchestrator = new SetupOrchestrator(mockPlugin as TodoistPlugin);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Setup Flow', () => {
    it('should complete full ADHD-optimized setup successfully', async () => {
      const validToken = 'valid-api-token-12345';
      let finalResult: any = null;
      let progressUpdates: any[] = [];

      // Set up callbacks to capture events
      setupOrchestrator.onSetupProgress((progress) => {
        progressUpdates.push({ ...progress });
      });

      setupOrchestrator.onSetupComplete((result) => {
        finalResult = result;
      });

      // Run the complete setup
      const result = await setupOrchestrator.runSetup(validToken);

      // Verify successful completion
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stepsCompleted).toBeGreaterThan(0);
      expect(result.completionTime).toBeGreaterThan(0);

      // Verify ADHD configuration was applied
      expect(result.configurationApplied).toEqual({
        adhdOptimizations: true,
        folderStructure: '📋 01-PRODUCTIVITY/todoist-integration/',
        defaultsApplied: ['cognitive_load_reduction', 'dopamine_feedback', 'zero_config']
      });

      // Verify progress updates were sent
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].progressPercentage).toBe(100);
    });

    it('should create complete folder structure during setup', async () => {
      const validToken = 'valid-api-token-12345';

      await setupOrchestrator.runSetup(validToken);

      // Verify main integration folder structure
      const expectedFolders = [
        '📋 01-PRODUCTIVITY',
        '📋 01-PRODUCTIVITY/todoist-integration',
        '📋 01-PRODUCTIVITY/todoist-integration/🗂️ Projects',
        '📋 01-PRODUCTIVITY/todoist-integration/🏷️ Labels',
        '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System',
        '📋 01-PRODUCTIVITY/todoist-integration/📁 Local',
      ];

      expectedFolders.forEach(folder => {
        expect(createdFolders.has(folder)).toBe(true);
      });

      // Verify backward compatibility folders
      const backwardCompatFolders = [
        '📋 01-PRODUCTIVITY/todoist-integration/p0-priority-tasks',
        '📋 01-PRODUCTIVITY/todoist-integration/project-contexts',
        '📋 01-PRODUCTIVITY/todoist-integration/tasks-inbox',
        '📋 01-PRODUCTIVITY/todoist-integration/all-tasks-local',
        '📋 01-PRODUCTIVITY/todoist-integration/task-templates',
      ];

      backwardCompatFolders.forEach(folder => {
        expect(createdFolders.has(folder)).toBe(true);
      });
    });

    it('should create initial Todoist-like files during setup', async () => {
      const validToken = 'valid-api-token-12345';

      await setupOrchestrator.runSetup(validToken);

      // Verify main Todoist files were created
      const expectedFiles = [
        '📋 01-PRODUCTIVITY/todoist-integration/📥 Inbox.md',
        '📋 01-PRODUCTIVITY/todoist-integration/📅 Today.md',
        '📋 01-PRODUCTIVITY/todoist-integration/📆 Upcoming.md',
        '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/Sync Status.md',
        '📋 01-PRODUCTIVITY/todoist-integration/.agent-guidelines.md',
        '📋 01-PRODUCTIVITY/todoist-integration/📁 Local/Welcome.md',
      ];

      expectedFiles.forEach(file => {
        expect(createdFiles.has(file)).toBe(true);
      });

      // Verify file content is ADHD-optimized
      const inboxContent = createdFiles.get('📋 01-PRODUCTIVITY/todoist-integration/📥 Inbox.md')!;
      expect(inboxContent).toContain('# 📥 Inbox');
      expect(inboxContent).toContain('ADHD-Optimized Todoist Plugin');
      expect(inboxContent).toContain('*No tasks in inbox*');

      const todayContent = createdFiles.get('📋 01-PRODUCTIVITY/todoist-integration/📅 Today.md')!;
      expect(todayContent).toContain('# 📅 Today');
      expect(todayContent).toContain('*No tasks due today*');

      const statusContent = createdFiles.get('📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/Sync Status.md')!;
      expect(statusContent).toContain('# ⚙️ Sync Status');
      expect(statusContent).toContain('✅ Setup Complete');
      expect(statusContent).toContain('**ADHD Mode:** Enabled');
    });

    it('should apply ADHD-optimized settings during setup', async () => {
      const validToken = 'valid-api-token-12345';

      await setupOrchestrator.runSetup(validToken);

      // Verify ADHD settings were applied
      expect(mockPlugin.writeOptions).toHaveBeenCalledWith({
        fadeToggle: false,
        autoRefreshToggle: true,
        autoRefreshInterval: 30,
        renderDateIcon: true,
        renderProjectIcon: true,
        renderLabelsIcon: true,
        shouldWrapLinksInParens: false,
        addTaskButtonAddsPageLink: 'content',
        debugLogging: false,
        enableDopamineFeedback: true,
        enableHyperfocusProtection: true,
        cognitiveLoadReduction: true,
        zeroConfigMode: true
      });
    });

    it('should handle existing folder structure gracefully', async () => {
      // Pre-create some folders to simulate existing structure
      createdFolders.add('📋 01-PRODUCTIVITY');
      createdFolders.add('📋 01-PRODUCTIVITY/todoist-integration');
      createdFolders.add('📋 01-PRODUCTIVITY/todoist-integration/p0-priority-tasks');

      const validToken = 'valid-api-token-12345';

      const result = await setupOrchestrator.runSetup(validToken);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Should still create new folders
      expect(createdFolders.has('📋 01-PRODUCTIVITY/todoist-integration/🗂️ Projects')).toBe(true);
    });

    it('should perform initial file sync after setup', async () => {
      const validToken = 'valid-api-token-12345';

      const result = await setupOrchestrator.runSetup(validToken);

      expect(result.success).toBe(true);

      // Verify FileSyncManager was called during setup
      const { FileSyncManager } = await import('@/core/sync/FileSyncManager');
      expect(FileSyncManager).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid API token gracefully', async () => {
      // Mock API client to throw error for invalid token
      const { TodoistApiClient } = await import('@/api');
      (TodoistApiClient as any).mockImplementation(() => ({
        getProjects: vi.fn().mockRejectedValue(new Error('Invalid token')),
      }));

      const invalidToken = 'invalid-token';

      const result = await setupOrchestrator.runSetup(invalidToken);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Invalid API token');
      expect(result.errors[0].code).toBe('SETUP_FAILED');
      expect(result.errors[0].recoverable).toBe(true);
    });

    it('should handle folder creation errors gracefully', async () => {
      // Mock vault to throw error on folder creation
      mockVault.createFolder = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const validToken = 'valid-api-token-12345';

      const result = await setupOrchestrator.runSetup(validToken);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Failed to create folder structure');
    });

    it('should continue setup even if file sync fails', async () => {
      // Mock FileSyncManager to throw error
      const { FileSyncManager } = await import('@/core/sync/FileSyncManager');
      (FileSyncManager as any).mockImplementation(() => ({
        syncAllTasks: vi.fn().mockRejectedValue(new Error('Sync failed'))
      }));

      const validToken = 'valid-api-token-12345';

      const result = await setupOrchestrator.runSetup(validToken);

      // Setup should still succeed even if file sync fails
      expect(result.success).toBe(true);
      // File sync error should be logged but not fail setup
    });
  });

  describe('Progress Tracking', () => {
    it('should provide detailed progress updates throughout setup', async () => {
      const validToken = 'valid-api-token-12345';
      const progressUpdates: any[] = [];

      setupOrchestrator.onSetupProgress((progress) => {
        progressUpdates.push({ ...progress });
      });

      await setupOrchestrator.runSetup(validToken);

      // Verify we got multiple progress updates
      expect(progressUpdates.length).toBeGreaterThan(3);

      // Verify progress increases over time
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].progressPercentage).toBeGreaterThanOrEqual(
          progressUpdates[i - 1].progressPercentage
        );
      }

      // Verify final progress is 100%
      const finalProgress = progressUpdates[progressUpdates.length - 1];
      expect(finalProgress.progressPercentage).toBe(100);
      expect(finalProgress.estimatedTimeRemaining).toBe(0);
    });

    it('should include ADHD-friendly step descriptions', async () => {
      const validToken = 'valid-api-token-12345';
      const progressUpdates: any[] = [];

      setupOrchestrator.onSetupProgress((progress) => {
        progressUpdates.push({ ...progress });
      });

      await setupOrchestrator.runSetup(validToken);

      // Verify step descriptions are encouraging and clear
      const descriptions = progressUpdates.map(p => p.currentOperation);

      expect(descriptions).toContain('Validating your Todoist connection...');
      expect(descriptions).toContain('Enhancing your existing todoist-integration folder...');
      expect(descriptions).toContain('Applying ADHD-optimized settings...');
      expect(descriptions).toContain('Starting your sync engine...');
      expect(descriptions).toContain('Creating your Todoist-like files...');
    });
  });

  describe('ADHD Optimizations', () => {
    it('should complete setup in under 2 minutes', async () => {
      const validToken = 'valid-api-token-12345';
      const startTime = Date.now();

      const result = await setupOrchestrator.runSetup(validToken);
      const endTime = Date.now();
      const setupTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(setupTime).toBeLessThan(120000); // 2 minutes in milliseconds
      expect(result.completionTime).toBeLessThan(120000);
    });

    it('should show encouraging success message', async () => {
      const validToken = 'valid-api-token-12345';

      await setupOrchestrator.runSetup(validToken);

      // Verify encouraging Notice was shown
      expect(Notice).toHaveBeenCalledWith(
        '🎉 Setup complete! Your ADHD-optimized Todoist plugin is ready to use.',
        5000
      );
    });

    it('should provide zero-configuration experience', async () => {
      const validToken = 'valid-api-token-12345';

      const result = await setupOrchestrator.runSetup(validToken);

      expect(result.success).toBe(true);

      // Verify no additional user input was required
      expect(result.configurationApplied.defaultsApplied).toContain('zero_config');
      expect(result.configurationApplied.adhdOptimizations).toBe(true);
    });
  });
});
