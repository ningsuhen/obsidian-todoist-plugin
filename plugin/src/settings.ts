import { create } from "zustand";

export type AddPageLinkSetting = "off" | "description" | "content";
export type CognitiveLoadLevel = "minimal" | "reduced" | "standard";
export type FeedbackIntensity = "subtle" | "moderate" | "enthusiastic";

const defaultSettings: Settings = {
  // Existing settings with ADHD-optimized defaults
  fadeToggle: false, // Reduce visual distractions for ADHD users
  autoRefreshToggle: true, // Keep data fresh automatically
  autoRefreshInterval: 30, // More frequent updates for immediate feedback
  renderDateIcon: true,
  renderProjectIcon: true,
  renderLabelsIcon: true,
  shouldWrapLinksInParens: false,
  addTaskButtonAddsPageLink: "content",
  debugLogging: false,

  // ADHD-specific settings
  enableDopamineFeedback: true,
  feedbackIntensity: "moderate",
  enableHyperfocusProtection: true,
  cognitiveLoadReduction: true,
  cognitiveLoadLevel: "reduced",
  zeroConfigMode: true,
  enableKnowledgeIntegration: true,
  autoLinkThreshold: 0.7,
  preserveP0Workflow: true,
  enableBidirectionalSync: true,
  syncLatencyTarget: 5000, // 5 seconds max
};

export type Settings = {
  // Existing settings
  fadeToggle: boolean;
  autoRefreshToggle: boolean;
  autoRefreshInterval: number;
  renderDateIcon: boolean;
  renderProjectIcon: boolean;
  renderLabelsIcon: boolean;
  shouldWrapLinksInParens: boolean;
  addTaskButtonAddsPageLink: AddPageLinkSetting;
  debugLogging: boolean;

  // ADHD-specific settings
  enableDopamineFeedback: boolean;
  feedbackIntensity: FeedbackIntensity;
  enableHyperfocusProtection: boolean;
  cognitiveLoadReduction: boolean;
  cognitiveLoadLevel: CognitiveLoadLevel;
  zeroConfigMode: boolean;
  enableKnowledgeIntegration: boolean;
  autoLinkThreshold: number;
  preserveP0Workflow: boolean;
  enableBidirectionalSync: boolean;
  syncLatencyTarget: number;
};

export const useSettingsStore = create<Settings>((set) => ({
  ...defaultSettings,
}));
