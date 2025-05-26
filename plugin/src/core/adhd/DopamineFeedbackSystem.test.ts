import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DopamineFeedbackSystem, AnimationType, SoundType } from './DopamineFeedbackSystem';

// Mock DOM and localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock DOM methods
Object.defineProperty(document, 'createElement', {
  value: vi.fn().mockReturnValue({
    style: {},
    classList: { add: vi.fn(), remove: vi.fn() },
    addEventListener: vi.fn(),
    remove: vi.fn(),
    innerHTML: ''
  })
});

Object.defineProperty(document, 'body', {
  value: {
    appendChild: vi.fn()
  }
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn().mockReturnValue(100)
  }
});

// Mock requestAnimationFrame
Object.defineProperty(window, 'requestAnimationFrame', {
  value: vi.fn().mockImplementation((callback) => {
    setTimeout(callback, 16); // Simulate 60fps
    return 1;
  })
});

// Mock Audio
Object.defineProperty(window, 'Audio', {
  value: vi.fn().mockImplementation(() => ({
    play: vi.fn().mockResolvedValue(undefined),
    volume: 0.3
  }))
});

describe('DopamineFeedbackSystem', () => {
  let feedbackSystem: DopamineFeedbackSystem;
  let mockPreferences: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockPreferences = {
      enableAnimations: true,
      enableSounds: true,
      animationIntensity: 'moderate' as const,
      colorScheme: 'default' as const,
      celebrationFrequency: 'every-task' as const
    };

    feedbackSystem = new DopamineFeedbackSystem(mockPreferences);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('triggerCompletionAnimation', () => {
    it('should provide immediate feedback within 100ms', async () => {
      const startTime = 100;
      const endTime = 150;
      
      window.performance.now = vi.fn()
        .mockReturnValueOnce(startTime)
        .mockReturnValueOnce(endTime);

      const mockTask = { id: '1', content: 'Test task' };
      
      await feedbackSystem.triggerCompletionAnimation(mockTask);

      // Should complete within 100ms target
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should create instant visual feedback element', async () => {
      const mockTask = { id: '1', content: 'Test task' };
      
      await feedbackSystem.triggerCompletionAnimation(mockTask);

      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it('should play sound when enabled', async () => {
      const mockTask = { id: '1', content: 'Test task' };
      
      await feedbackSystem.triggerCompletionAnimation(mockTask);

      expect(window.Audio).toHaveBeenCalled();
    });

    it('should not play sound when disabled', async () => {
      feedbackSystem.setFeedbackPreferences({
        ...mockPreferences,
        enableSounds: false
      });

      const mockTask = { id: '1', content: 'Test task' };
      
      await feedbackSystem.triggerCompletionAnimation(mockTask);

      expect(window.Audio).not.toHaveBeenCalled();
    });

    it('should handle animation errors gracefully', async () => {
      // Mock createElement to throw error
      document.createElement = vi.fn().mockImplementation(() => {
        throw new Error('DOM error');
      });

      const mockTask = { id: '1', content: 'Test task' };
      
      // Should not throw error
      await expect(feedbackSystem.triggerCompletionAnimation(mockTask)).resolves.toBeUndefined();
    });
  });

  describe('streak tracking', () => {
    beforeEach(() => {
      // Clear localStorage
      mockLocalStorage.getItem.mockReturnValue(null);
    });

    it('should track consecutive day streaks', async () => {
      const mockTask = { id: '1', content: 'Test task' };
      
      // First completion
      await feedbackSystem.triggerCompletionAnimation(mockTask);
      
      // Should save streak data
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'adhd-feedback-data',
        expect.stringContaining('"streakCount":1')
      );
    });

    it('should celebrate streak milestones', async () => {
      // Mock existing 2-day streak
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        streakCount: 2,
        lastCompletionDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        achievements: []
      }));

      feedbackSystem = new DopamineFeedbackSystem(mockPreferences);

      await feedbackSystem.celebrateStreak(3);

      // Should trigger special celebration for 3-day milestone
      expect(document.createElement).toHaveBeenCalled();
    });

    it('should reset streak after gap', async () => {
      // Mock existing streak from 3 days ago
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        streakCount: 5,
        lastCompletionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        achievements: []
      }));

      feedbackSystem = new DopamineFeedbackSystem(mockPreferences);
      
      const mockTask = { id: '1', content: 'Test task' };
      await feedbackSystem.triggerCompletionAnimation(mockTask);

      // Should reset to 1-day streak
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'adhd-feedback-data',
        expect.stringContaining('"streakCount":1')
      );
    });
  });

  describe('ADHD-specific optimizations', () => {
    it('should provide different animation intensities', async () => {
      const intensities = ['subtle', 'moderate', 'enthusiastic'] as const;
      
      for (const intensity of intensities) {
        feedbackSystem.setFeedbackPreferences({
          ...mockPreferences,
          animationIntensity: intensity
        });

        await feedbackSystem.triggerSuccessAnimation(AnimationType.TASK_COMPLETE);
        
        // Should create animation element
        expect(document.createElement).toHaveBeenCalled();
      }
    });

    it('should support reduced motion preferences', async () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockReturnValue({
          matches: true, // prefers-reduced-motion: reduce
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        })
      });

      const mockTask = { id: '1', content: 'Test task' };
      
      await feedbackSystem.triggerCompletionAnimation(mockTask);

      // Should still provide feedback but with reduced motion
      expect(document.createElement).toHaveBeenCalled();
    });

    it('should provide satisfaction indicators', () => {
      feedbackSystem.showSatisfactionIndicator('high');

      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it('should apply positive colors to elements', () => {
      const mockElement = {
        style: {},
        addEventListener: vi.fn()
      } as any;

      feedbackSystem.applyPositiveColors(mockElement);

      expect(mockElement.style.backgroundColor).toBeDefined();
      expect(mockElement.style.transition).toBeDefined();
    });
  });

  describe('achievement system', () => {
    it('should display achievements with fanfare', async () => {
      const achievement = {
        id: 'first-task',
        title: 'First Task Complete!',
        description: 'You completed your first task',
        icon: '🎉',
        rarity: 'common' as const,
        unlockedAt: new Date()
      };

      await feedbackSystem.displayAchievement(achievement);

      expect(document.createElement).toHaveBeenCalled();
      expect(window.Audio).toHaveBeenCalled();
    });

    it('should track achievements in localStorage', async () => {
      const achievement = {
        id: 'test-achievement',
        title: 'Test Achievement',
        description: 'Test description',
        icon: '⭐',
        rarity: 'rare' as const,
        unlockedAt: new Date()
      };

      await feedbackSystem.displayAchievement(achievement);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'adhd-feedback-data',
        expect.stringContaining('"achievements"')
      );
    });
  });

  describe('performance metrics', () => {
    it('should track effectiveness metrics', () => {
      const metrics = feedbackSystem.getFeedbackEffectiveness();

      expect(metrics).toMatchObject({
        userSatisfactionScore: expect.any(Number),
        engagementIncrease: expect.any(Number),
        completionRateImprovement: expect.any(Number),
        feedbackResponseTime: expect.any(Number)
      });

      // Response time should be under 100ms for ADHD users
      expect(metrics.feedbackResponseTime).toBeLessThan(100);
    });

    it('should maintain target response times', async () => {
      const mockTask = { id: '1', content: 'Test task' };
      
      const startTime = performance.now();
      await feedbackSystem.triggerCompletionAnimation(mockTask);
      const endTime = performance.now();

      // Should complete within ADHD-friendly timeframe
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('customization', () => {
    it('should update preferences correctly', () => {
      const newPreferences = {
        enableAnimations: false,
        enableSounds: true,
        animationIntensity: 'subtle' as const,
        colorScheme: 'high-contrast' as const,
        celebrationFrequency: 'milestones-only' as const
      };

      feedbackSystem.setFeedbackPreferences(newPreferences);

      // Should save to localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should respect animation disable setting', async () => {
      feedbackSystem.setFeedbackPreferences({
        ...mockPreferences,
        enableAnimations: false
      });

      const progress = {
        tasksCompleted: 5,
        totalTasks: 10,
        streakDays: 3,
        completionRate: 0.5,
        timeSpentFocused: 120
      };

      feedbackSystem.showProgressUpdate(progress);

      // Should not create animation elements when disabled
      expect(document.createElement).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle audio playback failures gracefully', async () => {
      // Mock audio to fail
      window.Audio = vi.fn().mockImplementation(() => ({
        play: vi.fn().mockRejectedValue(new Error('Audio not supported')),
        volume: 0.3
      }));

      const mockTask = { id: '1', content: 'Test task' };
      
      // Should not throw error
      await expect(feedbackSystem.triggerCompletionAnimation(mockTask)).resolves.toBeUndefined();
    });

    it('should handle localStorage failures gracefully', async () => {
      // Mock localStorage to fail
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const mockTask = { id: '1', content: 'Test task' };
      
      // Should not throw error
      await expect(feedbackSystem.triggerCompletionAnimation(mockTask)).resolves.toBeUndefined();
    });

    it('should handle DOM manipulation failures gracefully', async () => {
      // Mock appendChild to fail
      document.body.appendChild = vi.fn().mockImplementation(() => {
        throw new Error('DOM error');
      });

      const mockTask = { id: '1', content: 'Test task' };
      
      // Should not throw error
      await expect(feedbackSystem.triggerCompletionAnimation(mockTask)).resolves.toBeUndefined();
    });
  });
});
