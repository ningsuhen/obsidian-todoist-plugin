import React, { useState } from 'react';
import { Modal, Setting } from 'obsidian';
import type TodoistPlugin from '@/index';
import type { TaskConflict } from '@/core/sync/ConflictResolver';
import { ConflictResolution, ConflictType } from '@/core/sync/ConflictResolver';

interface ConflictResolutionModalProps {
  plugin: TodoistPlugin;
  conflicts: TaskConflict[];
  onResolve: (resolutions: Map<string, ConflictResolution>) => void;
  onCancel: () => void;
}

/**
 * ADHD-optimized modal for resolving sync conflicts
 * Focuses on clear choices and minimal cognitive load
 */
export class ConflictResolutionModal extends Modal {
  private conflicts: TaskConflict[];
  private resolutions: Map<string, ConflictResolution> = new Map();
  private onResolve: (resolutions: Map<string, ConflictResolution>) => void;
  private onCancel: () => void;

  constructor(
    plugin: TodoistPlugin,
    conflicts: TaskConflict[],
    onResolve: (resolutions: Map<string, ConflictResolution>) => void,
    onCancel: () => void
  ) {
    super(plugin.app);
    this.conflicts = conflicts;
    this.onResolve = onResolve;
    this.onCancel = onCancel;

    // Initialize with smart defaults
    this.conflicts.forEach(conflict => {
      this.resolutions.set(conflict.todoistId, this.getSmartDefault(conflict));
    });
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // ADHD-friendly header
    contentEl.createEl('h2', { 
      text: '🔄 Sync Conflicts Detected',
      cls: 'conflict-modal-title'
    });

    contentEl.createEl('p', {
      text: `Found ${this.conflicts.length} conflicts that need your attention. We've suggested the best choices to minimize disruption.`,
      cls: 'conflict-modal-description'
    });

    // Add CSS for ADHD-friendly styling
    this.addConflictStyles();

    // Create conflict resolution interface
    this.createConflictList();

    // Action buttons
    this.createActionButtons();
  }

  private addConflictStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .conflict-modal-title {
        color: var(--text-accent);
        margin-bottom: 1rem;
      }
      
      .conflict-modal-description {
        color: var(--text-muted);
        margin-bottom: 1.5rem;
        line-height: 1.5;
      }
      
      .conflict-item {
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 1rem;
        background: var(--background-secondary);
      }
      
      .conflict-task-title {
        font-weight: bold;
        color: var(--text-normal);
        margin-bottom: 0.5rem;
      }
      
      .conflict-type {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
      }
      
      .conflict-type-content { background: var(--color-orange); color: white; }
      .conflict-type-completion { background: var(--color-green); color: white; }
      .conflict-type-both { background: var(--color-red); color: white; }
      .conflict-type-priority { background: var(--color-blue); color: white; }
      .conflict-type-date { background: var(--color-purple); color: white; }
      
      .conflict-versions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin: 1rem 0;
      }
      
      .version-box {
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        padding: 0.75rem;
        background: var(--background-primary);
      }
      
      .version-title {
        font-weight: bold;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .version-content {
        font-family: var(--font-monospace);
        font-size: 0.9rem;
        color: var(--text-muted);
      }
      
      .resolution-buttons {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      
      .resolution-button {
        padding: 0.5rem 1rem;
        border: 2px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .resolution-button:hover {
        background: var(--background-modifier-hover);
      }
      
      .resolution-button.selected {
        border-color: var(--interactive-accent);
        background: var(--interactive-accent);
        color: var(--text-on-accent);
      }
      
      .action-buttons {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid var(--background-modifier-border);
      }
      
      .btn-primary {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
      }
      
      .btn-secondary {
        background: var(--background-secondary);
        color: var(--text-normal);
        border: 1px solid var(--background-modifier-border);
        padding: 0.75rem 1.5rem;
        border-radius: 6px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  private createConflictList() {
    const { contentEl } = this;

    this.conflicts.forEach((conflict, index) => {
      const conflictEl = contentEl.createDiv('conflict-item');

      // Task title
      conflictEl.createDiv('conflict-task-title', {
        text: conflict.obsidianVersion.content || `Task ${conflict.todoistId}`
      });

      // Conflict type badge
      const typeEl = conflictEl.createDiv('conflict-type');
      typeEl.textContent = this.getConflictTypeLabel(conflict.conflictType);
      typeEl.addClass(`conflict-type-${conflict.conflictType.replace('_', '-')}`);

      // Version comparison
      this.createVersionComparison(conflictEl, conflict);

      // Resolution options
      this.createResolutionOptions(conflictEl, conflict);
    });
  }

  private createVersionComparison(parent: HTMLElement, conflict: TaskConflict) {
    const versionsEl = parent.createDiv('conflict-versions');

    // Obsidian version
    const obsidianEl = versionsEl.createDiv('version-box');
    const obsidianTitle = obsidianEl.createDiv('version-title');
    obsidianTitle.createSpan({ text: '📝 Obsidian Version' });
    
    const obsidianContent = obsidianEl.createDiv('version-content');
    obsidianContent.innerHTML = this.formatVersionInfo(conflict.obsidianVersion);

    // Todoist version
    const todoistEl = versionsEl.createDiv('version-box');
    const todoistTitle = todoistEl.createDiv('version-title');
    todoistTitle.createSpan({ text: '☁️ Todoist Version' });
    
    const todoistContent = todoistEl.createDiv('version-content');
    todoistContent.innerHTML = this.formatVersionInfo(conflict.todoistVersion);
  }

  private createResolutionOptions(parent: HTMLElement, conflict: TaskConflict) {
    const buttonsEl = parent.createDiv('resolution-buttons');

    const options = [
      { value: ConflictResolution.OBSIDIAN_WINS, label: '📝 Use Obsidian', desc: 'Keep your local changes' },
      { value: ConflictResolution.TODOIST_WINS, label: '☁️ Use Todoist', desc: 'Use the cloud version' },
      { value: ConflictResolution.MERGE, label: '🔄 Smart Merge', desc: 'Combine both versions' },
      { value: ConflictResolution.SKIP, label: '⏭️ Skip', desc: 'Resolve later' }
    ];

    options.forEach(option => {
      const button = buttonsEl.createDiv('resolution-button');
      button.textContent = option.label;
      button.title = option.desc;

      // Set initial selection
      if (this.resolutions.get(conflict.todoistId) === option.value) {
        button.addClass('selected');
      }

      button.addEventListener('click', () => {
        // Remove selection from siblings
        buttonsEl.querySelectorAll('.resolution-button').forEach(btn => {
          btn.removeClass('selected');
        });
        
        // Select this button
        button.addClass('selected');
        this.resolutions.set(conflict.todoistId, option.value);
      });
    });
  }

  private createActionButtons() {
    const { contentEl } = this;
    const actionsEl = contentEl.createDiv('action-buttons');

    // Cancel button
    const cancelBtn = actionsEl.createEl('button', {
      text: 'Cancel',
      cls: 'btn-secondary'
    });
    cancelBtn.addEventListener('click', () => {
      this.close();
      this.onCancel();
    });

    // Resolve button
    const resolveBtn = actionsEl.createEl('button', {
      text: `Resolve ${this.conflicts.length} Conflicts`,
      cls: 'btn-primary'
    });
    resolveBtn.addEventListener('click', () => {
      this.close();
      this.onResolve(this.resolutions);
    });
  }

  private getConflictTypeLabel(type: ConflictType): string {
    switch (type) {
      case ConflictType.CONTENT_MODIFIED: return 'Content Changed';
      case ConflictType.COMPLETION_STATUS: return 'Completed';
      case ConflictType.BOTH_MODIFIED: return 'Multiple Changes';
      case ConflictType.PRIORITY_CHANGED: return 'Priority Changed';
      case ConflictType.DUE_DATE_CHANGED: return 'Due Date Changed';
      case ConflictType.DELETED_IN_TODOIST: return 'Deleted in Todoist';
      case ConflictType.DELETED_IN_OBSIDIAN: return 'Deleted in Obsidian';
      default: return 'Unknown Conflict';
    }
  }

  private formatVersionInfo(version: any): string {
    if (!version) return '<em>Deleted</em>';
    
    const parts = [];
    if (version.content) parts.push(`Content: "${version.content}"`);
    if (version.completed) parts.push('Status: ✅ Completed');
    if (version.priority > 1) parts.push(`Priority: P${5 - version.priority}`);
    if (version.dueDate || version.due) {
      const date = version.dueDate || version.due?.date;
      parts.push(`Due: ${new Date(date).toLocaleDateString()}`);
    }
    
    return parts.join('<br>') || 'No changes detected';
  }

  private getSmartDefault(conflict: TaskConflict): ConflictResolution {
    // ADHD-friendly defaults that preserve user work
    switch (conflict.conflictType) {
      case ConflictType.COMPLETION_STATUS:
        return ConflictResolution.OBSIDIAN_WINS; // Preserve dopamine
      case ConflictType.CONTENT_MODIFIED:
        return ConflictResolution.OBSIDIAN_WINS; // Preserve user edits
      case ConflictType.PRIORITY_CHANGED:
        return ConflictResolution.MERGE; // Take higher priority
      case ConflictType.DUE_DATE_CHANGED:
        return ConflictResolution.MERGE; // Take earlier date
      default:
        return ConflictResolution.OBSIDIAN_WINS; // When in doubt, preserve user work
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
