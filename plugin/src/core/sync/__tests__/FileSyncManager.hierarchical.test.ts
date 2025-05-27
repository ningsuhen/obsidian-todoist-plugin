import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileSyncManager } from '../FileSyncManager';
import type TodoistPlugin from '@/index';
import type { Task } from '@/data/task';

// Mock the plugin and its dependencies
const mockPlugin = {
  app: {
    vault: {
      getAbstractFileByPath: vi.fn(),
      create: vi.fn(),
      modify: vi.fn(),
      read: vi.fn(),
    },
  },
  services: {
    todoist: {
      data: vi.fn(() => ({
        projects: {
          iter: vi.fn(),
          byId: vi.fn(),
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

describe('FileSyncManager - Hierarchical Project Support', () => {
  let fileSyncManager: FileSyncManager;

  beforeEach(() => {
    vi.clearAllMocks();
    fileSyncManager = new FileSyncManager(mockPlugin);
  });

  describe('Project Hierarchy Detection', () => {
    it('should identify parent projects with subprojects', () => {
      const mockProjects = [
        { id: '1', name: 'Personal', parentId: null, order: 1 },
        { id: '2', name: 'Health', parentId: '1', order: 1 },
        { id: '3', name: 'Finance', parentId: '1', order: 2 },
        { id: '4', name: 'Work', parentId: null, order: 2 },
        { id: '5', name: 'Simple Project', parentId: null, order: 3 },
      ];

      mockPlugin.services.todoist.data().projects.iter.mockReturnValue(mockProjects);

      // Test hasSubprojects method
      const hasSubprojectsPersonal = (fileSyncManager as any).hasSubprojects('1');
      const hasSubprojectsWork = (fileSyncManager as any).hasSubprojects('4');
      const hasSubprojectsSimple = (fileSyncManager as any).hasSubprojects('5');

      expect(hasSubprojectsPersonal).toBe(true);
      expect(hasSubprojectsWork).toBe(false);
      expect(hasSubprojectsSimple).toBe(false);
    });

    it('should get subprojects in correct order', () => {
      const mockProjects = [
        { id: '1', name: 'Personal', parentId: null, order: 1 },
        { id: '2', name: 'Health', parentId: '1', order: 2 },
        { id: '3', name: 'Finance', parentId: '1', order: 1 },
        { id: '4', name: 'Fitness', parentId: '1', order: 3 },
      ];

      mockPlugin.services.todoist.data().projects.iter.mockReturnValue(mockProjects);

      const subprojects = (fileSyncManager as any).getSubprojects('1');

      expect(subprojects).toHaveLength(3);
      expect(subprojects[0].name).toBe('Finance'); // order: 1
      expect(subprojects[1].name).toBe('Health');  // order: 2
      expect(subprojects[2].name).toBe('Fitness'); // order: 3
    });
  });

  describe('File Path Generation', () => {
    beforeEach(() => {
      const mockProjects = [
        { id: '1', name: 'Personal', parentId: null, order: 1 },
        { id: '2', name: 'Health', parentId: '1', order: 1 },
        { id: '3', name: 'Work', parentId: null, order: 2 },
        { id: '4', name: 'Simple Project', parentId: null, order: 3 },
      ];

      mockPlugin.services.todoist.data().projects.iter.mockReturnValue(mockProjects);
      mockPlugin.services.todoist.data().projects.byId.mockImplementation((id: string) => 
        mockProjects.find(p => p.id === id)
      );
    });

    it('should create hierarchical path for parent project with subprojects', () => {
      const parentProject = { id: '1', name: 'Personal', parentId: null };
      
      // Mock hasSubprojects to return true for Personal
      vi.spyOn(fileSyncManager as any, 'hasSubprojects').mockReturnValue(true);

      const filePath = (fileSyncManager as any).getProjectFilePath(parentProject);

      expect(filePath).toBe('📋 01-PRODUCTIVITY/todoist-integration/🗂️ Projects/Personal/Personal.md');
    });

    it('should create flat path for simple project without subprojects', () => {
      const simpleProject = { id: '4', name: 'Simple Project', parentId: null };
      
      // Mock hasSubprojects to return false for Simple Project
      vi.spyOn(fileSyncManager as any, 'hasSubprojects').mockReturnValue(false);

      const filePath = (fileSyncManager as any).getProjectFilePath(simpleProject);

      expect(filePath).toBe('📋 01-PRODUCTIVITY/todoist-integration/🗂️ Projects/Simple Project.md');
    });

    it('should create subproject path within parent folder', () => {
      const subproject = { id: '2', name: 'Health', parentId: '1' };

      const filePath = (fileSyncManager as any).getProjectFilePath(subproject);

      expect(filePath).toBe('📋 01-PRODUCTIVITY/todoist-integration/🗂️ Projects/Personal/Health.md');
    });

    it('should handle special characters in project names', () => {
      const projectWithSpecialChars = { 
        id: '5', 
        name: 'Project: With/Special\\Characters?', 
        parentId: null 
      };
      
      vi.spyOn(fileSyncManager as any, 'hasSubprojects').mockReturnValue(false);

      const filePath = (fileSyncManager as any).getProjectFilePath(projectWithSpecialChars);

      expect(filePath).toBe('📋 01-PRODUCTIVITY/todoist-integration/🗂️ Projects/Project- With-Special-Characters-.md');
    });
  });

  describe('Project Content Generation', () => {
    beforeEach(() => {
      const mockProjects = [
        { id: '1', name: 'Personal', parentId: null, order: 1 },
        { id: '2', name: 'Health', parentId: '1', order: 1 },
        { id: '3', name: 'Finance', parentId: '1', order: 2 },
        { id: '4', name: 'Work', parentId: null, order: 2 },
        { id: '5', name: 'Marketing', parentId: '4', order: 1 },
      ];

      mockPlugin.services.todoist.data().projects.iter.mockReturnValue(mockProjects);
      mockPlugin.services.todoist.data().projects.byId.mockImplementation((id: string) => 
        mockProjects.find(p => p.id === id)
      );
    });

    it('should include parent project link for subprojects', () => {
      const mockTasks: Task[] = [];
      
      const content = (fileSyncManager as any).generateProjectContent('Health', mockTasks);

      expect(content).toContain('📁 **Parent Project:** [[Personal/Personal|Personal]]');
    });

    it('should include subproject links for parent projects', () => {
      const mockTasks: Task[] = [];
      
      const content = (fileSyncManager as any).generateProjectContent('Personal', mockTasks);

      expect(content).toContain('📂 **Subprojects:**');
      expect(content).toContain('- [[Personal/Health|Health]]');
      expect(content).toContain('- [[Personal/Finance|Finance]]');
    });

    it('should not include hierarchy info for simple projects', () => {
      const mockTasks: Task[] = [];
      
      // Mock a project with no parent and no children
      vi.spyOn(fileSyncManager as any, 'getProjectByName').mockReturnValue({
        id: '6',
        name: 'Simple Project',
        parentId: null
      });
      vi.spyOn(fileSyncManager as any, 'getSubprojects').mockReturnValue([]);

      const content = (fileSyncManager as any).generateProjectContent('Simple Project', mockTasks);

      expect(content).not.toContain('📁 **Parent Project:**');
      expect(content).not.toContain('📂 **Subprojects:**');
    });
  });

  describe('File Name Sanitization', () => {
    it('should sanitize file names correctly', () => {
      const testCases = [
        { input: 'Normal Project', expected: 'Normal Project' },
        { input: 'Project/With\\Slashes', expected: 'Project-With-Slashes' },
        { input: 'Project:With?Special*Chars', expected: 'Project-With-Special-Chars' },
        { input: 'Project<With>Brackets', expected: 'Project-With-Brackets' },
        { input: 'Project|With"Quotes', expected: 'Project-With-Quotes' },
      ];

      testCases.forEach(({ input, expected }) => {
        const sanitized = (fileSyncManager as any).sanitizeFileName(input);
        expect(sanitized).toBe(expected);
      });
    });
  });

  describe('Integration with Task Organization', () => {
    it('should organize tasks by hierarchical projects correctly', () => {
      const mockTasks: Task[] = [
        {
          id: '1',
          content: 'Task in Personal',
          project: { id: '1', name: 'Personal', isInboxProject: false },
          labels: [],
          due: null,
        } as Task,
        {
          id: '2',
          content: 'Task in Health',
          project: { id: '2', name: 'Health', isInboxProject: false },
          labels: [],
          due: null,
        } as Task,
      ];

      const organized = (fileSyncManager as any).organizeTasks(mockTasks);

      expect(organized.projects['Personal']).toHaveLength(1);
      expect(organized.projects['Health']).toHaveLength(1);
      expect(organized.projects['Personal'][0].content).toBe('Task in Personal');
      expect(organized.projects['Health'][0].content).toBe('Task in Health');
    });
  });
});
