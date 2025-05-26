import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { TFile, TFolder, Vault } from 'obsidian';
import { FileSyncManager } from '../FileSyncManager';
import type TodoistPlugin from '@/index';
import type { Task } from '@/data/task';

// Mock Obsidian modules
vi.mock('obsidian', () => ({
  Notice: vi.fn(),
  TFile: vi.fn(),
  TFolder: vi.fn(),
}));

// Mock data for testing
const mockTasks: Task[] = [
  {
    id: '1',
    createdAt: '2024-05-26T10:00:00Z',
    content: 'Buy groceries',
    description: 'Get milk, bread, and eggs',
    project: { id: 'inbox', name: 'Inbox', order: 0, parentId: null, isInboxProject: true, color: 'grey' },
    section: undefined,
    parentId: null,
    labels: [{ id: 'urgent', name: 'urgent', color: 'red', order: 0 }],
    priority: 4, // P1 - Urgent
    due: { date: '2024-05-26', datetime: null, string: 'today', timezone: null },
    duration: null,
    order: 1,
  },
  {
    id: '2',
    createdAt: '2024-05-26T11:00:00Z',
    content: 'Review project proposal',
    description: '',
    project: { id: 'work', name: 'Work Project', order: 1, parentId: null, isInboxProject: false, color: 'blue' },
    section: { id: 'planning', name: 'Planning', order: 0, projectId: 'work' },
    parentId: null,
    labels: [],
    priority: 3, // P2 - High
    due: { date: '2024-05-27', datetime: null, string: 'tomorrow', timezone: null },
    duration: null,
    order: 2,
  },
  {
    id: '3',
    createdAt: '2024-05-26T12:00:00Z',
    content: 'Update documentation',
    description: '',
    project: { id: 'work', name: 'Work Project', order: 1, parentId: null, isInboxProject: false, color: 'blue' },
    section: undefined,
    parentId: null,
    labels: [{ id: 'waiting', name: 'waiting', color: 'yellow', order: 1 }],
    priority: 1, // P4 - Low
    due: null,
    duration: null,
    order: 3,
  },
];

describe('FileSyncManager Integration Tests', () => {
  let fileSyncManager: FileSyncManager;
  let mockPlugin: Partial<TodoistPlugin>;
  let mockVault: Partial<Vault>;
  let mockTodoistService: any;
  let createdFiles: Map<string, string>;
  let createdFolders: Set<string>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    createdFiles = new Map();
    createdFolders = new Set();

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
      modify: vi.fn(async (file: TFile, content: string) => {
        createdFiles.set(file.path, content);
      }),
    };

    // Mock Todoist service
    mockTodoistService = {
      isReady: vi.fn(() => true),
      subscribe: vi.fn((filter: string, callback: Function) => {
        // Simulate successful data fetch
        setTimeout(() => {
          callback({
            type: 'success',
            data: mockTasks
          });
        }, 100);
        
        return [
          vi.fn(), // unsubscribe
          vi.fn()  // refresh
        ];
      }),
    };

    // Mock plugin
    mockPlugin = {
      app: {
        vault: mockVault as Vault,
      } as any,
      services: {
        todoist: mockTodoistService,
      } as any,
    };

    fileSyncManager = new FileSyncManager(mockPlugin as TodoistPlugin);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('syncAllTasks', () => {
    it('should successfully sync all tasks and create files', async () => {
      const stats = await fileSyncManager.syncAllTasks();

      expect(stats.tasksProcessed).toBe(3);
      expect(stats.projectsProcessed).toBe(1); // Work Project
      expect(stats.filesUpdated).toBeGreaterThan(0);
      expect(stats.errors).toHaveLength(0);
      expect(stats.lastSyncTime).toBeInstanceOf(Date);
    });

    it('should create Inbox.md with inbox tasks', async () => {
      await fileSyncManager.syncAllTasks();

      const inboxPath = '📋 01-PRODUCTIVITY/todoist-integration/📥 Inbox.md';
      expect(createdFiles.has(inboxPath)).toBe(true);
      
      const inboxContent = createdFiles.get(inboxPath)!;
      expect(inboxContent).toContain('# 📥 Inbox');
      expect(inboxContent).toContain('Buy groceries');
      expect(inboxContent).toContain('🔴'); // Priority indicator
      expect(inboxContent).toContain('#urgent'); // Label
    });

    it('should create Today.md with today\'s tasks', async () => {
      await fileSyncManager.syncAllTasks();

      const todayPath = '📋 01-PRODUCTIVITY/todoist-integration/📅 Today.md';
      expect(createdFiles.has(todayPath)).toBe(true);
      
      const todayContent = createdFiles.get(todayPath)!;
      expect(todayContent).toContain('# 📅 Today');
      expect(todayContent).toContain('Buy groceries');
      expect(todayContent).toContain('### 🔴 Urgent (P1)');
    });

    it('should create Upcoming.md with upcoming tasks', async () => {
      await fileSyncManager.syncAllTasks();

      const upcomingPath = '📋 01-PRODUCTIVITY/todoist-integration/📆 Upcoming.md';
      expect(createdFiles.has(upcomingPath)).toBe(true);
      
      const upcomingContent = createdFiles.get(upcomingPath)!;
      expect(upcomingContent).toContain('# 📆 Upcoming');
      expect(upcomingContent).toContain('Review project proposal');
    });

    it('should create project files with sections', async () => {
      await fileSyncManager.syncAllTasks();

      const projectPath = '📋 01-PRODUCTIVITY/todoist-integration/🗂️ Projects/Work Project.md';
      expect(createdFiles.has(projectPath)).toBe(true);
      
      const projectContent = createdFiles.get(projectPath)!;
      expect(projectContent).toContain('# 🗂️ Work Project');
      expect(projectContent).toContain('## 📂 Planning');
      expect(projectContent).toContain('Review project proposal');
      expect(projectContent).toContain('## 📋 Tasks');
      expect(projectContent).toContain('Update documentation');
    });

    it('should create label files', async () => {
      await fileSyncManager.syncAllTasks();

      const urgentLabelPath = '📋 01-PRODUCTIVITY/todoist-integration/🏷️ Labels/urgent.md';
      const waitingLabelPath = '📋 01-PRODUCTIVITY/todoist-integration/🏷️ Labels/waiting.md';
      
      expect(createdFiles.has(urgentLabelPath)).toBe(true);
      expect(createdFiles.has(waitingLabelPath)).toBe(true);
      
      const urgentContent = createdFiles.get(urgentLabelPath)!;
      expect(urgentContent).toContain('# 🏷️ urgent');
      expect(urgentContent).toContain('Buy groceries');
    });

    it('should create sync status file', async () => {
      await fileSyncManager.syncAllTasks();

      const statusPath = '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/Sync Status.md';
      expect(createdFiles.has(statusPath)).toBe(true);
      
      const statusContent = createdFiles.get(statusPath)!;
      expect(statusContent).toContain('# ⚙️ Sync Status');
      expect(statusContent).toContain('✅ Success');
      expect(statusContent).toContain('Tasks Synced: 3');
      expect(statusContent).toContain('Projects Synced: 1');
    });

    it('should handle empty task lists gracefully', async () => {
      // Mock empty task list
      mockTodoistService.subscribe = vi.fn((filter: string, callback: Function) => {
        setTimeout(() => {
          callback({
            type: 'success',
            data: []
          });
        }, 100);
        
        return [vi.fn(), vi.fn()];
      });

      const stats = await fileSyncManager.syncAllTasks();

      expect(stats.tasksProcessed).toBe(0);
      expect(stats.errors).toHaveLength(0);
      
      // Should still create files with encouraging empty messages
      const inboxPath = '📋 01-PRODUCTIVITY/todoist-integration/📥 Inbox.md';
      expect(createdFiles.has(inboxPath)).toBe(true);
      
      const inboxContent = createdFiles.get(inboxPath)!;
      expect(inboxContent).toContain('*No tasks in inbox* ✨');
      expect(inboxContent).toContain('Great job keeping your inbox clean! 🎉');
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error
      mockTodoistService.subscribe = vi.fn((filter: string, callback: Function) => {
        setTimeout(() => {
          callback({
            type: 'error',
            error: 'API connection failed'
          });
        }, 100);
        
        return [vi.fn(), vi.fn()];
      });

      const stats = await fileSyncManager.syncAllTasks();

      expect(stats.errors.length).toBeGreaterThan(0);
      expect(stats.errors[0]).toContain('API connection failed');
    });

    it('should handle service not ready', async () => {
      mockTodoistService.isReady = vi.fn(() => false);

      const stats = await fileSyncManager.syncAllTasks();

      expect(stats.errors.length).toBeGreaterThan(0);
      expect(stats.errors[0]).toContain('Todoist service not ready');
    });
  });

  describe('Task Formatting', () => {
    it('should format tasks with ADHD-friendly styling', async () => {
      await fileSyncManager.syncAllTasks();

      const inboxPath = '📋 01-PRODUCTIVITY/todoist-integration/📥 Inbox.md';
      const inboxContent = createdFiles.get(inboxPath)!;

      // Check task formatting
      expect(inboxContent).toContain('- [ ] Buy groceries 🔴 📅 5/26/2024 #urgent');
      expect(inboxContent).toContain('> Get milk, bread, and eggs'); // Description
    });

    it('should show overdue tasks prominently', async () => {
      // Add overdue task
      const overdueTasks = [...mockTasks, {
        id: '4',
        createdAt: '2024-05-25T10:00:00Z',
        content: 'Overdue task',
        description: '',
        project: { id: 'inbox', name: 'Inbox', order: 0, parentId: null, isInboxProject: true, color: 'grey' },
        section: undefined,
        parentId: null,
        labels: [],
        priority: 4,
        due: { date: '2024-05-25', datetime: null, string: 'yesterday', timezone: null },
        duration: null,
        order: 4,
      }];

      mockTodoistService.subscribe = vi.fn((filter: string, callback: Function) => {
        setTimeout(() => {
          callback({
            type: 'success',
            data: overdueTasks
          });
        }, 100);
        
        return [vi.fn(), vi.fn()];
      });

      await fileSyncManager.syncAllTasks();

      const todayPath = '📋 01-PRODUCTIVITY/todoist-integration/📅 Today.md';
      const todayContent = createdFiles.get(todayPath)!;
      
      expect(todayContent).toContain('🔴 **OVERDUE: 5/25/2024**');
    });
  });

  describe('Folder Structure', () => {
    it('should create all required folders', async () => {
      await fileSyncManager.syncAllTasks();

      const expectedFolders = [
        '📋 01-PRODUCTIVITY/todoist-integration/🗂️ Projects',
        '📋 01-PRODUCTIVITY/todoist-integration/🏷️ Labels',
        '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System'
      ];

      expectedFolders.forEach(folder => {
        expect(createdFolders.has(folder)).toBe(true);
      });
    });

    it('should sanitize file names properly', async () => {
      // Add task with special characters in project name
      const specialTasks = [{
        ...mockTasks[1],
        project: { 
          id: 'special', 
          name: 'Project: With/Special\\Characters<>|?*', 
          order: 1, 
          parentId: null, 
          isInboxProject: false, 
          color: 'blue' 
        }
      }];

      mockTodoistService.subscribe = vi.fn((filter: string, callback: Function) => {
        setTimeout(() => {
          callback({
            type: 'success',
            data: specialTasks
          });
        }, 100);
        
        return [vi.fn(), vi.fn()];
      });

      await fileSyncManager.syncAllTasks();

      const sanitizedPath = '📋 01-PRODUCTIVITY/todoist-integration/🗂️ Projects/Project_ With_Special_Characters_______.md';
      expect(createdFiles.has(sanitizedPath)).toBe(true);
    });
  });

  describe('ADHD Optimizations', () => {
    it('should include encouraging messages for empty states', async () => {
      mockTodoistService.subscribe = vi.fn((filter: string, callback: Function) => {
        setTimeout(() => {
          callback({
            type: 'success',
            data: []
          });
        }, 100);
        
        return [vi.fn(), vi.fn()];
      });

      await fileSyncManager.syncAllTasks();

      const todayPath = '📋 01-PRODUCTIVITY/todoist-integration/📅 Today.md';
      const todayContent = createdFiles.get(todayPath)!;
      
      expect(todayContent).toContain('*No tasks due today* ✨');
      expect(todayContent).toContain('Enjoy your free day or tackle some upcoming tasks! 🌟');
    });

    it('should organize tasks by priority for cognitive clarity', async () => {
      await fileSyncManager.syncAllTasks();

      const todayPath = '📋 01-PRODUCTIVITY/todoist-integration/📅 Today.md';
      const todayContent = createdFiles.get(todayPath)!;
      
      // Check priority sections appear in correct order
      const urgentIndex = todayContent.indexOf('### 🔴 Urgent (P1)');
      const highIndex = todayContent.indexOf('### 🟡 High Priority (P2)');
      
      expect(urgentIndex).toBeGreaterThan(-1);
      expect(urgentIndex).toBeLessThan(highIndex);
    });

    it('should include automatic timestamps for tracking', async () => {
      await fileSyncManager.syncAllTasks();

      const statusPath = '📋 01-PRODUCTIVITY/todoist-integration/⚙️ System/Sync Status.md';
      const statusContent = createdFiles.get(statusPath)!;
      
      expect(statusContent).toMatch(/Last sync: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(statusContent).toContain('🧠 ADHD Optimizations Active');
      expect(statusContent).toContain('✅ Cognitive load reduction');
      expect(statusContent).toContain('✅ Dopamine-friendly feedback');
    });
  });
});
