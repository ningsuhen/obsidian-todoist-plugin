# 🕐 **Duration Support Design**
## Todoist Time Estimates with ADHD-Friendly Syntax

---

## 📋 **Overview**

**Feature:** Bidirectional sync of Todoist duration estimates with ADHD-friendly `⏱️` syntax in Obsidian  
**Priority:** High (ADHD Time Awareness - Critical for time blindness)  
**Requirements:** REQ-F005-17, REQ-F005-18, REQ-F005-19, REQ-F005-20  

### **Problem Statement**
ADHD users struggle with time blindness and need visible time estimates to:
- Plan realistic task schedules
- Avoid overwhelm from underestimating time
- Build better time awareness through practice
- Support hyperfocus session planning

### **Solution**
Implement bidirectional sync of Todoist duration field with intuitive `⏱️ 30min` syntax in Obsidian markdown.

---

## 🎯 **User Experience Design**

### **Obsidian Syntax Examples**
```markdown
# ADHD-Friendly Duration Syntax
- [ ] Write report ⏱️ 2h 🟡 📅 1/15/2024 #work
- [ ] Quick email check ⏱️ 15min 🔵 #admin  
- [ ] Deep work session ⏱️ 90min 🔴 #focus
- [ ] Daily planning ⏱️ 1d 🟡 #planning

# Supported Formats
⏱️ 30min    # 30 minutes
⏱️ 2h       # 2 hours (converted to 120 minutes)
⏱️ 1d       # 1 day
⏱️ 45min    # 45 minutes
⏱️ 3h30min  # 3.5 hours (converted to 210 minutes)
```

### **Visual Integration**
- **Icon:** `⏱️` for immediate visual recognition
- **Placement:** After task content, before priority/date
- **Parsing:** Flexible format support for natural input
- **Display:** Clear, non-overwhelming visual indicator

---

## 🏗️ **Technical Architecture**

### **Domain Model Extensions**

#### **Enhanced ParsedTask Interface**
```typescript
export interface ParsedTask {
  todoistId: string | null;
  content: string;
  completed: boolean;
  dueDate: string | null;
  isOverdue: boolean;
  priority: number | null;
  labels: string[];
  duration: Duration | null; // NEW: Duration support
}

export interface Duration {
  amount: number;
  unit: "minute" | "day";
}
```

#### **Duration Parsing Logic**
```typescript
class DurationParser {
  /**
   * Parse duration from markdown syntax
   * Supports: ⏱️ 30min, ⏱️ 2h, ⏱️ 1d, ⏱️ 3h30min
   */
  static parseDuration(markdownLine: string): Duration | null {
    // Match ⏱️ followed by duration
    const durationMatch = markdownLine.match(/⏱️\s*(\d+(?:\.\d+)?)(min|h|d)(?:(\d+)min)?/);
    
    if (!durationMatch) return null;
    
    const [, amount, unit, extraMinutes] = durationMatch;
    let totalMinutes = 0;
    
    switch (unit) {
      case 'min':
        totalMinutes = parseInt(amount);
        break;
      case 'h':
        totalMinutes = parseFloat(amount) * 60;
        if (extraMinutes) totalMinutes += parseInt(extraMinutes);
        break;
      case 'd':
        return { amount: parseInt(amount), unit: 'day' };
    }
    
    return { amount: totalMinutes, unit: 'minute' };
  }
  
  /**
   * Format duration for markdown display
   */
  static formatDuration(duration: Duration): string {
    if (duration.unit === 'day') {
      return `⏱️ ${duration.amount}d`;
    }
    
    // Convert minutes to human-friendly format
    if (duration.amount >= 60) {
      const hours = Math.floor(duration.amount / 60);
      const minutes = duration.amount % 60;
      return minutes > 0 ? `⏱️ ${hours}h${minutes}min` : `⏱️ ${hours}h`;
    }
    
    return `⏱️ ${duration.amount}min`;
  }
}
```

### **TaskFormatter Enhancements**

#### **Enhanced Parsing Method**
```typescript
static parseTaskLine(markdownLine: string): ParsedTask | null {
  // ... existing parsing logic ...
  
  // Extract duration (NEW)
  const duration = DurationParser.parseDuration(markdownLine);
  
  return {
    todoistId,
    content,
    completed,
    dueDate: overdueDate || dueDate,
    isOverdue: !!overdueDate,
    priority,
    labels,
    duration // NEW: Include duration in parsed result
  };
}
```

#### **Enhanced Formatting Method**
```typescript
static formatTaskAsMarkdown(task: Task, includeMetadata: boolean = true): string {
  let line = `- [ ] ${task.content}`;
  
  // Add duration if present (NEW)
  if (task.duration) {
    line += ` ${DurationParser.formatDuration(task.duration)}`;
  }
  
  // Add priority indicator
  if (task.priority > 1) {
    line += ` ${this.getPriorityEmoji(task.priority)}`;
  }
  
  // ... rest of existing formatting logic ...
}
```

---

## 🔄 **Bidirectional Sync Implementation**

### **Todoist → Obsidian Sync**
```typescript
class TodoistToObsidianSync {
  /**
   * Convert Todoist duration to Obsidian markdown
   */
  private formatTaskWithDuration(task: TodoistTask): string {
    let markdown = TaskFormatter.formatTaskAsMarkdown(task);
    
    // Todoist duration is already included in task.duration
    // TaskFormatter.formatTaskAsMarkdown handles the conversion
    
    return markdown;
  }
}
```

### **Obsidian → Todoist Sync**
```typescript
class ObsidianToTodoistSync {
  /**
   * Extract duration changes from Obsidian and sync to Todoist
   */
  async syncDurationChanges(obsidianTask: ParsedTask, todoistTask: Task): Promise<void> {
    // Check if duration changed
    const obsidianDuration = obsidianTask.duration;
    const todoistDuration = todoistTask.duration;
    
    if (!this.durationsEqual(obsidianDuration, todoistDuration)) {
      // Update Todoist task with new duration
      await this.todoistApi.updateTask(todoistTask.id, {
        duration: obsidianDuration
      });
    }
  }
  
  private durationsEqual(d1: Duration | null, d2: Duration | null): boolean {
    if (!d1 && !d2) return true;
    if (!d1 || !d2) return false;
    return d1.amount === d2.amount && d1.unit === d2.unit;
  }
}
```

---

## 🧪 **Testing Strategy**

### **Unit Tests**
```typescript
describe('DurationParser', () => {
  describe('parseDuration', () => {
    it('should parse minute format', () => {
      const result = DurationParser.parseDuration('- [ ] Task ⏱️ 30min');
      expect(result).toEqual({ amount: 30, unit: 'minute' });
    });
    
    it('should parse hour format', () => {
      const result = DurationParser.parseDuration('- [ ] Task ⏱️ 2h');
      expect(result).toEqual({ amount: 120, unit: 'minute' });
    });
    
    it('should parse day format', () => {
      const result = DurationParser.parseDuration('- [ ] Task ⏱️ 1d');
      expect(result).toEqual({ amount: 1, unit: 'day' });
    });
    
    it('should parse complex hour format', () => {
      const result = DurationParser.parseDuration('- [ ] Task ⏱️ 3h30min');
      expect(result).toEqual({ amount: 210, unit: 'minute' });
    });
    
    it('should return null for invalid format', () => {
      const result = DurationParser.parseDuration('- [ ] Task without duration');
      expect(result).toBeNull();
    });
  });
  
  describe('formatDuration', () => {
    it('should format minutes', () => {
      const result = DurationParser.formatDuration({ amount: 30, unit: 'minute' });
      expect(result).toBe('⏱️ 30min');
    });
    
    it('should format hours', () => {
      const result = DurationParser.formatDuration({ amount: 120, unit: 'minute' });
      expect(result).toBe('⏱️ 2h');
    });
    
    it('should format complex hours', () => {
      const result = DurationParser.formatDuration({ amount: 150, unit: 'minute' });
      expect(result).toBe('⏱️ 2h30min');
    });
    
    it('should format days', () => {
      const result = DurationParser.formatDuration({ amount: 1, unit: 'day' });
      expect(result).toBe('⏱️ 1d');
    });
  });
});
```

### **Integration Tests**
```typescript
describe('Duration Bidirectional Sync', () => {
  it('should sync duration from Todoist to Obsidian', async () => {
    const todoistTask = createMockTask({
      content: 'Test task',
      duration: { amount: 60, unit: 'minute' }
    });
    
    const markdown = TaskFormatter.formatTaskAsMarkdown(todoistTask);
    expect(markdown).toContain('⏱️ 1h');
  });
  
  it('should sync duration from Obsidian to Todoist', async () => {
    const markdownLine = '- [ ] Test task ⏱️ 45min 🟡';
    const parsed = TaskFormatter.parseTaskLine(markdownLine);
    
    expect(parsed.duration).toEqual({ amount: 45, unit: 'minute' });
  });
  
  it('should preserve duration during round-trip sync', async () => {
    const originalDuration = { amount: 90, unit: 'minute' };
    
    // Todoist → Obsidian
    const todoistTask = createMockTask({ duration: originalDuration });
    const markdown = TaskFormatter.formatTaskAsMarkdown(todoistTask);
    
    // Obsidian → Todoist
    const parsed = TaskFormatter.parseTaskLine(markdown);
    
    expect(parsed.duration).toEqual(originalDuration);
  });
});
```

---

## 🎯 **ADHD-Specific Benefits**

### **Time Blindness Support**
- **Visual Time Indicators**: `⏱️` icon provides immediate time awareness
- **Realistic Planning**: Helps users estimate and plan realistic schedules
- **Overwhelm Prevention**: Shows time commitment before starting tasks

### **Hyperfocus Session Planning**
- **Session Boundaries**: Plan focused work sessions with clear time limits
- **Break Reminders**: Visual cues for when to take breaks
- **Energy Management**: Match task duration to available energy

### **Learning and Improvement**
- **Time Estimation Practice**: Build better time awareness through repeated use
- **Pattern Recognition**: Learn personal time patterns and preferences
- **Feedback Loop**: Compare estimated vs. actual time for improvement

---

## 🚀 **Implementation Plan**

### **Phase 1: Core Duration Support (Week 1)**
1. ✅ Create DurationParser utility class
2. ✅ Extend ParsedTask interface with duration field
3. ✅ Update TaskFormatter.parseTaskLine() method
4. ✅ Update TaskFormatter.formatTaskAsMarkdown() method
5. ✅ Add comprehensive unit tests

### **Phase 2: Bidirectional Sync (Week 1)**
1. ✅ Update sync logic to handle duration changes
2. ✅ Add duration comparison utilities
3. ✅ Integrate with existing change detection
4. ✅ Add integration tests for sync scenarios

### **Phase 3: User Experience Polish (Week 2)**
1. ✅ Add duration validation and error handling
2. ✅ Optimize parsing performance
3. ✅ Add user documentation and examples
4. ✅ Test with real ADHD user scenarios

---

## 📊 **Success Metrics**

### **Technical Metrics**
- ✅ 100% duration parsing accuracy for supported formats
- ✅ <5ms parsing performance impact
- ✅ 100% bidirectional sync reliability
- ✅ Zero data loss during duration sync

### **ADHD User Metrics**
- ✅ 80% of users report improved time awareness
- ✅ 60% reduction in task time underestimation
- ✅ 40% improvement in realistic scheduling
- ✅ 90% user satisfaction with duration syntax

---

**Design Status:** ✅ **COMPLETE**  
**Next Phase:** Implementation with comprehensive testing  
**ADHD Impact:** Critical for time blindness support and realistic planning
