import { describe, it, expect } from 'vitest';
import { TaskFormatter } from '../TaskFormatter';
import type { Task } from '@/data/task';

describe('TaskFormatter - Hash-Based Change Detection', () => {
  describe('Task Hash Calculation', () => {
    it('should calculate consistent hash for same task', () => {
      const task: Task = {
        id: '123',
        content: 'Buy groceries',
        description: 'Get milk and bread',
        priority: 2,
        due: { date: '2024-01-15' },
        labels: [{ name: 'shopping' }, { name: 'urgent' }],
        project: { id: 'proj1', name: 'Personal' },
        section: { id: 'sec1', name: 'Today' },
        order: 5,
      } as Task;

      const hash1 = TaskFormatter.calculateTaskHash(task);
      const hash2 = TaskFormatter.calculateTaskHash(task);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
      expect(typeof hash1).toBe('string');
    });

    it('should generate different hashes for different content', () => {
      const task1: Task = {
        id: '123',
        content: 'Buy groceries',
        description: '',
        priority: 1,
        due: null,
        labels: [],
        project: { id: 'proj1', name: 'Personal' },
        section: null,
        order: 1,
      } as Task;

      const task2: Task = {
        ...task1,
        content: 'Buy vegetables',
      } as Task;

      const hash1 = TaskFormatter.calculateTaskHash(task1);
      const hash2 = TaskFormatter.calculateTaskHash(task2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different priorities', () => {
      const task1: Task = {
        id: '123',
        content: 'Buy groceries',
        priority: 1,
        labels: [],
        project: { id: 'proj1', name: 'Personal' },
      } as Task;

      const task2: Task = {
        ...task1,
        priority: 4,
      } as Task;

      const hash1 = TaskFormatter.calculateTaskHash(task1);
      const hash2 = TaskFormatter.calculateTaskHash(task2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different due dates', () => {
      const task1: Task = {
        id: '123',
        content: 'Buy groceries',
        due: { date: '2024-01-15' },
        labels: [],
        project: { id: 'proj1', name: 'Personal' },
      } as Task;

      const task2: Task = {
        ...task1,
        due: { date: '2024-01-16' },
      } as Task;

      const hash1 = TaskFormatter.calculateTaskHash(task1);
      const hash2 = TaskFormatter.calculateTaskHash(task2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different labels', () => {
      const task1: Task = {
        id: '123',
        content: 'Buy groceries',
        labels: [{ name: 'shopping' }],
        project: { id: 'proj1', name: 'Personal' },
      } as Task;

      const task2: Task = {
        ...task1,
        labels: [{ name: 'urgent' }],
      } as Task;

      const hash1 = TaskFormatter.calculateTaskHash(task1);
      const hash2 = TaskFormatter.calculateTaskHash(task2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle null/undefined values consistently', () => {
      const task: Task = {
        id: '123',
        content: 'Buy groceries',
        description: null,
        priority: 1,
        due: null,
        labels: [],
        project: { id: 'proj1', name: 'Personal' },
        section: null,
        order: 1,
      } as Task;

      const hash = TaskFormatter.calculateTaskHash(task);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    it('should sort labels consistently for hash calculation', () => {
      const task1: Task = {
        id: '123',
        content: 'Buy groceries',
        labels: [{ name: 'urgent' }, { name: 'shopping' }],
        project: { id: 'proj1', name: 'Personal' },
      } as Task;

      const task2: Task = {
        id: '123',
        content: 'Buy groceries',
        labels: [{ name: 'shopping' }, { name: 'urgent' }],
        project: { id: 'proj1', name: 'Personal' },
      } as Task;

      const hash1 = TaskFormatter.calculateTaskHash(task1);
      const hash2 = TaskFormatter.calculateTaskHash(task2);

      expect(hash1).toBe(hash2); // Should be same despite different label order
    });
  });

  describe('Markdown Formatting with Hashes', () => {
    it('should include hash in metadata when formatting task', () => {
      const task: Task = {
        id: '123',
        content: 'Buy groceries',
        priority: 1,
        due: null,
        labels: [],
        project: { id: 'proj1', name: 'Personal' },
      } as Task;

      const markdown = TaskFormatter.formatTaskAsMarkdown(task, true);

      expect(markdown).toContain('<!-- todoist:123:');
      expect(markdown).toMatch(/<!-- todoist:123:[a-z0-9]+ -->/);
    });

    it('should not include hash when metadata is disabled', () => {
      const task: Task = {
        id: '123',
        content: 'Buy groceries',
        priority: 1,
        due: null,
        labels: [],
        project: { id: 'proj1', name: 'Personal' },
      } as Task;

      const markdown = TaskFormatter.formatTaskAsMarkdown(task, false);

      expect(markdown).not.toContain('<!-- todoist:');
    });
  });

  describe('Metadata Extraction', () => {
    it('should extract both ID and hash from metadata', () => {
      const markdownLine = '- [ ] Buy groceries <!-- todoist:123:abc123def -->';

      const metadata = TaskFormatter.extractTodoistMetadata(markdownLine);

      expect(metadata).toEqual({
        id: '123',
        hash: 'abc123def',
      });
    });

    it('should handle old format without hash', () => {
      const markdownLine = '- [ ] Buy groceries <!-- todoist:123 -->';

      const metadata = TaskFormatter.extractTodoistMetadata(markdownLine);

      expect(metadata).toBeNull(); // Old format not supported by new method
    });

    it('should extract ID from both old and new formats', () => {
      const oldFormat = '- [ ] Buy groceries <!-- todoist:123 -->';
      const newFormat = '- [ ] Buy groceries <!-- todoist:123:abc123def -->';

      const oldId = TaskFormatter.extractTodoistId(oldFormat);
      const newId = TaskFormatter.extractTodoistId(newFormat);

      expect(oldId).toBe('123');
      expect(newId).toBe('123');
    });

    it('should return null for lines without metadata', () => {
      const markdownLine = '- [ ] Buy groceries';

      const metadata = TaskFormatter.extractTodoistMetadata(markdownLine);
      const id = TaskFormatter.extractTodoistId(markdownLine);

      expect(metadata).toBeNull();
      expect(id).toBeNull();
    });
  });

  describe('Change Detection', () => {
    it('should detect changes when hashes differ', () => {
      const task: Task = {
        id: '123',
        content: 'Buy groceries',
        priority: 2,
        labels: [],
        project: { id: 'proj1', name: 'Personal' },
      } as Task;

      const oldHash = 'old_hash_123';
      const hasChanged = TaskFormatter.hasTaskChanged(task, oldHash);

      expect(hasChanged).toBe(true);
    });

    it('should not detect changes when hashes match', () => {
      const task: Task = {
        id: '123',
        content: 'Buy groceries',
        priority: 1,
        labels: [],
        project: { id: 'proj1', name: 'Personal' },
      } as Task;

      const currentHash = TaskFormatter.calculateTaskHash(task);
      const hasChanged = TaskFormatter.hasTaskChanged(task, currentHash);

      expect(hasChanged).toBe(false);
    });
  });

  describe('Hash Update in Markdown', () => {
    it('should update existing hash in markdown line', () => {
      const markdownLine = '- [ ] Buy groceries <!-- todoist:123:old_hash -->';
      const newTask: Task = {
        id: '123',
        content: 'Buy groceries',
        priority: 1,
        labels: [],
        project: { id: 'proj1', name: 'Personal' },
      } as Task;

      const updatedLine = (TaskFormatter as any).updateTaskHash(markdownLine, newTask);
      const newHash = TaskFormatter.calculateTaskHash(newTask);

      expect(updatedLine).toContain(`<!-- todoist:123:${newHash} -->`);
      expect(updatedLine).not.toContain('old_hash');
    });

    it('should add hash to line without existing metadata', () => {
      const markdownLine = '- [ ] Buy groceries';
      const newTask: Task = {
        id: '123',
        content: 'Buy groceries',
        priority: 1,
        labels: [],
        project: { id: 'proj1', name: 'Personal' },
      } as Task;

      const updatedLine = (TaskFormatter as any).updateTaskHash(markdownLine, newTask);
      const newHash = TaskFormatter.calculateTaskHash(newTask);

      expect(updatedLine).toContain(`<!-- todoist:123:${newHash} -->`);
    });
  });
});
