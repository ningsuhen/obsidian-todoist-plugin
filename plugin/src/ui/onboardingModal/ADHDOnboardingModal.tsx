import React, { useState, useCallback } from 'react';
import { Notice } from 'obsidian';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from '@/i18n';
import { ModalContext } from '@/ui/context';
import { SetupOrchestrator, type SetupProgress, type SetupResult } from '@/core/setup/SetupOrchestrator';
import { TokenValidation } from '../../token';
import { TokenInputForm } from './TokenInputForm';
import type TodoistPlugin from '@/index';
import './adhd-onboarding.scss';

type OnTokenSubmitted = (token: string) => Promise<void>;

interface ADHDOnboardingProps {
  plugin: TodoistPlugin;
  onTokenSubmit: OnTokenSubmitted;
}

interface SetupState {
  phase: 'welcome' | 'token-input' | 'setup-progress' | 'complete' | 'error';
  progress?: SetupProgress;
  result?: SetupResult;
  error?: string;
}

/**
 * ADHDOnboardingModal - Zero-configuration setup experience
 * 
 * This modal provides an ADHD-optimized onboarding experience:
 * - Clear, simple steps with minimal cognitive load
 * - Immediate visual feedback and progress indication
 * - Automatic setup with zero configuration decisions
 * - Encouraging messaging and dopamine-friendly design
 * - Error handling with clear, actionable guidance
 */
export const ADHDOnboardingModal: React.FC<ADHDOnboardingProps> = ({ 
  plugin, 
  onTokenSubmit 
}) => {
  const modal = ModalContext.use();
  const i18n = t().onboardingModal;
  
  const [setupState, setSetupState] = useState<SetupState>({
    phase: 'welcome'
  });

  const [setupOrchestrator] = useState(() => new SetupOrchestrator(plugin));

  // Handle token submission with zero-config setup
  const handleTokenSubmit = useCallback(async (token: string) => {
    setSetupState({ phase: 'setup-progress' });

    // Set up progress monitoring
    setupOrchestrator.onSetupProgress((progress) => {
      setSetupState(prev => ({ ...prev, progress }));
    });

    setupOrchestrator.onSetupComplete((result) => {
      setSetupState({ phase: 'complete', result });
      
      // Close modal after brief celebration
      setTimeout(() => {
        modal.close();
        onTokenSubmit(token).catch(console.error);
      }, 3000);
    });

    setupOrchestrator.onSetupError((error) => {
      setSetupState({ 
        phase: 'error', 
        error: error.message 
      });
    });

    try {
      // Start the zero-configuration setup
      await setupOrchestrator.startSetup(token);
    } catch (error) {
      setSetupState({ 
        phase: 'error', 
        error: error instanceof Error ? error.message : 'Setup failed' 
      });
    }
  }, [setupOrchestrator, modal, onTokenSubmit]);

  const handleRetry = useCallback(() => {
    setSetupState({ phase: 'token-input' });
  }, []);

  const handleSkipToManual = useCallback(() => {
    modal.close();
    // Fall back to original onboarding
    new Notice('Falling back to manual setup...', 3000);
  }, [modal]);

  return (
    <div className="adhd-onboarding-modal">
      <AnimatePresence mode="wait">
        {setupState.phase === 'welcome' && (
          <WelcomePhase onContinue={() => setSetupState({ phase: 'token-input' })} />
        )}
        
        {setupState.phase === 'token-input' && (
          <TokenInputPhase onTokenSubmit={handleTokenSubmit} />
        )}
        
        {setupState.phase === 'setup-progress' && setupState.progress && (
          <SetupProgressPhase progress={setupState.progress} />
        )}
        
        {setupState.phase === 'complete' && setupState.result && (
          <SetupCompletePhase result={setupState.result} />
        )}
        
        {setupState.phase === 'error' && (
          <SetupErrorPhase 
            error={setupState.error || 'Unknown error'} 
            onRetry={handleRetry}
            onSkipToManual={handleSkipToManual}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Welcome Phase Component
const WelcomePhase: React.FC<{ onContinue: () => void }> = ({ onContinue }) => (
  <motion.div
    key="welcome"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="adhd-onboarding-phase welcome-phase"
  >
    <div className="welcome-header">
      <h2>🧠 Welcome to Your ADHD-Optimized Todoist Plugin!</h2>
      <p className="welcome-subtitle">
        We'll set everything up for you in under 2 minutes with zero configuration needed.
      </p>
    </div>

    <div className="welcome-features">
      <div className="feature-item">
        <span className="feature-icon">⚡</span>
        <div className="feature-text">
          <strong>Zero Configuration</strong>
          <p>Just enter your API token and we'll handle the rest</p>
        </div>
      </div>
      
      <div className="feature-item">
        <span className="feature-icon">🎯</span>
        <div className="feature-text">
          <strong>ADHD-Optimized</strong>
          <p>Designed to reduce cognitive load and boost focus</p>
        </div>
      </div>
      
      <div className="feature-item">
        <span className="feature-icon">🔄</span>
        <div className="feature-text">
          <strong>Automatic Sync</strong>
          <p>Bidirectional sync keeps everything in perfect harmony</p>
        </div>
      </div>
      
      <div className="feature-item">
        <span className="feature-icon">🧠</span>
        <div className="feature-text">
          <strong>Knowledge Integration</strong>
          <p>Automatically links tasks with your notes and ideas</p>
        </div>
      </div>
    </div>

    <motion.button
      className="adhd-primary-button"
      onClick={onContinue}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      Let's Get Started! 🚀
    </motion.button>
  </motion.div>
);

// Token Input Phase Component
const TokenInputPhase: React.FC<{ onTokenSubmit: (token: string) => void }> = ({ 
  onTokenSubmit 
}) => (
  <motion.div
    key="token-input"
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="adhd-onboarding-phase token-input-phase"
  >
    <div className="phase-header">
      <h3>🔑 Connect Your Todoist Account</h3>
      <p className="phase-subtitle">
        This is the only thing you need to configure. We'll handle everything else automatically!
      </p>
    </div>

    <div className="token-help">
      <div className="help-step">
        <span className="step-number">1</span>
        <div className="step-content">
          <p>Go to <a href="https://todoist.com/help/articles/find-your-api-token-Jpzx9IIlB" target="_blank">Todoist Settings → Integrations</a></p>
        </div>
      </div>
      
      <div className="help-step">
        <span className="step-number">2</span>
        <div className="step-content">
          <p>Copy your API token</p>
        </div>
      </div>
      
      <div className="help-step">
        <span className="step-number">3</span>
        <div className="step-content">
          <p>Paste it below and we'll do the rest!</p>
        </div>
      </div>
    </div>

    <div className="token-input-container">
      <TokenInputForm 
        onTokenSubmit={onTokenSubmit} 
        tester={TokenValidation.DefaultTester}
        placeholder="Paste your Todoist API token here..."
        submitText="Start Automatic Setup ✨"
      />
    </div>

    <div className="reassurance-message">
      <p>
        🔒 Your token is stored securely and only used to sync with Todoist.
        <br />
        ⏱️ Setup typically takes 30-60 seconds.
      </p>
    </div>
  </motion.div>
);

// Setup Progress Phase Component
const SetupProgressPhase: React.FC<{ progress: SetupProgress }> = ({ progress }) => (
  <motion.div
    key="setup-progress"
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 1.05 }}
    className="adhd-onboarding-phase setup-progress-phase"
  >
    <div className="progress-header">
      <h3>⚙️ Setting Up Your ADHD-Optimized Workspace</h3>
      <p className="progress-subtitle">
        Sit back and relax - we're configuring everything for optimal ADHD productivity!
      </p>
    </div>

    <div className="progress-container">
      <div className="progress-bar-container">
        <div className="progress-bar">
          <motion.div 
            className="progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progress.progressPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <div className="progress-percentage">
          {Math.round(progress.progressPercentage)}%
        </div>
      </div>

      <div className="current-operation">
        <motion.div
          key={progress.currentOperation}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="operation-text"
        >
          {progress.currentOperation}
        </motion.div>
      </div>

      <div className="progress-steps">
        {progress.completedSteps.map((step, index) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="completed-step"
          >
            ✅ {getStepDisplayName(step)}
          </motion.div>
        ))}
      </div>

      <div className="time-remaining">
        ⏱️ Estimated time remaining: {Math.round(progress.estimatedTimeRemaining)}s
      </div>
    </div>

    <div className="setup-tips">
      <h4>💡 While we set things up:</h4>
      <ul>
        <li>Your tasks will be organized in a clean "Todoist/" folder</li>
        <li>ADHD-friendly defaults are being applied automatically</li>
        <li>Existing tasks will be imported if found</li>
        <li>Bidirectional sync will keep everything in harmony</li>
      </ul>
    </div>
  </motion.div>
);

// Setup Complete Phase Component
const SetupCompletePhase: React.FC<{ result: SetupResult }> = ({ result }) => (
  <motion.div
    key="setup-complete"
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 1.2 }}
    className="adhd-onboarding-phase setup-complete-phase"
  >
    <motion.div
      className="celebration-container"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
    >
      <div className="celebration-icon">🎉</div>
      <h3>Setup Complete!</h3>
      <p className="celebration-message">
        Your ADHD-optimized Todoist plugin is ready to boost your productivity!
      </p>
    </motion.div>

    <div className="setup-summary">
      <div className="summary-item">
        <span className="summary-icon">⏱️</span>
        <span>Setup completed in {Math.round(result.completionTime / 1000)}s</span>
      </div>
      
      <div className="summary-item">
        <span className="summary-icon">✅</span>
        <span>{result.stepsCompleted} steps completed successfully</span>
      </div>
      
      {result.migrationResults && result.migrationResults.tasksImported > 0 && (
        <div className="summary-item">
          <span className="summary-icon">📦</span>
          <span>{result.migrationResults.tasksImported} existing tasks imported</span>
        </div>
      )}
    </div>

    <div className="next-steps">
      <h4>🚀 You're all set! Here's what happens next:</h4>
      <ul>
        <li>Start creating tasks with automatic knowledge linking</li>
        <li>Enjoy dopamine-friendly feedback for every completion</li>
        <li>Experience reduced cognitive load with smart defaults</li>
        <li>Watch your productivity soar with ADHD-optimized workflows</li>
      </ul>
    </div>

    <motion.div
      className="auto-close-notice"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1 }}
    >
      This window will close automatically in a few seconds...
    </motion.div>
  </motion.div>
);

// Setup Error Phase Component
const SetupErrorPhase: React.FC<{ 
  error: string; 
  onRetry: () => void; 
  onSkipToManual: () => void; 
}> = ({ error, onRetry, onSkipToManual }) => (
  <motion.div
    key="setup-error"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="adhd-onboarding-phase setup-error-phase"
  >
    <div className="error-header">
      <div className="error-icon">⚠️</div>
      <h3>Setup Encountered an Issue</h3>
      <p className="error-subtitle">
        Don't worry - this happens sometimes. Let's get you sorted out!
      </p>
    </div>

    <div className="error-details">
      <div className="error-message">
        {error}
      </div>
    </div>

    <div className="error-actions">
      <motion.button
        className="adhd-primary-button"
        onClick={onRetry}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Try Again 🔄
      </motion.button>
      
      <motion.button
        className="adhd-secondary-button"
        onClick={onSkipToManual}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Use Manual Setup Instead
      </motion.button>
    </div>

    <div className="error-help">
      <h4>💡 Common solutions:</h4>
      <ul>
        <li>Double-check your API token is correct</li>
        <li>Ensure you have internet connection</li>
        <li>Try refreshing Obsidian and starting again</li>
        <li>Check if Todoist is accessible in your browser</li>
      </ul>
    </div>
  </motion.div>
);

// Helper function to get display names for setup steps
function getStepDisplayName(step: string): string {
  const displayNames: Record<string, string> = {
    'token_validation': 'Validated Todoist connection',
    'folder_creation': 'Created organized folder structure',
    'defaults_application': 'Applied ADHD-optimized settings',
    'migration_scan': 'Scanned for existing tasks',
    'migration_execution': 'Imported existing tasks',
    'sync_initialization': 'Initialized sync engine'
  };
  
  return displayNames[step] || step;
}
