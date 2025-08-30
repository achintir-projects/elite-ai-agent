import { Task, TaskContext, TaskResult, AgentConfig, Logger } from '@ai-app-builder/shared';
import { BaseAgent } from './Agent';
import { ModelRouter } from '../models/ModelRouter';
import { ToolRegistry } from '../tooling/ToolRegistry';

export interface PlanStep {
  id: string;
  description: string;
  agent: string;
  tools: string[];
  dependencies?: string[];
  estimatedDuration?: number;
  priority: 'low' | 'medium' | 'high';
}

export interface ExecutionPlan {
  taskId: string;
  steps: PlanStep[];
  estimatedTotalDuration: number;
  criticalPath: string[];
  resources: {
    agents: string[];
    tools: string[];
  };
}

export class PlannerAgent extends BaseAgent {
  private modelRouter: ModelRouter;
  private toolRegistry: ToolRegistry;

  constructor(
    config: AgentConfig,
    logger: Logger,
    modelRouter: ModelRouter,
    toolRegistry: ToolRegistry
  ) {
    super(config, logger);
    this.modelRouter = modelRouter;
    this.toolRegistry = toolRegistry;
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('Initializing PlannerAgent...');
    // Initialize any planner-specific resources
    this.logger.info('PlannerAgent initialized successfully');
  }

  protected async onExecute(task: Task, context: TaskContext): Promise<TaskResult> {
    this.logger.info(`Planning task: ${task.description}`);

    try {
      // Analyze task requirements
      const analysis = await this.analyzeTask(task, context);
      
      // Generate execution plan
      const plan = await this.generatePlan(task, analysis, context);
      
      // Validate plan
      const validation = await this.validatePlan(plan, context);
      if (!validation.valid) {
        throw new Error(`Plan validation failed: ${validation.errors.join(', ')}`);
      }

      // Optimize plan
      const optimizedPlan = await this.optimizePlan(plan, context);

      return this.createTaskResult(
        true,
        {
          plan: optimizedPlan,
          analysis,
          validation,
        },
        undefined,
        [{
          type: 'plan',
          path: `plan_${task.id}.json`,
          metadata: {
            taskId: task.id,
            steps: optimizedPlan.steps.length,
            estimatedDuration: optimizedPlan.estimatedTotalDuration,
          },
        }]
      );
    } catch (error) {
      return this.createTaskResult(
        false,
        undefined,
        [error instanceof Error ? error.message : String(error)]
      );
    }
  }

  protected async onShutdown(): Promise<void> {
    this.logger.info('Shutting down PlannerAgent...');
    // Clean up any planner-specific resources
    this.logger.info('PlannerAgent shutdown complete');
  }

  private async analyzeTask(task: Task, context: TaskContext): Promise<any> {
    this.logger.debug('Analyzing task requirements...');

    // Use AI model to analyze task
    const prompt = this.createAnalysisPrompt(task, context);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software development planner. Analyze tasks and provide detailed breakdowns of requirements, complexity, and needed resources.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 1000,
      });

      return JSON.parse(response.content);
    } catch (error) {
      this.logger.error('Failed to analyze task with AI', { error });
      // Fallback to basic analysis
      return this.fallbackAnalysis(task, context);
    }
  }

  private createAnalysisPrompt(task: Task, context: TaskContext): string {
    return `
Analyze the following task and provide a detailed breakdown:

Task: ${task.description}
Type: ${task.type}
Priority: ${task.priority}

Context:
- Files: ${context.files.length} files
- Environment: ${context.environment.os}
- Available tools: ${context.tools.map(t => t.name).join(', ')}

Please provide a JSON response with the following structure:
{
  "complexity": "low|medium|high",
  "estimatedDuration": number (in minutes),
  "requiredSkills": string[],
  "requiredTools": string[],
  "potentialRisks": string[],
  "dependencies": string[],
  "successCriteria": string[]
}
`;
  }

  private fallbackAnalysis(task: Task, context: TaskContext): any {
    // Basic analysis based on task type and context
    const complexityMap = {
      'code-generation': 'medium',
      'testing': 'low',
      'packaging': 'low',
      'security': 'high',
      'rtl': 'high',
      'documentation': 'low',
    };

    return {
      complexity: complexityMap[task.type] || 'medium',
      estimatedDuration: 30,
      requiredSkills: [task.type],
      requiredTools: context.tools.slice(0, 3).map(t => t.name),
      potentialRisks: ['Unknown dependencies'],
      dependencies: [],
      successCriteria: ['Task completed successfully'],
    };
  }

  private async generatePlan(task: Task, analysis: any, context: TaskContext): Promise<ExecutionPlan> {
    this.logger.debug('Generating execution plan...');

    // Use AI model to generate detailed plan
    const prompt = this.createPlanPrompt(task, analysis, context);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software development planner. Create detailed execution plans with clear steps, dependencies, and resource allocation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 2000,
      });

      const planData = JSON.parse(response.content);
      return this.transformToExecutionPlan(task.id, planData);
    } catch (error) {
      this.logger.error('Failed to generate plan with AI', { error });
      // Fallback to basic plan generation
      return this.fallbackPlan(task, analysis, context);
    }
  }

  private createPlanPrompt(task: Task, analysis: any, context: TaskContext): string {
    return `
Create a detailed execution plan for the following task:

Task: ${task.description}
Type: ${task.type}
Priority: ${task.priority}

Analysis:
- Complexity: ${analysis.complexity}
- Estimated Duration: ${analysis.estimatedDuration} minutes
- Required Skills: ${analysis.requiredSkills.join(', ')}
- Required Tools: ${analysis.requiredTools.join(', ')}
- Potential Risks: ${analysis.potentialRisks.join(', ')}
- Dependencies: ${analysis.dependencies.join(', ')}
- Success Criteria: ${analysis.successCriteria.join(', ')}

Available Agents: planner, researcher, coder, tester, packager, reviewer, security, dx-writer
Available Tools: ${context.tools.map(t => t.name).join(', ')}

Please provide a JSON response with the following structure:
{
  "steps": [
    {
      "id": "step1",
      "description": "Step description",
      "agent": "agent_name",
      "tools": ["tool1", "tool2"],
      "dependencies": ["step0"],
      "estimatedDuration": 5,
      "priority": "medium"
    }
  ],
  "estimatedTotalDuration": 30,
  "criticalPath": ["step1", "step2", "step3"],
  "resources": {
    "agents": ["coder", "tester"],
    "tools": ["file-read", "file-write"]
  }
}
`;
  }

  private transformToExecutionPlan(taskId: string, planData: any): ExecutionPlan {
    return {
      taskId,
      steps: planData.steps.map((step: any) => ({
        id: step.id,
        description: step.description,
        agent: step.agent,
        tools: step.tools || [],
        dependencies: step.dependencies || [],
        estimatedDuration: step.estimatedDuration || 5,
        priority: step.priority || 'medium',
      })),
      estimatedTotalDuration: planData.estimatedTotalDuration || 30,
      criticalPath: planData.criticalPath || [],
      resources: {
        agents: planData.resources?.agents || [],
        tools: planData.resources?.tools || [],
      },
    };
  }

  private fallbackPlan(task: Task, analysis: any, context: TaskContext): ExecutionPlan {
    // Basic plan based on task type
    const agentMap = {
      'code-generation': 'coder',
      'testing': 'tester',
      'packaging': 'packager',
      'security': 'security',
      'rtl': 'coder',
      'documentation': 'dx-writer',
    };

    const steps: PlanStep[] = [
      {
        id: 'step1',
        description: `Execute ${task.type} task`,
        agent: agentMap[task.type] || 'coder',
        tools: analysis.requiredTools.slice(0, 2),
        estimatedDuration: analysis.estimatedDuration || 30,
        priority: task.priority,
      },
    ];

    return {
      taskId: task.id,
      steps,
      estimatedTotalDuration: analysis.estimatedDuration || 30,
      criticalPath: ['step1'],
      resources: {
        agents: [agentMap[task.type] || 'coder'],
        tools: analysis.requiredTools,
      },
    };
  }

  private async validatePlan(plan: ExecutionPlan, context: TaskContext): Promise<{ valid: boolean; errors: string[] }> {
    this.logger.debug('Validating execution plan...');
    
    const errors: string[] = [];

    // Validate steps
    if (!plan.steps || plan.steps.length === 0) {
      errors.push('Plan must have at least one step');
    }

    // Validate agent availability
    const availableAgents = ['planner', 'researcher', 'coder', 'tester', 'packager', 'reviewer', 'security', 'dx-writer'];
    for (const step of plan.steps) {
      if (!availableAgents.includes(step.agent)) {
        errors.push(`Invalid agent specified: ${step.agent}`);
      }
    }

    // Validate tool availability
    const availableTools = context.tools.map(t => t.name);
    for (const step of plan.steps) {
      for (const tool of step.tools) {
        if (!availableTools.includes(tool)) {
          errors.push(`Tool not available: ${tool}`);
        }
      }
    }

    // Validate dependencies
    const stepIds = new Set(plan.steps.map(s => s.id));
    for (const step of plan.steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            errors.push(`Invalid dependency: ${dep} depends on non-existent step`);
          }
        }
      }
    }

    // Check for circular dependencies
    if (this.hasCircularDependencies(plan.steps)) {
      errors.push('Plan contains circular dependencies');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private hasCircularDependencies(steps: PlanStep[]): boolean {
    const graph = new Map<string, string[]>();
    
    // Build dependency graph
    for (const step of steps) {
      graph.set(step.id, step.dependencies || []);
    }

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      if (recursionStack.has(node)) {
        return true;
      }
      
      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);

      for (const neighbor of graph.get(node) || []) {
        if (hasCycle(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const step of steps) {
      if (hasCycle(step.id)) {
        return true;
      }
    }

    return false;
  }

  private async optimizePlan(plan: ExecutionPlan, context: TaskContext): Promise<ExecutionPlan> {
    this.logger.debug('Optimizing execution plan...');
    
    // Simple optimizations:
    // 1. Parallelize independent steps
    // 2. Merge similar steps
    // 3. Optimize tool usage

    const optimizedSteps = [...plan.steps];
    
    // Sort steps by dependencies (topological sort)
    const sortedSteps = this.topologicalSort(optimizedSteps);
    
    // Try to parallelize independent steps
    const parallelGroups = this.groupParallelSteps(sortedSteps);
    
    // Recalculate estimated duration based on parallel execution
    const optimizedDuration = this.calculateParallelDuration(parallelGroups);
    
    return {
      ...plan,
      steps: sortedSteps,
      estimatedTotalDuration: optimizedDuration,
    };
  }

  private topologicalSort(steps: PlanStep[]): PlanStep[] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // Build graph and calculate in-degrees
    for (const step of steps) {
      graph.set(step.id, step.dependencies || []);
      inDegree.set(step.id, (step.dependencies || []).length);
    }

    const result: PlanStep[] = [];
    const queue = steps.filter(step => inDegree.get(step.id) === 0);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighbor of steps.filter(s => (s.dependencies || []).includes(current.id))) {
        inDegree.set(neighbor.id, inDegree.get(neighbor.id)! - 1);
        if (inDegree.get(neighbor.id) === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  private groupParallelSteps(steps: PlanStep[]): PlanStep[][] {
    const groups: PlanStep[][] = [];
    const processed = new Set<string>();

    for (const step of steps) {
      if (processed.has(step.id)) {
        continue;
      }

      const group = [step];
      processed.add(step.id);

      // Find steps that can run in parallel (no dependencies between them)
      for (const otherStep of steps) {
        if (processed.has(otherStep.id)) {
          continue;
        }

        const hasDependency = (step.dependencies || []).includes(otherStep.id) ||
                           (otherStep.dependencies || []).includes(step.id);

        if (!hasDependency) {
          group.push(otherStep);
          processed.add(otherStep.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private calculateParallelDuration(groups: PlanStep[][]): number {
    return groups.reduce((total, group) => {
      const maxDuration = Math.max(...group.map(step => step.estimatedDuration || 0));
      return total + maxDuration;
    }, 0);
  }
}