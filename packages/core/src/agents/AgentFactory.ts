import { AgentConfig, Logger } from '@ai-app-builder/shared';
import { Agent } from './Agent';
import { PlannerAgent } from './PlannerAgent';
import { ResearcherAgent } from './ResearcherAgent';
import { CoderAgent } from './CoderAgent';
import { TesterAgent } from './TesterAgent';
import { PackagerAgent } from './PackagerAgent';
import { ReviewerAgent } from './ReviewerAgent';
import { SecurityAgent } from './SecurityAgent';
import { DXWriterAgent } from './DXWriterAgent';
import { ModelRouter } from '../models/ModelRouter';
import { ToolRegistry } from '../tooling/ToolRegistry';

export class AgentFactory {
  private logger: Logger;
  private modelRouter: ModelRouter | null = null;
  private toolRegistry: ToolRegistry | null = null;

  constructor(logger?: Logger) {
    this.logger = logger || this.createDefaultLogger();
  }

  private createDefaultLogger(): Logger {
    return {
      info: (message: string, meta?: any) => {
        console.log(`[AgentFactory] ${message}`, meta || '');
      },
      warn: (message: string, meta?: any) => {
        console.warn(`[AgentFactory] ${message}`, meta || '');
      },
      error: (message: string, meta?: any) => {
        console.error(`[AgentFactory] ${message}`, meta || '');
      },
      debug: (message: string, meta?: any) => {
        console.debug(`[AgentFactory] ${message}`, meta || '');
      },
    };
  }

  async initialize(modelRouter: ModelRouter, toolRegistry: ToolRegistry): Promise<void> {
    this.logger.info('Initializing AgentFactory...');
    
    this.modelRouter = modelRouter;
    this.toolRegistry = toolRegistry;

    this.logger.info('AgentFactory initialized successfully');
  }

  async createAgent(config: AgentConfig): Promise<Agent> {
    if (!this.modelRouter || !this.toolRegistry) {
      throw new Error('AgentFactory not initialized');
    }

    this.logger.info(`Creating agent: ${config.name} (${config.type})`);

    let agent: Agent;

    switch (config.type) {
      case 'planner':
        agent = new PlannerAgent(config, this.logger, this.modelRouter, this.toolRegistry);
        break;
      case 'researcher':
        agent = new ResearcherAgent(config, this.logger, this.modelRouter, this.toolRegistry);
        break;
      case 'coder':
        agent = new CoderAgent(config, this.logger, this.modelRouter, this.toolRegistry);
        break;
      case 'tester':
        agent = new TesterAgent(config, this.logger, this.modelRouter, this.toolRegistry);
        break;
      case 'packager':
        agent = new PackagerAgent(config, this.logger, this.modelRouter, this.toolRegistry);
        break;
      case 'reviewer':
        agent = new ReviewerAgent(config, this.logger, this.modelRouter, this.toolRegistry);
        break;
      case 'security':
        agent = new SecurityAgent(config, this.logger, this.modelRouter, this.toolRegistry);
        break;
      case 'dx-writer':
        agent = new DXWriterAgent(config, this.logger, this.modelRouter, this.toolRegistry);
        break;
      default:
        throw new Error(`Unknown agent type: ${config.type}`);
    }

    await agent.initialize();
    this.logger.info(`Agent created successfully: ${config.name}`);

    return agent;
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down AgentFactory...');
    // Agents are shut down by the orchestrator
    this.logger.info('AgentFactory shutdown complete');
  }
}