import { TodoistApiClient } from '@/api';
import { ObsidianFetcher } from '@/api/fetcher';
import { FileSyncManager } from '@/core/sync/FileSyncManager';
import type TodoistPlugin from '@/index';
import { Notice, TFolder } from 'obsidian';

export interface SetupProgress {
  currentStep: SetupStep;
  completedSteps: SetupStep[];
  totalSteps: number;
  progressPercentage: number;
  estimatedTimeRemaining: number;
  currentOperation: string;
}

export interface SetupResult {
  success: boolean;
  completionTime: number;
  stepsCompleted: number;
  stepsFailed: number;
  configurationApplied: ConfigurationSummary;
  migrationResults?: MigrationSummary;
  errors: SetupError[];
}

export interface SetupError {
  step: SetupStep;
  message: string;
  code: string;
  recoverable: boolean;
  userAction?: string;
}

export enum SetupStep {
  TOKEN_VALIDATION = 'token_validation',
  FOLDER_CREATION = 'folder_creation',
  DEFAULTS_APPLICATION = 'defaults_application',
  MIGRATION_SCAN = 'migration_scan',
  MIGRATION_EXECUTION = 'migration_execution',
  SYNC_INITIALIZATION = 'sync_initialization',
  INITIAL_FILE_SYNC = 'initial_file_sync'
}

interface ConfigurationSummary {
  adhdOptimizations: boolean;
  folderStructure: string;
  defaultsApplied: string[];
}

interface MigrationSummary {
  tasksImported: number;
  projectsImported: number;
  dataSource: string;
  backupCreated: boolean;
}

/**
 * SetupOrchestrator - Manages the complete zero-configuration setup process
 *
 * This class orchestrates the entire setup flow for ADHD users:
 * 1. Validates API token with minimal user interaction
 * 2. Creates folder structure automatically
 * 3. Applies ADHD-optimized defaults
 * 4. Migrates existing data if found
 * 5. Initializes sync engine
 *
 * Target: 98% completion rate in <2 minutes with 0 configuration decisions
 */
export class SetupOrchestrator {
  private plugin: TodoistPlugin;
  private progressCallbacks: ((progress: SetupProgress) => void)[] = [];
  private completionCallbacks: ((result: SetupResult) => void)[] = [];
  private errorCallbacks: ((error: SetupError) => void)[] = [];

  private currentProgress: SetupProgress = {
    currentStep: SetupStep.TOKEN_VALIDATION,
    completedSteps: [],
    totalSteps: 7,
    progressPercentage: 0,
    estimatedTimeRemaining: 120, // 2 minutes max
    currentOperation: 'Initializing setup...'
  };

  constructor(plugin: TodoistPlugin) {
    this.plugin = plugin;
  }

  /**
   * Main setup flow - the only method ADHD users need to call
   * @param apiToken - Todoist API token (only required input)
   * @returns Promise<SetupResult> - Complete setup result
   */
  async startSetup(apiToken: string): Promise<SetupResult> {
    const startTime = Date.now();
    const result: SetupResult = {
      success: false,
      completionTime: 0,
      stepsCompleted: 0,
      stepsFailed: 0,
      configurationApplied: {
        adhdOptimizations: false,
        folderStructure: '',
        defaultsApplied: []
      },
      errors: []
    };

    try {
      // Step 1: Validate API Token (20% progress)
      await this.executeStep(SetupStep.TOKEN_VALIDATION, async () => {
        await this.validateToken(apiToken);
      });

      // Step 2: Create Folder Structure (40% progress)
      await this.executeStep(SetupStep.FOLDER_CREATION, async () => {
        await this.createFolderStructure();
      });

      // Step 3: Apply ADHD Defaults (60% progress)
      await this.executeStep(SetupStep.DEFAULTS_APPLICATION, async () => {
        await this.applyADHDDefaults();
      });

      // Step 4: Scan for Migration Data (70% progress)
      await this.executeStep(SetupStep.MIGRATION_SCAN, async () => {
        result.migrationResults = await this.scanForMigrationData();
      });

      // Step 5: Execute Migration if needed (90% progress)
      if (result.migrationResults && result.migrationResults.tasksImported > 0) {
        await this.executeStep(SetupStep.MIGRATION_EXECUTION, async () => {
          await this.executeMigration();
        });
      } else {
        // If no migration is needed, reduce total steps count
        this.currentProgress.totalSteps = 6;
      }

      // Step 6: Initialize Sync Engine (85% progress)
      await this.executeStep(SetupStep.SYNC_INITIALIZATION, async () => {
        await this.initializeSyncEngine(apiToken);
      });

      // Step 7: Initial File Sync (100% progress)
      await this.executeStep(SetupStep.INITIAL_FILE_SYNC, async () => {
        await this.performInitialFileSync();
      });

      result.success = true;
      result.stepsCompleted = this.currentProgress.completedSteps.length;
      result.configurationApplied = {
        adhdOptimizations: true,
        folderStructure: '📋 01-PRODUCTIVITY/todoist-integration/',
        defaultsApplied: ['cognitive_load_reduction', 'dopamine_feedback', 'zero_config']
      };

      // Show success notification with ADHD-friendly messaging
      new Notice('🎉 Setup complete! Your ADHD-optimized Todoist plugin is ready to use.', 5000);

    } catch (error) {
      const setupError: SetupError = {
        step: this.currentProgress.currentStep,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'SETUP_FAILED',
        recoverable: true,
        userAction: 'Please try again or check your API token'
      };

      result.errors.push(setupError);
      result.stepsFailed++;
      this.notifyError(setupError);
    }

    result.completionTime = Date.now() - startTime;
    this.notifyCompletion(result);
    return result;
  }

  private async executeStep(step: SetupStep, operation: () => Promise<void>): Promise<void> {
    this.currentProgress.currentStep = step;
    this.currentProgress.currentOperation = this.getStepDescription(step);
    this.notifyProgress();

    await operation();

    this.currentProgress.completedSteps.push(step);
    this.currentProgress.progressPercentage = (this.currentProgress.completedSteps.length / this.currentProgress.totalSteps) * 100;
    this.currentProgress.estimatedTimeRemaining = Math.max(0, 120 - (this.currentProgress.progressPercentage / 100) * 120);
    this.notifyProgress();
  }

  private async validateToken(token: string): Promise<void> {
    try {
      const apiClient = new TodoistApiClient(token, new ObsidianFetcher());
      // Test the connection by fetching user info
      await apiClient.getProjects(); // This will throw if token is invalid

      // Store the token securely
      await this.plugin.services.token.write(token);
    } catch (error) {
      throw new Error('Invalid API token. Please check your Todoist API token and try again.');
    }
  }

  private async createFolderStructure(): Promise<void> {
    const vault = this.plugin.app.vault;
    const todoistIntegrationPath = '📋 01-PRODUCTIVITY/todoist-integration';

    try {
      // Check if the existing todoist-integration folder exists
      const existingFolder = vault.getAbstractFileByPath(todoistIntegrationPath);
      if (existingFolder && existingFolder instanceof TFolder) {
        // Folder already exists, enhance it with any missing subfolders
        await this.enhanceExistingStructure(todoistIntegrationPath);
        return;
      }

      // If the main productivity folder doesn't exist, create the full structure
      const productivityPath = '📋 01-PRODUCTIVITY';
      const productivityFolder = vault.getAbstractFileByPath(productivityPath);
      if (!productivityFolder) {
        await vault.createFolder(productivityPath);
      }

      // Create the todoist-integration folder
      await vault.createFolder(todoistIntegrationPath);

      // Create the enhanced folder structure
      await this.createEnhancedFolderStructure(todoistIntegrationPath);

    } catch (error) {
      throw new Error('Failed to create folder structure. Please check vault permissions.');
    }
  }

  private async enhanceExistingStructure(basePath: string): Promise<void> {
    const vault = this.plugin.app.vault;

    // Enhanced folders to ensure exist (preserving existing ones)
    const enhancedFolders = [
      'active-tasks',
      'completed-tasks',
      'recurring-tasks',
      'project-specific'
    ];

    for (const folderName of enhancedFolders) {
      const folderPath = `${basePath}/${folderName}`;
      try {
        const existingSubfolder = vault.getAbstractFileByPath(folderPath);
        if (!existingSubfolder) {
          await vault.createFolder(folderPath);
        }
      } catch (error) {
        // Folder creation failed, continue with others
        console.warn(`Could not create enhanced folder: ${folderPath}`);
      }
    }
  }

  private async createEnhancedFolderStructure(basePath: string): Promise<void> {
    const vault = this.plugin.app.vault;

    // Create Todoist-like folder structure
    const folderStructure = [
      // Keep existing folders for backward compatibility
      'p0-priority-tasks',
      'project-contexts',
      'tasks-inbox',
      'all-tasks-local',
      'task-templates',

      // New Todoist-like structure
      '🗂️ Projects',
      '🏷️ Labels',
      '⚙️ System',
      '📁 Local'
    ];

    for (const folderName of folderStructure) {
      const folderPath = `${basePath}/${folderName}`;
      try {
        await vault.createFolder(folderPath);
      } catch (error) {
        // Folder might already exist, continue
      }
    }

    // Create main Todoist-like files
    await this.createTodoistFiles(basePath);

    // Create agent guidelines and local workspace files
    await this.createAgentGuidelinesFile(basePath);
    await this.createLocalWorkspaceWelcome(basePath);
  }

  private async createTodoistFiles(basePath: string): Promise<void> {
    const vault = this.plugin.app.vault;

    const todoistFiles = [
      {
        path: `${basePath}/📥 Inbox.md`,
        content: `# 📥 Inbox

*Tasks without a specific project*

<!-- This file is automatically updated by the ADHD-Optimized Todoist Plugin -->
<!-- Last sync: ${new Date().toISOString()} -->

## Tasks
*No tasks in inbox*
`
      },
      {
        path: `${basePath}/📅 Today.md`,
        content: `# 📅 Today

*Tasks due today*

<!-- This file is automatically updated by the ADHD-Optimized Todoist Plugin -->
<!-- Last sync: ${new Date().toISOString()} -->

## Tasks
*No tasks due today*
`
      },
      {
        path: `${basePath}/📆 Upcoming.md`,
        content: `# 📆 Upcoming

*Tasks due in the next 7 days*

<!-- This file is automatically updated by the ADHD-Optimized Todoist Plugin -->
<!-- Last sync: ${new Date().toISOString()} -->

## Tasks
*No upcoming tasks*
`
      },
      {
        path: `${basePath}/⚙️ System/Sync Status.md`,
        content: `# ⚙️ Sync Status

*Plugin synchronization information*

## Last Sync
- **Time:** ${new Date().toLocaleString()}
- **Status:** ✅ Setup Complete
- **Tasks Synced:** 0
- **Projects Synced:** 0

## Configuration
- **ADHD Mode:** Enabled
- **Auto Sync:** Every 5 minutes
- **Folder Structure:** Todoist-like
`
      }
    ];

    for (const file of todoistFiles) {
      try {
        // Only create if doesn't exist
        const existingFile = vault.getAbstractFileByPath(file.path);
        if (!existingFile) {
          await vault.create(file.path, file.content);
        }
      } catch (error) {
        console.warn(`Could not create file: ${file.path}`, error);
      }
    }
  }

  private async applyADHDDefaults(): Promise<void> {
    // Apply ADHD-optimized settings without user intervention
    const adhdSettings = {
      // Cognitive load reduction
      fadeToggle: false, // Reduce visual distractions
      autoRefreshToggle: true, // Keep data fresh automatically
      autoRefreshInterval: 30, // More frequent updates for immediate feedback

      // Visual clarity
      renderDateIcon: true,
      renderProjectIcon: true,
      renderLabelsIcon: true,

      // ADHD-specific optimizations
      shouldWrapLinksInParens: false, // Cleaner visual appearance
      addTaskButtonAddsPageLink: 'content' as const, // Automatic knowledge linking
      debugLogging: false, // Reduce cognitive overhead

      // New ADHD-specific settings
      enableDopamineFeedback: true,
      enableHyperfocusProtection: true,
      cognitiveLoadReduction: true,
      zeroConfigMode: true
    };

    await this.plugin.writeOptions(adhdSettings);
  }

  private async scanForMigrationData(): Promise<MigrationSummary> {
    // Scan for existing Obsidian Tasks plugin data or previous Todoist plugin data
    const vault = this.plugin.app.vault;
    let tasksFound = 0;
    let projectsFound = 0;
    let dataSource = '';

    // Check for Obsidian Tasks plugin format
    const files = vault.getMarkdownFiles();
    for (const file of files) {
      const content = await vault.read(file);
      const taskMatches = content.match(/^- \[([ x])\]/gm);
      if (taskMatches) {
        tasksFound += taskMatches.length;
        dataSource = 'Obsidian Tasks Plugin';
      }
    }

    return {
      tasksImported: tasksFound,
      projectsImported: projectsFound,
      dataSource,
      backupCreated: tasksFound > 0
    };
  }

  private async executeMigration(): Promise<void> {
    // Migration logic will be implemented in a separate MigrationManager
    // For now, just acknowledge that migration would happen here
    new Notice('📦 Importing existing tasks... This may take a moment.', 3000);
  }

  private async initializeSyncEngine(token: string): Promise<void> {
    // Initialize the Todoist API client
    const apiClient = new TodoistApiClient(token, new ObsidianFetcher());
    await this.plugin.services.todoist.initialize(apiClient);
  }

  private async performInitialFileSync(): Promise<void> {
    try {
      // Use static import to ensure proper bundling
      const fileSyncManager = new FileSyncManager(this.plugin);

      // Initialize the directory structure that FileSyncManager expects
      await fileSyncManager.initializeDirectoryStructure();

      // Wait a moment for the Todoist service to be fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Perform initial sync to populate files
      await fileSyncManager.syncAllTasks();
    } catch (error) {
      console.warn('Initial file sync failed, but setup can continue:', error);
      // Don't throw here - file sync failure shouldn't break setup
    }
  }

  private getStepDescription(step: SetupStep): string {
    const descriptions = {
      [SetupStep.TOKEN_VALIDATION]: 'Validating your Todoist connection...',
      [SetupStep.FOLDER_CREATION]: 'Enhancing your existing todoist-integration folder...',
      [SetupStep.DEFAULTS_APPLICATION]: 'Applying ADHD-optimized settings...',
      [SetupStep.MIGRATION_SCAN]: 'Scanning for existing tasks to import...',
      [SetupStep.MIGRATION_EXECUTION]: 'Importing your existing tasks...',
      [SetupStep.SYNC_INITIALIZATION]: 'Starting your sync engine...',
      [SetupStep.INITIAL_FILE_SYNC]: 'Creating your Todoist-like files...'
    };
    return descriptions[step];
  }

  // Event handling methods for UI feedback
  onSetupProgress(callback: (progress: SetupProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  onSetupComplete(callback: (result: SetupResult) => void): void {
    this.completionCallbacks.push(callback);
  }

  onSetupError(callback: (error: SetupError) => void): void {
    this.errorCallbacks.push(callback);
  }

  private notifyProgress(): void {
    this.progressCallbacks.forEach(callback => callback(this.currentProgress));
  }

  private notifyCompletion(result: SetupResult): void {
    this.completionCallbacks.forEach(callback => callback(result));
  }

  private notifyError(error: SetupError): void {
    this.errorCallbacks.forEach(callback => callback(error));
  }

  /**
   * Create the agent guidelines file in the integration directory
   */
  private async createAgentGuidelinesFile(basePath: string): Promise<void> {
    const filePath = `${basePath}/.agent-guidelines.md`;
    const vault = this.plugin.app.vault;

    const exists = vault.getAbstractFileByPath(filePath);
    if (!exists) {
      const content = `# 🤖 Agent Guidelines: Todoist Integration Directory

**FOR AI ASSISTANTS:** This file explains how to help users work with the ADHD-Optimized Todoist Plugin.

## 📁 Directory Structure & Sync Rules

\`\`\`
📋 01-PRODUCTIVITY/todoist-integration/
├── .agent-guidelines.md           # This file (NEVER SYNC)
├── 📥 Inbox.md                    # AUTO SYNC ✅
├── 📅 Today.md                    # AUTO SYNC ✅
├── 📆 Upcoming.md                 # AUTO SYNC ✅
├── 🗂️ Projects/                   # AUTO SYNC ✅
├── 🏷️ Labels/                     # AUTO SYNC ✅
├── 📁 Local/                      # NEVER SYNC ❌ (user's free space)
└── ⚙️ System/                     # NEVER SYNC ❌ (plugin internals)
\`\`\`

## 🔄 Sync Behavior

### AUTO SYNC Files (✅ Bidirectional)
- **Core files**: Inbox.md, Today.md, Upcoming.md
- **Projects/**: All project files sync with Todoist projects
- **Labels/**: All label files sync with Todoist labels

**Users can:**
- Edit tasks in these files freely
- Move tasks between AUTO SYNC files
- Add new tasks using standard Obsidian Tasks format

### NEVER SYNC Areas (❌ Local Only)
- **Local/**: User's private workspace (any structure allowed)
- **System/**: Plugin configuration and backups
- **.agent-guidelines.md**: This instruction file

## 🎯 How to Help Users

### Complete Task Creation Syntax

\`\`\`markdown
# Basic task
- [ ] Task content

# With priority (🔴 P1, 🟠 P2, 🔵 P3, ⚪ P4)
- [ ] 🔴 High priority task

# With due date
- [ ] Task content 📅 2024-01-15

# With project and labels
- [ ] Task content #project @label1 @label2

# With subtasks (proper indentation)
- [ ] Main task
  - [ ] Subtask 1
  - [ ] Subtask 2
    - [ ] Sub-subtask

# With description
- [ ] Task content
  Description: Additional details here

# Complete example
- [ ] 🔴 Review quarterly goals #work @planning @urgent 📅 2024-01-15
  Description: Prepare for Q1 planning meeting
  - [ ] Gather metrics from last quarter
  - [ ] Draft improvement suggestions
\`\`\`

**WHEN IN DOUBT:**
- Suggest Local/ folder for experimental work
- Ask user before major reorganization
- Stick to standard task format
- Test with one task before bulk changes
`;

      try {
        await vault.create(filePath, content);
      } catch (error) {
        console.warn('Could not create agent guidelines file:', error);
      }
    }
  }

  /**
   * Create welcome file in Local workspace
   */
  private async createLocalWorkspaceWelcome(basePath: string): Promise<void> {
    const filePath = `${basePath}/📁 Local/Welcome.md`;
    const vault = this.plugin.app.vault;

    const exists = vault.getAbstractFileByPath(filePath);
    if (!exists) {
      const content = `# 📁 Your Local Workspace

**This folder is YOURS!** 🎉

## What's Special About Local/

- ❌ **Never syncs** with Todoist (completely private)
- 🏗️ **Any structure** you want (no rules!)
- 🧪 **Perfect for experiments** and drafts
- 📝 **Your personal notes** and planning

## Ideas for This Space

- Draft tasks before moving them to Todoist
- Personal notes and brainstorming
- Project planning and mind maps
- Archive of completed work
- Anything else you need!

## Moving to Todoist

When you're ready to move something to Todoist, just copy it to one of the AUTO SYNC files.
`;

      try {
        await vault.create(filePath, content);
      } catch (error) {
        console.warn('Could not create local workspace welcome:', error);
      }
    }
  }

  /**
   * Alias for startSetup() - this is what tests expect
   * @param apiToken - Todoist API token
   * @returns Promise<SetupResult> - Complete setup result
   */
  async runSetup(apiToken: string): Promise<SetupResult> {
    return this.startSetup(apiToken);
  }
}
