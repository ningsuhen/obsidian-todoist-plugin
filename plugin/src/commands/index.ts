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
        // Import FileSyncManager dynamically to avoid circular dependencies
        const { FileSyncManager } = await import('@/core/sync/FileSyncManager');
        const fileSyncManager = new FileSyncManager(plugin);
        await fileSyncManager.syncAllTasks();
      } catch (error) {
        console.error("File sync failed:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        plugin.app.workspace.trigger('notice', `❌ File sync failed: ${errorMessage}`);
      }
    },
  };
};

const commands = {
  "todoist-sync": syncCommand,
  "todoist-file-sync": fileSyncCommand,
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
