/**
 * Tests for TaskFormatter Duration Integration
 *
 * Tests the integration of duration support with TaskFormatter for bidirectional sync.
 * Ensures ADHD-friendly ⏱️ syntax works seamlessly with existing task formatting.
 */

import { describe, expect, it } from 'vitest';
import type { Duration } from '../src/api/domain/task';
import { TaskFormatter } from '../src/core/sync/TaskFormatter';
import type { Task } from '../src/data/task';

// Mock task factory for testing
function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-123',
    createdAt: '2024-01-01T00:00:00Z',
    content: 'Test task',
    description: '',
    project: { id: 'project-1', name: 'Test Project' },
    labels: [],
    priority: 1,
    order: 1,
    ...overrides
  } as Task;
}

describe('TaskFormatter Duration Integration', () => {
  describe('formatTaskAsMarkdown with duration', () => {
    it('should format task with minute duration', () => {
      const task = createMockTask({
        content: 'Write report',
        duration: { amount: 30, unit: 'minute' }
      });

      const result = TaskFormatter.formatTaskAsMarkdown(task, false);
      expect(result).toContain('- [ ] Write report ⏱️ 30min');
    });

    it('should format task with hour duration', () => {
      const task = createMockTask({
        content: 'Deep work session',
        duration: { amount: 120, unit: 'minute' }
      });

      const result = TaskFormatter.formatTaskAsMarkdown(task, false);
      expect(result).toContain('- [ ] Deep work session ⏱️ 2h');
    });

    it('should format task with day duration', () => {
      const task = createMockTask({
        content: 'Project milestone',
        duration: { amount: 2, unit: 'day' }
      });

      const result = TaskFormatter.formatTaskAsMarkdown(task, false);
      expect(result).toContain('- [ ] Project milestone ⏱️ 2d');
    });

    it('should format task with duration and priority', () => {
      const task = createMockTask({
        content: 'Urgent task',
        duration: { amount: 45, unit: 'minute' },
        priority: 4 // P1 - Urgent
      });

      const result = TaskFormatter.formatTaskAsMarkdown(task, false);
      expect(result).toContain('- [ ] Urgent task ⏱️ 45min 🔴');
    });

    it('should format task with duration, priority, and due date', () => {
      // Use a future date to avoid overdue formatting
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
      const futureDateString = futureDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      const task = createMockTask({
        content: 'Complete assignment',
        duration: { amount: 90, unit: 'minute' },
        priority: 3, // P2 - High
        due: { date: futureDateString, datetime: null, string: futureDateString, timezone: null }
      });

      const result = TaskFormatter.formatTaskAsMarkdown(task, false);
      expect(result).toContain('⏱️ 1h30min');
      expect(result).toContain('🟡');
      expect(result).toContain('📅');
    });

    it('should format task with duration and labels', () => {
      const task = createMockTask({
        content: 'Research topic',
        duration: { amount: 60, unit: 'minute' },
        labels: [
          { id: '1', name: 'research', color: 'blue', order: 1 },
          { id: '2', name: 'work', color: 'green', order: 2 }
        ]
      });

      const result = TaskFormatter.formatTaskAsMarkdown(task, false);
      expect(result).toContain('⏱️ 1h');
      expect(result).toContain('#research #work');
    });

    it('should not include duration if not present', () => {
      const task = createMockTask({
        content: 'Task without duration'
      });

      const result = TaskFormatter.formatTaskAsMarkdown(task, false);
      expect(result).not.toContain('⏱️');
      expect(result).toContain('- [ ] Task without duration');
    });
  });

  describe('parseTaskLine with duration', () => {
    it('should parse task with minute duration', () => {
      const line = '- [ ] Write report ⏱️ 30min 🟡 #work';
      const result = TaskFormatter.parseTaskLine(line);

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Write report');
      expect(result!.duration).toEqual({ amount: 30, unit: 'minute' });
      expect(result!.priority).toBe(3); // P2
      expect(result!.labels).toContain('work');
    });

    it('should parse task with hour duration', () => {
      const line = '- [ ] Deep work session ⏱️ 2h 🔴';
      const result = TaskFormatter.parseTaskLine(line);

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Deep work session');
      expect(result!.duration).toEqual({ amount: 120, unit: 'minute' });
      expect(result!.priority).toBe(4); // P1
    });

    it('should parse task with complex hour duration', () => {
      const line = '- [ ] Project work ⏱️ 2h30min 📅 1/15/2024';
      const result = TaskFormatter.parseTaskLine(line);

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Project work');
      expect(result!.duration).toEqual({ amount: 150, unit: 'minute' });
      expect(result!.dueDate).toBe('1/15/2024');
    });

    it('should parse task with day duration', () => {
      const line = '- [ ] Long project ⏱️ 3d #project';
      const result = TaskFormatter.parseTaskLine(line);

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Long project');
      expect(result!.duration).toEqual({ amount: 3, unit: 'day' });
      expect(result!.labels).toContain('project');
    });

    it('should parse task without duration', () => {
      const line = '- [ ] Simple task 🟡 #work';
      const result = TaskFormatter.parseTaskLine(line);

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Simple task');
      expect(result!.duration).toBeNull();
      expect(result!.priority).toBe(3);
      expect(result!.labels).toContain('work');
    });

    it('should handle duration with flexible spacing', () => {
      const line = '- [ ] Task  ⏱️  45min  🔵  #test';
      const result = TaskFormatter.parseTaskLine(line);

      expect(result).not.toBeNull();
      expect(result!.duration).toEqual({ amount: 45, unit: 'minute' });
    });
  });

  describe('calculateTaskHash with duration', () => {
    it('should include duration in hash calculation', () => {
      const task1 = createMockTask({
        content: 'Same task',
        duration: { amount: 30, unit: 'minute' }
      });

      const task2 = createMockTask({
        content: 'Same task',
        duration: { amount: 60, unit: 'minute' }
      });

      const hash1 = TaskFormatter.calculateTaskHash(task1);
      const hash2 = TaskFormatter.calculateTaskHash(task2);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce same hash for same duration', () => {
      const task1 = createMockTask({
        content: 'Same task',
        duration: { amount: 45, unit: 'minute' }
      });

      const task2 = createMockTask({
        content: 'Same task',
        duration: { amount: 45, unit: 'minute' }
      });

      const hash1 = TaskFormatter.calculateTaskHash(task1);
      const hash2 = TaskFormatter.calculateTaskHash(task2);

      expect(hash1).toBe(hash2);
    });

    it('should handle null duration in hash', () => {
      const task1 = createMockTask({
        content: 'Task without duration'
      });

      const task2 = createMockTask({
        content: 'Task without duration',
        duration: null
      });

      const hash1 = TaskFormatter.calculateTaskHash(task1);
      const hash2 = TaskFormatter.calculateTaskHash(task2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('bidirectional conversion', () => {
    it('should preserve duration through format -> parse cycle', () => {
      const originalTask = createMockTask({
        content: 'Test task',
        duration: { amount: 90, unit: 'minute' },
        priority: 3,
        labels: [{ id: '1', name: 'test', color: 'blue', order: 1 }]
      });

      // Format to markdown
      const markdown = TaskFormatter.formatTaskAsMarkdown(originalTask, false);

      // Parse back from markdown
      const parsed = TaskFormatter.parseTaskLine(markdown);

      expect(parsed).not.toBeNull();
      expect(parsed!.content).toBe(originalTask.content);
      expect(parsed!.duration).toEqual(originalTask.duration);
      expect(parsed!.priority).toBe(originalTask.priority);
      expect(parsed!.labels).toContain('test');
    });

    it('should preserve day duration through conversion', () => {
      const originalTask = createMockTask({
        content: 'Multi-day project',
        duration: { amount: 2, unit: 'day' }
      });

      const markdown = TaskFormatter.formatTaskAsMarkdown(originalTask, false);
      const parsed = TaskFormatter.parseTaskLine(markdown);

      expect(parsed).not.toBeNull();
      expect(parsed!.duration).toEqual({ amount: 2, unit: 'day' });
    });

    it('should handle complex task with all metadata', () => {
      // Use a future date to avoid overdue formatting
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
      const futureDateString = futureDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      const originalTask = createMockTask({
        content: 'Complex task',
        duration: { amount: 75, unit: 'minute' },
        priority: 4,
        due: { date: futureDateString, datetime: null, string: futureDateString, timezone: null },
        labels: [
          { id: '1', name: 'urgent', color: 'red', order: 1 },
          { id: '2', name: 'work', color: 'blue', order: 2 }
        ]
      });

      const markdown = TaskFormatter.formatTaskAsMarkdown(originalTask, true);
      const parsed = TaskFormatter.parseTaskLine(markdown);

      expect(parsed).not.toBeNull();
      expect(parsed!.content).toBe('Complex task');
      expect(parsed!.duration).toEqual({ amount: 75, unit: 'minute' });
      expect(parsed!.priority).toBe(4);
      expect(parsed!.labels).toEqual(['urgent', 'work']);
      expect(parsed!.todoistId).toBe('test-123');
    });
  });

  describe('ADHD-specific scenarios', () => {
    it('should handle hyperfocus-friendly durations', () => {
      const task = createMockTask({
        content: 'Hyperfocus session',
        duration: { amount: 90, unit: 'minute' } // Perfect for hyperfocus
      });

      const markdown = TaskFormatter.formatTaskAsMarkdown(task, false);
      expect(markdown).toContain('⏱️ 1h30min');

      const parsed = TaskFormatter.parseTaskLine(markdown);
      expect(parsed!.duration).toEqual({ amount: 90, unit: 'minute' });
    });

    it('should handle quick ADHD tasks', () => {
      const task = createMockTask({
        content: 'Quick email check',
        duration: { amount: 15, unit: 'minute' }
      });

      const markdown = TaskFormatter.formatTaskAsMarkdown(task, false);
      expect(markdown).toContain('⏱️ 15min');

      const parsed = TaskFormatter.parseTaskLine(markdown);
      expect(parsed!.duration).toEqual({ amount: 15, unit: 'minute' });
    });

    it('should handle time-blocked work sessions', () => {
      const task = createMockTask({
        content: 'Focused work block',
        duration: { amount: 120, unit: 'minute' }, // 2-hour block
        priority: 3
      });

      const markdown = TaskFormatter.formatTaskAsMarkdown(task, false);
      expect(markdown).toContain('⏱️ 2h');
      expect(markdown).toContain('🟡');

      const parsed = TaskFormatter.parseTaskLine(markdown);
      expect(parsed!.duration).toEqual({ amount: 120, unit: 'minute' });
      expect(parsed!.priority).toBe(3);
    });
  });
});
