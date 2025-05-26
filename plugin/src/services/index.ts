import { TodoistAdapter } from "@/data";
import type TodoistPlugin from "@/index";
import { ModalHandler } from "@/services/modals";
import { VaultTokenAccessor } from "@/services/tokenAccessor";
import { SetupOrchestrator } from "@/core/setup/SetupOrchestrator";
import { DopamineFeedbackSystem } from "@/core/adhd/DopamineFeedbackSystem";
import { useSettingsStore } from "@/settings";

export type Services = {
  modals: ModalHandler;
  token: VaultTokenAccessor;
  todoist: TodoistAdapter;
  setup: SetupOrchestrator;
  dopamineFeedback: DopamineFeedbackSystem;
};

export const makeServices = (plugin: TodoistPlugin): Services => {
  // Get current settings for ADHD components
  const settings = useSettingsStore.getState();

  // Initialize dopamine feedback system with user preferences
  const dopamineFeedback = new DopamineFeedbackSystem({
    enableAnimations: settings.enableDopamineFeedback,
    enableSounds: settings.enableDopamineFeedback,
    animationIntensity: settings.feedbackIntensity,
    colorScheme: 'default',
    celebrationFrequency: 'every-task'
  });

  return {
    modals: new ModalHandler(plugin),
    token: new VaultTokenAccessor(plugin.app.vault),
    todoist: new TodoistAdapter(),
    setup: new SetupOrchestrator(plugin),
    dopamineFeedback,
  };
};
