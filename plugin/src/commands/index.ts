import {
  addTask,
  addTaskWithPageInContent,
  addTaskWithPageInDescription,
} from "@/commands/addTask";
import { t } from "@/i18n";
import type { Translations } from "@/i18n/translation";
import type TodoistPlugin from "@/index";
import debug from "@/log";
import type { Command as ObsidianCommand } from "obsidian";
import { FileSyncManager } from "@/core/sync/FileSyncManager";
import { Notice } from "obsidian";

export type MakeCommand = (
  plugin: TodoistPlugin,
  i18n: Translations["commands"],
) => Omit<ObsidianCommand, "id">;

const syncCommand: MakeCommand = (plugin: TodoistPlugin, i18n: Translations["commands"]) => {
  return {
    name: i18n.sync,
    callback: async () => {
      debug("Syncing with Todoist API");
      await plugin.services.todoist.sync();
    },
  };
};

const fileSyncCommand: MakeCommand = (plugin: TodoistPlugin, i18n: Translations["commands"]) => {
  return {
    name: "Sync Tasks to Files",
    callback: async () => {
      debug("Starting file-based sync");
      try {
        // Use static import to ensure proper bundling
        const fileSyncManager = new FileSyncManager(plugin);
        await fileSyncManager.syncAllTasks();
      } catch (error) {
        console.error("File sync failed:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        new Notice(`❌ File sync failed: ${errorMessage}`, 5000);
      }
    },
  };
};

const bidirectionalSyncCommand: MakeCommand = (plugin: TodoistPlugin, i18n: Translations["commands"]) => {
  return {
    name: "Sync Changes Back to Todoist (Safe)",
    callback: async () => {
      debug("Starting safe bidirectional sync with backup and metadata preservation");
      try {
        const fileSyncManager = new FileSyncManager(plugin);
        const result = await fileSyncManager.syncObsidianChangesToTodoist();

        // Create ADHD-friendly success message with backup info
        let message = result.backupCreated ? '🛡️ Backup created! ' : '⚠️ No backup created! ';
        message += '✅ Safe sync complete! ';

        const parts = [];
        if (result.completed > 0) parts.push(`${result.completed} tasks completed 🎉`);
        if (result.updated > 0) parts.push(`${result.updated} tasks updated`);
        if (result.conflicts > 0) parts.push(`${result.conflicts} conflicts resolved`);

        if (parts.length > 0) {
          message += parts.join(', ');
        } else {
          message += 'Everything is in sync! 🌟';
        }

        // Add backup file info for peace of mind
        if (result.backupCreated && result.backupFile) {
          const backupFileName = result.backupFile.split('/').pop();
          message += ` (Backup: ${backupFileName})`;
        }

        if (result.errors.length > 0) {
          new Notice(`⚠️ ${message} (${result.errors.length} errors - check console)`, 7000);
        } else {
          new Notice(message, 5000);
        }

        // Log backup info for transparency
        if (result.backupCreated) {
          console.log(`✅ Todoist backup created: ${result.backupFile}`);
        }

      } catch (error) {
        console.error("Safe bidirectional sync failed:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        new Notice(`❌ Safe sync failed: ${errorMessage}`, 5000);
      }
    },
  };
};

const quickSyncCommand: MakeCommand = (plugin: TodoistPlugin, i18n: Translations["commands"]) => {
  return {
    name: "Quick Sync (Skip Conflicts)",
    callback: async () => {
      debug("Starting quick sync without conflict detection");
      try {
        const fileSyncManager = new FileSyncManager(plugin);
        const result = await fileSyncManager.syncObsidianChangesToTodoist(true); // Skip conflicts

        // Create simple success message
        let message = result.backupCreated ? '🛡️ Backup created! ' : '⚠️ No backup created! ';
        message += '⚡ Quick sync complete! ';

        const parts = [];
        if (result.completed > 0) parts.push(`${result.completed} tasks completed 🎉`);
        if (result.updated > 0) parts.push(`${result.updated} tasks updated`);

        if (parts.length > 0) {
          message += parts.join(', ');
        } else {
          message += 'Everything is in sync! 🌟';
        }

        message += ' (Conflicts skipped for speed)';

        if (result.errors.length > 0) {
          new Notice(`⚠️ ${message} (${result.errors.length} errors - check console)`, 5000);
        } else {
          new Notice(message, 4000);
        }

      } catch (error) {
        console.error("Quick sync failed:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        new Notice(`❌ Quick sync failed: ${errorMessage}`, 5000);
      }
    },
  };
};

const incrementalSyncCommand: MakeCommand = (plugin: TodoistPlugin, i18n: Translations["commands"]) => {
  return {
    name: "Smart Sync (Incremental)",
    callback: async () => {
      debug("Starting smart incremental sync");
      try {
        const fileSyncManager = new FileSyncManager(plugin);

        // For now, use the regular sync but with hash-based change detection
        // The TaskFormatter now includes hashes, so future syncs will be incremental
        const result = await fileSyncManager.syncAllTasks();

        new Notice(`🧠 Smart sync complete! ${result.tasksProcessed} tasks processed with hash-based change tracking enabled`, 4000);
        console.log("📊 Smart sync enabled hash-based change tracking for future incremental syncs");

      } catch (error) {
        console.error("Smart sync failed:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        new Notice(`❌ Smart sync failed: ${errorMessage}`, 5000);
      }
    },
  };
};

const backupManagementCommand: MakeCommand = (plugin: TodoistPlugin, i18n: Translations["commands"]) => {
  return {
    name: "Manage Todoist Backups",
    callback: async () => {
      debug("Opening backup management");
      try {
        const { TodoistBackupManager } = await import('@/core/backup/TodoistBackupManager');
        const backupManager = new TodoistBackupManager(plugin);
        const backups = await backupManager.listBackups();

        if (backups.length === 0) {
          new Notice("📁 No backups found. Backups are created automatically before sync operations.", 4000);
          return;
        }

        // Create a simple backup list display
        let message = `📋 Found ${backups.length} backup(s):\n\n`;
        backups.slice(0, 5).forEach((backup, index) => {
          const date = new Date(backup.timestamp).toLocaleString();
          const size = (backup.size / 1024).toFixed(1);
          message += `${index + 1}. ${backup.fileName}\n`;
          message += `   📅 ${date}\n`;
          message += `   📊 ${backup.taskCount} tasks, ${size}KB\n\n`;
        });

        if (backups.length > 5) {
          message += `... and ${backups.length - 5} more backups`;
        }

        message += `\n💡 Backups are stored in: ⚙️ System/Backups/`;

        new Notice(message, 10000);
        console.log("📋 Backup Details:", backups);

      } catch (error) {
        console.error("Failed to list backups:", error);
        new Notice(`❌ Failed to list backups: ${error}`, 5000);
      }
    },
  };
};

const commands = {
  "todoist-sync": syncCommand,
  "todoist-file-sync": fileSyncCommand,
  "todoist-smart-sync": incrementalSyncCommand,
  "todoist-bidirectional-sync": bidirectionalSyncCommand,
  "todoist-quick-sync": quickSyncCommand,
  "todoist-backup-management": backupManagementCommand,
  "add-task": addTask,
  "add-task-page-content": addTaskWithPageInContent,
  "add-task-page-description": addTaskWithPageInDescription,
};

export type CommandId = keyof typeof commands;

export const registerCommands = (plugin: TodoistPlugin) => {
  const i18n = t().commands;
  for (const [id, make] of Object.entries(commands)) {
    plugin.addCommand({ id, ...make(plugin, i18n) });
  }
};

export const fireCommand = <K extends CommandId>(id: K, plugin: TodoistPlugin) => {
  const i18n = t().commands;
  const make = commands[id];
  make(plugin, i18n).callback?.();
};
