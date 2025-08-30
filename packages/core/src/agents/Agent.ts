import { Task, TaskContext, TaskResult, AgentConfig, Logger } from '@ai-app-builder/shared';

export interface Agent {
  readonly config: AgentConfig;
  execute(task: Task, context: TaskContext): Promise<TaskResult>;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export abstract class BaseAgent implements Agent {
  readonly config: AgentConfig;
  protected logger: Logger;
  protected isInitialized: boolean = false;

  constructor(config: AgentConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger || this.createDefaultLogger();
  }

  private createDefaultLogger(): Logger {
    return {
      info: (message: string, meta?: any) => {
        console.log(`[${this.config.name}] ${message}`, meta || '');
      },
      warn: (message: string, meta?: any) => {
        console.warn(`[${this.config.name}] ${message}`, meta || '');
      },
      error: (message: string, meta?: any) => {
        console.error(`[${this.config.name}] ${message}`, meta || '');
      },
      debug: (message: string, meta?: any) => {
        console.debug(`[${this.config.name}] ${message}`, meta || '');
      },
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.logger.info(`Initializing agent: ${this.config.name}`);
    await this.onInitialize();
    this.isInitialized = true;
    this.logger.info(`Agent initialized: ${this.config.name}`);
  }

  async execute(task: Task, context: TaskContext): Promise<TaskResult> {
    if (!this.isInitialized) {
      throw new Error(`Agent ${this.config.name} is not initialized`);
    }

    this.logger.info(`Executing task: ${task.description}`);
    
    try {
      const result = await this.onExecute(task, context);
      this.logger.info(`Task completed successfully: ${task.description}`);
      return result;
    } catch (error) {
      this.logger.error(`Task failed: ${task.description}`, { error });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.info(`Shutting down agent: ${this.config.name}`);
    await this.onShutdown();
    this.isInitialized = false;
    this.logger.info(`Agent shutdown complete: ${this.config.name}`);
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onExecute(task: Task, context: TaskContext): Promise<TaskResult>;
  protected abstract onShutdown(): Promise<void>;

  protected createTaskResult(
    success: boolean,
    output?: any,
    errors?: string[],
    artifacts?: any[]
  ): TaskResult {
    return {
      success,
      output,
      errors,
      artifacts,
      metrics: {
        duration: 0,
        tokensUsed: 0,
        toolCalls: 0,
        memoryUsage: 0,
      },
      auditLog: [],
    };
  }
}