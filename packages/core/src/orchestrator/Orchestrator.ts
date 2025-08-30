import { EventEmitter } from 'events';
import { Task, Agent, AgentConfig, TaskResult, Logger, ProgressCallback } from '@ai-app-builder/shared';
import { AgentFactory } from '../agents/AgentFactory';
import { MemoryManager } from '../memory/MemoryManager';
import { ModelRouter } from '../models/ModelRouter';
import { ToolRegistry } from '../tooling/ToolRegistry';

export interface OrchestratorConfig {
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableAuditLog?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export class Orchestrator extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private agents: Map<string, Agent> = new Map();
  private runningTasks: Set<string> = new Set();
  private config: Required<OrchestratorConfig>;
  private logger: Logger;
  private agentFactory: AgentFactory;
  private memoryManager: MemoryManager;
  private modelRouter: ModelRouter;
  private toolRegistry: ToolRegistry;

  constructor(
    config: OrchestratorConfig = {},
    logger?: Logger,
    agentFactory?: AgentFactory,
    memoryManager?: MemoryManager,
    modelRouter?: ModelRouter,
    toolRegistry?: ToolRegistry
  ) {
    super();
    
    this.config = {
      maxConcurrentTasks: 3,
      taskTimeout: 300000, // 5 minutes
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableAuditLog: true,
      logLevel: 'info',
      ...config,
    };

    this.logger = logger || this.createDefaultLogger();
    this.agentFactory = agentFactory || new AgentFactory(this.logger);
    this.memoryManager = memoryManager || new MemoryManager(this.logger);
    this.modelRouter = modelRouter || new ModelRouter(this.logger);
    this.toolRegistry = toolRegistry || new ToolRegistry(this.logger);

    this.setupEventHandlers();
  }

  private createDefaultLogger(): Logger {
    return {
      info: (message: string, meta?: any) => {
        if (this.config.logLevel === 'debug' || this.config.logLevel === 'info') {
          console.log(`[Orchestrator] ${message}`, meta || '');
        }
      },
      warn: (message: string, meta?: any) => {
        if (this.config.logLevel === 'debug' || this.config.logLevel === 'info' || this.config.logLevel === 'warn') {
          console.warn(`[Orchestrator] ${message}`, meta || '');
        }
      },
      error: (message: string, meta?: any) => {
        if (this.config.logLevel !== 'silent') {
          console.error(`[Orchestrator] ${message}`, meta || '');
        }
      },
      debug: (message: string, meta?: any) => {
        if (this.config.logLevel === 'debug') {
          console.debug(`[Orchestrator] ${message}`, meta || '');
        }
      },
    };
  }

  private setupEventHandlers(): void {
    this.on('task:started', (task: Task) => {
      this.logger.info(`Task started: ${task.id} - ${task.description}`, { task });
    });

    this.on('task:completed', (task: Task, result: TaskResult) => {
      this.logger.info(`Task completed: ${task.id}`, { task, result });
    });

    this.on('task:failed', (task: Task, error: Error) => {
      this.logger.error(`Task failed: ${task.id} - ${error.message}`, { task, error });
    });

    this.on('task:progress', (taskId: string, progress: number, message: string) => {
      this.logger.debug(`Task progress: ${taskId} - ${progress}% - ${message}`);
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing orchestrator...');
    
    try {
      // Initialize components
      await this.memoryManager.initialize();
      await this.modelRouter.initialize();
      await this.toolRegistry.initialize();
      await this.agentFactory.initialize(this.modelRouter, this.toolRegistry);

      // Register default agents
      await this.registerDefaultAgents();

      this.logger.info('Orchestrator initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize orchestrator', { error });
      throw error;
    }
  }

  private async registerDefaultAgents(): Promise<void> {
    const defaultAgents: AgentConfig[] = [
      {
        id: 'planner',
        name: 'Planner Agent',
        type: 'planner',
        model: 'deepseek-coder',
        tools: ['web-search', 'file-read', 'git-status'],
      },
      {
        id: 'researcher',
        name: 'Researcher Agent',
        type: 'researcher',
        model: 'deepseek-coder',
        tools: ['web-search', 'file-read', 'documentation-lookup'],
      },
      {
        id: 'coder',
        name: 'Coder Agent',
        type: 'coder',
        model: 'deepseek-coder',
        tools: ['file-read', 'file-write', 'shell-exec', 'git-add'],
      },
      {
        id: 'tester',
        name: 'Tester Agent',
        type: 'tester',
        model: 'deepseek-coder',
        tools: ['shell-exec', 'file-read', 'test-runner'],
      },
      {
        id: 'packager',
        name: 'Packager Agent',
        type: 'packager',
        model: 'deepseek-coder',
        tools: ['shell-exec', 'file-read', 'package-builder'],
      },
      {
        id: 'reviewer',
        name: 'Reviewer Agent',
        type: 'reviewer',
        model: 'deepseek-coder',
        tools: ['file-read', 'lint-runner', 'test-runner'],
      },
      {
        id: 'security',
        name: 'Security Agent',
        type: 'security',
        model: 'deepseek-coder',
        tools: ['security-scan', 'file-read', 'dependency-check'],
      },
      {
        id: 'dx-writer',
        name: 'DX Writer Agent',
        type: 'dx-writer',
        model: 'deepseek-coder',
        tools: ['file-read', 'file-write', 'documentation-generator'],
      },
    ];

    for (const agentConfig of defaultAgents) {
      const agent = await this.agentFactory.createAgent(agentConfig);
      this.agents.set(agentConfig.id, agent);
      this.logger.info(`Registered agent: ${agentConfig.name} (${agentConfig.type})`);
    }
  }

  async submitTask(task: Task): Promise<string> {
    this.logger.info(`Submitting task: ${task.id} - ${task.description}`);
    
    // Validate task
    if (!task.description || !task.type) {
      throw new Error('Task must have description and type');
    }

    // Store task
    this.tasks.set(task.id, task);

    // Add to queue
    this.emit('task:submitted', task);

    // Try to execute immediately if under concurrency limit
    if (this.runningTasks.size < this.config.maxConcurrentTasks) {
      this.executeTask(task.id).catch(error => {
        this.logger.error(`Failed to execute task ${task.id}`, { error });
      });
    }

    return task.id;
  }

  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (this.runningTasks.has(taskId)) {
      this.logger.warn(`Task ${taskId} is already running`);
      return;
    }

    this.runningTasks.add(taskId);
    
    try {
      // Update task status
      const updatedTask = { ...task, status: 'in_progress' as const, updatedAt: new Date() };
      this.tasks.set(taskId, updatedTask);
      this.emit('task:started', updatedTask);

      // Execute with retry logic
      const result = await this.executeWithRetry(taskId);

      // Update task with result
      const completedTask = { 
        ...updatedTask, 
        status: 'completed' as const, 
        updatedAt: new Date(),
        result 
      };
      this.tasks.set(taskId, completedTask);
      this.emit('task:completed', completedTask, result);

    } catch (error) {
      // Update task with error
      const failedTask = { 
        ...task, 
        status: 'failed' as const, 
        updatedAt: new Date(),
        result: {
          success: false,
          errors: [error instanceof Error ? error.message : String(error)],
          metrics: { duration: 0, tokensUsed: 0, toolCalls: 0, memoryUsage: 0 },
          auditLog: [],
        }
      };
      this.tasks.set(taskId, failedTask);
      this.emit('task:failed', failedTask, error instanceof Error ? error : new Error(String(error)));

    } finally {
      this.runningTasks.delete(taskId);
      
      // Process next task in queue
      this.processNextTask();
    }
  }

  private async executeWithRetry(taskId: string): Promise<TaskResult> {
    const task = this.tasks.get(taskId)!;
    let lastError: Error;

    for (let attempt = 1; attempt <= (this.config.enableRetry ? this.config.maxRetries : 1); attempt++) {
      try {
        this.logger.info(`Executing task ${taskId} (attempt ${attempt})`);
        
        // Set up timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Task execution timeout')), this.config.taskTimeout);
        });

        // Execute task
        const executionPromise = this.executeTaskLogic(taskId);
        
        // Race with timeout
        const result = await Promise.race([executionPromise, timeoutPromise]);
        
        this.logger.info(`Task ${taskId} completed successfully`);
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Task ${taskId} attempt ${attempt} failed: ${lastError.message}`);
        
        if (attempt < (this.config.enableRetry ? this.config.maxRetries : 1)) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }

    throw lastError!;
  }

  private async executeTaskLogic(taskId: string): Promise<TaskResult> {
    const task = this.tasks.get(taskId)!;
    const startTime = Date.now();

    // Get task context from memory
    const context = await this.memoryManager.getTaskContext(taskId);
    
    // Select appropriate agent based on task type
    const agent = this.selectAgent(task);
    if (!agent) {
      throw new Error(`No agent available for task type: ${task.type}`);
    }

    // Execute task through agent
    const result = await agent.execute(task, context);

    // Store result in memory
    await this.memoryManager.storeTaskResult(taskId, result);

    // Calculate metrics
    const duration = Date.now() - startTime;
    result.metrics.duration = duration;

    // Audit log if enabled
    if (this.config.enableAuditLog) {
      await this.memoryManager.addAuditEntry(taskId, {
        timestamp: new Date(),
        agent: agent.config.id,
        action: 'execute_task',
        input: { taskId, taskType: task.type },
        output: { success: result.success, artifacts: result.artifacts?.length },
      });
    }

    return result;
  }

  private selectAgent(task: Task): Agent | null {
    // Simple agent selection based on task type
    // This can be enhanced with more sophisticated routing logic
    const agentTypeMap: Record<Task['type'], string> = {
      'code-generation': 'coder',
      'testing': 'tester',
      'packaging': 'packager',
      'security': 'security',
      'rtl': 'coder', // For now, use coder for RTL tasks
      'documentation': 'dx-writer',
    };

    const agentId = agentTypeMap[task.type];
    return this.agents.get(agentId) || null;
  }

  private processNextTask(): void {
    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }

    // Find next pending task
    for (const [taskId, task] of this.tasks) {
      if (task.status === 'pending' && !this.runningTasks.has(taskId)) {
        // Check dependencies
        const dependenciesMet = !task.dependencies || 
          task.dependencies.every(depId => {
            const depTask = this.tasks.get(depId);
            return depTask && depTask.status === 'completed';
          });

        if (dependenciesMet) {
          this.executeTask(taskId).catch(error => {
            this.logger.error(`Failed to execute task ${taskId}`, { error });
          });
          break;
        }
      }
    }
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null;
  }

  async getAllTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === 'in_progress') {
      // Cannot cancel running tasks in this simple implementation
      // In a real implementation, you would need to signal the agent to stop
      this.logger.warn(`Cannot cancel running task: ${taskId}`);
      return false;
    }

    const cancelledTask = { ...task, status: 'cancelled' as const, updatedAt: new Date() };
    this.tasks.set(taskId, cancelledTask);
    this.emit('task:cancelled', cancelledTask);

    return true;
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    return this.agents.get(agentId) || null;
  }

  async getAllAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async registerAgent(agentConfig: AgentConfig): Promise<void> {
    const agent = await this.agentFactory.createAgent(agentConfig);
    this.agents.set(agentConfig.id, agent);
    this.logger.info(`Registered custom agent: ${agentConfig.name} (${agentConfig.type})`);
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down orchestrator...');
    
    // Cancel all running tasks
    for (const taskId of this.runningTasks) {
      await this.cancelTask(taskId);
    }

    // Shutdown components
    await this.agentFactory.shutdown();
    await this.memoryManager.shutdown();
    await this.modelRouter.shutdown();
    await this.toolRegistry.shutdown();

    this.logger.info('Orchestrator shutdown complete');
  }

  // Progress tracking
  onTaskProgress(taskId: string, callback: ProgressCallback): void {
    const handler = (eventTaskId: string, progress: number, message: string) => {
      if (eventTaskId === taskId) {
        callback(progress, message);
      }
    };
    
    this.on('task:progress', handler);
    
    // Return cleanup function
    return () => {
      this.off('task:progress', handler);
    };
  }
}