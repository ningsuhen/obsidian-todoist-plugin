import { Notice } from 'obsidian';
import type { FeedbackIntensity } from '@/settings';

export interface FeedbackPreferences {
  enableAnimations: boolean;
  enableSounds: boolean;
  animationIntensity: FeedbackIntensity;
  colorScheme: 'default' | 'high-contrast' | 'custom';
  celebrationFrequency: 'every-task' | 'milestones-only' | 'custom';
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt: Date;
}

export interface ProgressData {
  tasksCompleted: number;
  totalTasks: number;
  streakDays: number;
  completionRate: number;
  timeSpentFocused: number;
}

export enum AnimationType {
  TASK_COMPLETE = 'task_complete',
  STREAK_MILESTONE = 'streak_milestone',
  PROJECT_COMPLETE = 'project_complete',
  FOCUS_SESSION = 'focus_session',
  ACHIEVEMENT_UNLOCK = 'achievement_unlock'
}

export enum SoundType {
  SOFT_CHIME = 'soft_chime',
  SUCCESS_BELL = 'success_bell',
  ACHIEVEMENT_FANFARE = 'achievement_fanfare',
  GENTLE_POP = 'gentle_pop'
}

export interface EffectivenessMetrics {
  userSatisfactionScore: number;
  engagementIncrease: number;
  completionRateImprovement: number;
  feedbackResponseTime: number;
}

/**
 * DopamineFeedbackSystem - Provides satisfying visual and auditory feedback
 * 
 * This system is designed specifically for ADHD users to provide immediate,
 * satisfying feedback that triggers dopamine release and reinforces positive
 * task completion behaviors.
 * 
 * Key ADHD considerations:
 * - Immediate feedback (< 100ms response time)
 * - Visually satisfying animations
 * - Customizable intensity levels
 * - Streak tracking and celebration
 * - Achievement system for motivation
 */
export class DopamineFeedbackSystem {
  private preferences: FeedbackPreferences;
  private streakCount: number = 0;
  private lastCompletionDate: Date | null = null;
  private achievements: Achievement[] = [];
  private animationQueue: AnimationType[] = [];

  constructor(preferences: FeedbackPreferences) {
    this.preferences = preferences;
    this.loadUserData();
  }

  /**
   * Trigger completion animation with immediate feedback
   * @param task - The completed task
   * @returns Promise that resolves when animation completes
   */
  async triggerCompletionAnimation(task: any): Promise<void> {
    const startTime = performance.now();

    try {
      // Immediate visual feedback
      this.showInstantFeedback();

      // Update streak counter
      this.updateStreak();

      // Choose animation based on intensity preference
      const animationType = this.selectAnimationType(task);
      
      // Execute animation
      await this.executeAnimation(animationType);

      // Play sound if enabled
      if (this.preferences.enableSounds) {
        await this.playCompletionSound(SoundType.GENTLE_POP);
      }

      // Check for achievements
      await this.checkForAchievements(task);

      // Ensure response time is under 100ms for immediate feedback
      const responseTime = performance.now() - startTime;
      if (responseTime > 100) {
        console.warn(`Dopamine feedback took ${responseTime}ms - should be under 100ms`);
      }

    } catch (error) {
      console.error('Failed to trigger completion animation:', error);
      // Fallback to simple notice
      new Notice('✅ Task completed!', 2000);
    }
  }

  /**
   * Show progress update with visual indicators
   * @param progress - Current progress data
   */
  showProgressUpdate(progress: ProgressData): void {
    if (!this.preferences.enableAnimations) return;

    const progressElement = this.createProgressElement(progress);
    this.animateProgressUpdate(progressElement);
  }

  /**
   * Celebrate streak milestones with special animations
   * @param streakLength - Current streak length
   */
  async celebrateStreak(streakLength: number): Promise<void> {
    const milestones = [3, 7, 14, 30, 60, 100];
    
    if (milestones.includes(streakLength)) {
      const intensity = this.getStreakIntensity(streakLength);
      
      // Special streak animation
      await this.executeAnimation(AnimationType.STREAK_MILESTONE);
      
      // Special streak notification
      const message = this.getStreakMessage(streakLength);
      new Notice(message, 5000);
      
      // Play celebration sound
      if (this.preferences.enableSounds) {
        await this.playCompletionSound(SoundType.ACHIEVEMENT_FANFARE);
      }
    }
  }

  /**
   * Display achievement unlock with fanfare
   * @param achievement - The unlocked achievement
   */
  async displayAchievement(achievement: Achievement): Promise<void> {
    // Add to achievements list
    this.achievements.push(achievement);
    
    // Create achievement notification
    const achievementHtml = this.createAchievementHtml(achievement);
    
    // Show with appropriate animation
    await this.executeAnimation(AnimationType.ACHIEVEMENT_UNLOCK);
    
    // Display achievement notice
    new Notice(achievementHtml, 8000);
    
    // Play achievement sound
    if (this.preferences.enableSounds) {
      await this.playCompletionSound(SoundType.ACHIEVEMENT_FANFARE);
    }
  }

  /**
   * Apply positive colors to UI elements
   * @param element - HTML element to style
   */
  applyPositiveColors(element: HTMLElement): void {
    const colorScheme = this.getColorScheme();
    
    element.style.transition = 'all 0.3s ease';
    element.style.backgroundColor = colorScheme.success;
    element.style.borderColor = colorScheme.successBorder;
    element.style.color = colorScheme.successText;
    
    // Revert after animation
    setTimeout(() => {
      element.style.backgroundColor = '';
      element.style.borderColor = '';
      element.style.color = '';
    }, 1000);
  }

  /**
   * Trigger success animation
   * @param type - Type of animation to trigger
   */
  async triggerSuccessAnimation(type: AnimationType): Promise<void> {
    await this.executeAnimation(type);
  }

  /**
   * Show satisfaction indicator
   * @param level - Level of satisfaction to display
   */
  showSatisfactionIndicator(level: 'low' | 'medium' | 'high'): void {
    const indicator = this.createSatisfactionIndicator(level);
    document.body.appendChild(indicator);
    
    // Animate in
    requestAnimationFrame(() => {
      indicator.style.opacity = '1';
      indicator.style.transform = 'scale(1)';
    });
    
    // Remove after delay
    setTimeout(() => {
      indicator.remove();
    }, 2000);
  }

  /**
   * Play completion sound (if enabled)
   * @param soundType - Type of sound to play
   */
  async playCompletionSound(soundType: SoundType): Promise<void> {
    if (!this.preferences.enableSounds) return;
    
    try {
      // In a real implementation, this would play actual audio files
      // For now, we'll use the browser's built-in audio capabilities
      const audio = new Audio();
      audio.volume = 0.3; // Gentle volume for ADHD users
      
      switch (soundType) {
        case SoundType.GENTLE_POP:
          // Use a data URL for a simple pop sound or load from assets
          break;
        case SoundType.SUCCESS_BELL:
          // Success bell sound
          break;
        case SoundType.ACHIEVEMENT_FANFARE:
          // Achievement fanfare
          break;
        default:
          // Default gentle chime
          break;
      }
      
      await audio.play();
    } catch (error) {
      // Audio playback failed, continue silently
      console.debug('Audio playback not available:', error);
    }
  }

  /**
   * Set feedback preferences
   * @param preferences - New feedback preferences
   */
  setFeedbackPreferences(preferences: FeedbackPreferences): void {
    this.preferences = preferences;
    this.saveUserData();
  }

  /**
   * Get feedback effectiveness metrics
   * @returns Current effectiveness metrics
   */
  getFeedbackEffectiveness(): EffectivenessMetrics {
    return {
      userSatisfactionScore: this.calculateSatisfactionScore(),
      engagementIncrease: this.calculateEngagementIncrease(),
      completionRateImprovement: this.calculateCompletionImprovement(),
      feedbackResponseTime: this.getAverageResponseTime()
    };
  }

  // Private helper methods

  private showInstantFeedback(): void {
    // Create instant visual feedback element
    const feedback = document.createElement('div');
    feedback.className = 'adhd-instant-feedback';
    feedback.innerHTML = '✅';
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      font-size: 24px;
      z-index: 10000;
      opacity: 0;
      transform: scale(0.5);
      transition: all 0.3s ease;
      pointer-events: none;
    `;
    
    document.body.appendChild(feedback);
    
    // Animate in immediately
    requestAnimationFrame(() => {
      feedback.style.opacity = '1';
      feedback.style.transform = 'scale(1)';
    });
    
    // Remove after animation
    setTimeout(() => {
      feedback.remove();
    }, 1000);
  }

  private updateStreak(): void {
    const today = new Date();
    const todayStr = today.toDateString();
    
    if (this.lastCompletionDate) {
      const lastStr = this.lastCompletionDate.toDateString();
      const daysDiff = Math.floor((today.getTime() - this.lastCompletionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Consecutive day
        this.streakCount++;
      } else if (daysDiff > 1) {
        // Streak broken
        this.streakCount = 1;
      }
      // Same day - don't change streak
    } else {
      // First completion
      this.streakCount = 1;
    }
    
    this.lastCompletionDate = today;
    this.saveUserData();
  }

  private selectAnimationType(task: any): AnimationType {
    // Select animation based on task properties and user preferences
    if (task.project && this.isProjectComplete(task.project)) {
      return AnimationType.PROJECT_COMPLETE;
    }
    
    return AnimationType.TASK_COMPLETE;
  }

  private async executeAnimation(type: AnimationType): Promise<void> {
    // Queue animation to prevent overwhelming the user
    this.animationQueue.push(type);
    
    if (this.animationQueue.length === 1) {
      await this.processAnimationQueue();
    }
  }

  private async processAnimationQueue(): Promise<void> {
    while (this.animationQueue.length > 0) {
      const animation = this.animationQueue.shift()!;
      await this.playAnimation(animation);
      
      // Small delay between animations
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  private async playAnimation(type: AnimationType): Promise<void> {
    // Implementation would depend on the animation library (Framer Motion, etc.)
    // For now, we'll create simple CSS animations
    
    const animationElement = document.createElement('div');
    animationElement.className = `adhd-animation adhd-animation-${type}`;
    
    // Add animation styles based on type and intensity
    this.applyAnimationStyles(animationElement, type);
    
    document.body.appendChild(animationElement);
    
    return new Promise(resolve => {
      animationElement.addEventListener('animationend', () => {
        animationElement.remove();
        resolve();
      });
    });
  }

  private applyAnimationStyles(element: HTMLElement, type: AnimationType): void {
    const baseStyles = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      pointer-events: none;
      font-size: 48px;
    `;
    
    element.style.cssText = baseStyles;
    
    switch (type) {
      case AnimationType.TASK_COMPLETE:
        element.innerHTML = '🎉';
        element.style.animation = 'adhdBounce 0.6s ease-out';
        break;
      case AnimationType.STREAK_MILESTONE:
        element.innerHTML = '🔥';
        element.style.animation = 'adhdPulse 1s ease-out';
        break;
      case AnimationType.PROJECT_COMPLETE:
        element.innerHTML = '🏆';
        element.style.animation = 'adhdCelebrate 1.2s ease-out';
        break;
      case AnimationType.ACHIEVEMENT_UNLOCK:
        element.innerHTML = '⭐';
        element.style.animation = 'adhdSparkle 1.5s ease-out';
        break;
    }
  }

  private createProgressElement(progress: ProgressData): HTMLElement {
    const element = document.createElement('div');
    element.className = 'adhd-progress-indicator';
    element.innerHTML = `
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress.completionRate * 100}%"></div>
      </div>
      <div class="progress-text">${progress.tasksCompleted}/${progress.totalTasks} tasks</div>
    `;
    return element;
  }

  private animateProgressUpdate(element: HTMLElement): void {
    // Animate progress update
    element.style.transition = 'all 0.5s ease';
    // Add to DOM and animate
  }

  private getStreakIntensity(streakLength: number): FeedbackIntensity {
    if (streakLength >= 30) return 'enthusiastic';
    if (streakLength >= 7) return 'moderate';
    return 'subtle';
  }

  private getStreakMessage(streakLength: number): string {
    const messages = {
      3: '🔥 3-day streak! You\'re building momentum!',
      7: '🌟 One week strong! Amazing consistency!',
      14: '💪 Two weeks of excellence! You\'re unstoppable!',
      30: '🏆 30-day streak! You\'re a productivity champion!',
      60: '🎯 60 days! Your focus is legendary!',
      100: '👑 100-day streak! You\'ve achieved mastery!'
    };
    return messages[streakLength as keyof typeof messages] || `🔥 ${streakLength}-day streak!`;
  }

  private createAchievementHtml(achievement: Achievement): string {
    return `
      <div class="adhd-achievement">
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-content">
          <div class="achievement-title">${achievement.title}</div>
          <div class="achievement-description">${achievement.description}</div>
        </div>
      </div>
    `;
  }

  private getColorScheme() {
    // Return ADHD-friendly color schemes
    return {
      success: '#4CAF50',
      successBorder: '#45a049',
      successText: '#ffffff'
    };
  }

  private createSatisfactionIndicator(level: 'low' | 'medium' | 'high'): HTMLElement {
    const indicator = document.createElement('div');
    indicator.className = `adhd-satisfaction-indicator satisfaction-${level}`;
    
    const icons = {
      low: '😐',
      medium: '😊',
      high: '🤩'
    };
    
    indicator.innerHTML = icons[level];
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      font-size: 32px;
      opacity: 0;
      transform: scale(0.5);
      transition: all 0.3s ease;
      z-index: 10000;
    `;
    
    return indicator;
  }

  private async checkForAchievements(task: any): Promise<void> {
    // Check for various achievements based on task completion
    // This would be expanded with a full achievement system
  }

  private isProjectComplete(project: any): boolean {
    // Check if all tasks in project are complete
    return false; // Placeholder
  }

  private calculateSatisfactionScore(): number {
    // Calculate user satisfaction based on feedback interactions
    return 85; // Placeholder
  }

  private calculateEngagementIncrease(): number {
    // Calculate engagement increase since enabling feedback
    return 40; // Placeholder
  }

  private calculateCompletionImprovement(): number {
    // Calculate task completion rate improvement
    return 25; // Placeholder
  }

  private getAverageResponseTime(): number {
    // Get average feedback response time
    return 75; // Placeholder - should be under 100ms
  }

  private loadUserData(): void {
    // Load user streak and achievement data from storage
    const stored = localStorage.getItem('adhd-feedback-data');
    if (stored) {
      const data = JSON.parse(stored);
      this.streakCount = data.streakCount || 0;
      this.lastCompletionDate = data.lastCompletionDate ? new Date(data.lastCompletionDate) : null;
      this.achievements = data.achievements || [];
    }
  }

  private saveUserData(): void {
    // Save user data to storage
    const data = {
      streakCount: this.streakCount,
      lastCompletionDate: this.lastCompletionDate?.toISOString(),
      achievements: this.achievements
    };
    localStorage.setItem('adhd-feedback-data', JSON.stringify(data));
  }
}
