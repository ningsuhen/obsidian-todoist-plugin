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
    name: "Sync Changes Back to Todoist",
    callback: async () => {
      debug("Starting bidirectional sync with conflict resolution");
      try {
        const fileSyncManager = new FileSyncManager(plugin);
        const result = await fileSyncManager.syncObsidianChangesToTodoist();

        // Create ADHD-friendly success message
        let message = '✅ Bidirectional sync complete! ';
        const parts = [];

        if (result.completed > 0) parts.push(`${result.completed} tasks completed 🎉`);
        if (result.updated > 0) parts.push(`${result.updated} tasks updated`);
        if (result.conflicts > 0) parts.push(`${result.conflicts} conflicts resolved`);

        if (parts.length > 0) {
          message += parts.join(', ');
        } else {
          message += 'Everything is in sync! 🌟';
        }

        if (result.errors.length > 0) {
          new Notice(`⚠️ ${message} (${result.errors.length} errors - check console)`, 5000);
        } else {
          new Notice(message, 3000);
        }
      } catch (error) {
        console.error("Bidirectional sync failed:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        new Notice(`❌ Bidirectional sync failed: ${errorMessage}`, 5000);
      }
    },
  };
};

const commands = {
  "todoist-sync": syncCommand,
  "todoist-file-sync": fileSyncCommand,
  "todoist-bidirectional-sync": bidirectionalSyncCommand,
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
