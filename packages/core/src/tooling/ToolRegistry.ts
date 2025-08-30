import { ToolCall, ToolResult, Logger } from '@ai-app-builder/shared';

export interface ToolConfig {
  name: string;
  description: string;
  version: string;
  type: 'builtin' | 'external' | 'ai';
  category: 'file' | 'shell' | 'git' | 'build' | 'test' | 'security' | 'package' | 'documentation';
  timeout: number;
  retryable: boolean;
  maxRetries: number;
  parameters: ToolParameter[];
  env?: Record<string, string>;
  dependencies?: string[];
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  validation?: ValidationRule[];
}

export interface ValidationRule {
  type: 'min' | 'max' | 'regex' | 'enum' | 'custom';
  value: any;
  message: string;
}

export interface ToolExecutionContext {
  workingDirectory: string;
  environment: Record<string, string>;
  timeout: number;
  logger: Logger;
}

export interface ToolMetrics {
  calls: number;
  successes: number;
  failures: number;
  averageLatency: number;
  totalDuration: number;
  lastUsed: Date;
}

export class ToolRegistry {
  private logger: Logger;
  private tools: Map<string, Tool> = new Map();
  private metrics: Map<string, ToolMetrics> = new Map();
  private context: ToolExecutionContext;

  constructor(logger?: Logger) {
    this.logger = logger || this.createDefaultLogger();
    this.context = {
      workingDirectory: process.cwd(),
      environment: { ...process.env },
      timeout: 30000,
      logger: this.logger,
    };
  }

  private createDefaultLogger(): Logger {
    return {
      info: (message: string, meta?: any) => {
        console.log(`[ToolRegistry] ${message}`, meta || '');
      },
      warn: (message: string, meta?: any) => {
        console.warn(`[ToolRegistry] ${message}`, meta || '');
      },
      error: (message: string, meta?: any) => {
        console.error(`[ToolRegistry] ${message}`, meta || '');
      },
      debug: (message: string, meta?: any) => {
        console.debug(`[ToolRegistry] ${message}`, meta || '');
      },
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing ToolRegistry...');
    
    try {
      // Register built-in tools
      await this.registerBuiltinTools();
      
      this.logger.info('ToolRegistry initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ToolRegistry', { error });
      throw error;
    }
  }

  private async registerBuiltinTools(): Promise<void> {
    const builtinTools: ToolConfig[] = [
      {
        name: 'file-read',
        description: 'Read file contents',
        version: '1.0.0',
        type: 'builtin',
        category: 'file',
        timeout: 10000,
        retryable: true,
        maxRetries: 3,
        parameters: [
          {
            name: 'path',
            type: 'string',
            description: 'Path to the file to read',
            required: true,
          },
          {
            name: 'encoding',
            type: 'string',
            description: 'File encoding',
            required: false,
            default: 'utf8',
          },
        ],
      },
      {
        name: 'file-write',
        description: 'Write content to a file',
        version: '1.0.0',
        type: 'builtin',
        category: 'file',
        timeout: 10000,
        retryable: true,
        maxRetries: 3,
        parameters: [
          {
            name: 'path',
            type: 'string',
            description: 'Path to the file to write',
            required: true,
          },
          {
            name: 'content',
            type: 'string',
            description: 'Content to write to the file',
            required: true,
          },
          {
            name: 'encoding',
            type: 'string',
            description: 'File encoding',
            required: false,
            default: 'utf8',
          },
        ],
      },
      {
        name: 'shell-exec',
        description: 'Execute shell command',
        version: '1.0.0',
        type: 'builtin',
        category: 'shell',
        timeout: 30000,
        retryable: false,
        maxRetries: 1,
        parameters: [
          {
            name: 'command',
            type: 'string',
            description: 'Command to execute',
            required: true,
          },
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory',
            required: false,
          },
          {
            name: 'env',
            type: 'object',
            description: 'Environment variables',
            required: false,
          },
          {
            name: 'timeout',
            type: 'number',
            description: 'Command timeout in milliseconds',
            required: false,
          },
        ],
      },
      {
        name: 'git-status',
        description: 'Get git repository status',
        version: '1.0.0',
        type: 'builtin',
        category: 'git',
        timeout: 10000,
        retryable: true,
        maxRetries: 3,
        parameters: [
          {
            name: 'path',
            type: 'string',
            description: 'Repository path',
            required: false,
          },
        ],
      },
      {
        name: 'web-search',
        description: 'Search the web for information',
        version: '1.0.0',
        type: 'ai',
        category: 'documentation',
        timeout: 15000,
        retryable: true,
        maxRetries: 3,
        parameters: [
          {
            name: 'query',
            type: 'string',
            description: 'Search query',
            required: true,
          },
          {
            name: 'num',
            type: 'number',
            description: 'Number of results',
            required: false,
            default: 10,
          },
        ],
      },
      {
        name: 'lint-runner',
        description: 'Run linter on code files',
        version: '1.0.0',
        type: 'builtin',
        category: 'build',
        timeout: 20000,
        retryable: true,
        maxRetries: 3,
        parameters: [
          {
            name: 'filePath',
            type: 'string',
            description: 'Path to the file to lint',
            required: true,
          },
          {
            name: 'content',
            type: 'string',
            description: 'File content',
            required: true,
          },
          {
            name: 'language',
            type: 'string',
            description: 'Programming language',
            required: true,
          },
        ],
      },
      {
        name: 'test-runner',
        description: 'Run tests',
        version: '1.0.0',
        type: 'builtin',
        category: 'test',
        timeout: 60000,
        retryable: true,
        maxRetries: 3,
        parameters: [
          {
            name: 'framework',
            type: 'string',
            description: 'Test framework',
            required: true,
          },
          {
            name: 'command',
            type: 'string',
            description: 'Test command',
            required: true,
          },
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory',
            required: false,
          },
        ],
      },
      {
        name: 'dependency-check',
        description: 'Check dependencies for vulnerabilities',
        version: '1.0.0',
        type: 'builtin',
        category: 'security',
        timeout: 30000,
        retryable: true,
        maxRetries: 3,
        parameters: [
          {
            name: 'targetFiles',
            type: 'array',
            description: 'Files to check',
            required: true,
          },
          {
            name: 'severity',
            type: 'string',
            description: 'Minimum severity level',
            required: false,
            default: 'medium',
          },
        ],
      },
      {
        name: 'secret-scanner',
        description: 'Scan for secrets and sensitive information',
        version: '1.0.0',
        type: 'builtin',
        category: 'security',
        timeout: 20000,
        retryable: true,
        maxRetries: 3,
        parameters: [
          {
            name: 'targetFiles',
            type: 'array',
            description: 'Files to scan',
            required: true,
          },
        ],
      },
    ];

    for (const toolConfig of builtinTools) {
      await this.registerTool(toolConfig);
    }
  }

  async registerTool(config: ToolConfig): Promise<void> {
    try {
      const tool = await this.createTool(config);
      this.tools.set(config.name, tool);
      
      // Initialize metrics
      this.metrics.set(config.name, {
        calls: 0,
        successes: 0,
        failures: 0,
        averageLatency: 0,
        totalDuration: 0,
        lastUsed: new Date(),
      });

      this.logger.info(`Registered tool: ${config.name}`);
    } catch (error) {
      this.logger.error(`Failed to register tool: ${config.name}`, { error });
      throw error;
    }
  }

  private async createTool(config: ToolConfig): Promise<Tool> {
    switch (config.type) {
      case 'builtin':
        return new BuiltinTool(config, this.context);
      case 'external':
        return new ExternalTool(config, this.context);
      case 'ai':
        return new AITool(config, this.context);
      default:
        throw new Error(`Unknown tool type: ${config.type}`);
    }
  }

  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  getTool(toolName: string): Tool | null {
    return this.tools.get(toolName) || null;
  }

  async executeTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const startTime = Date.now();
    let metrics = this.metrics.get(toolName)!;

    try {
      this.logger.debug(`Executing tool: ${toolName}`, { args });

      // Validate arguments
      const validation = this.validateArguments(tool.config, args);
      if (!validation.valid) {
        throw new Error(`Invalid arguments: ${validation.errors.join(', ')}`);
      }

      // Execute tool
      const result = await tool.execute(args);

      // Update metrics
      const duration = Date.now() - startTime;
      metrics.calls++;
      metrics.successes++;
      metrics.totalDuration += duration;
      metrics.averageLatency = metrics.totalDuration / metrics.calls;
      metrics.lastUsed = new Date();

      this.logger.debug(`Tool executed successfully: ${toolName}`, { duration });

      return result;

    } catch (error) {
      // Update error metrics
      const duration = Date.now() - startTime;
      metrics.calls++;
      metrics.failures++;
      metrics.totalDuration += duration;
      metrics.averageLatency = metrics.totalDuration / metrics.calls;
      metrics.lastUsed = new Date();

      this.logger.error(`Tool execution failed: ${toolName}`, { error, args });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }

  private validateArguments(config: ToolConfig, args: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required parameters
    for (const param of config.parameters) {
      if (param.required && !(param.name in args)) {
        errors.push(`Missing required parameter: ${param.name}`);
      }
    }

    // Validate parameter types and values
    for (const [name, value] of Object.entries(args)) {
      const param = config.parameters.find(p => p.name === name);
      if (!param) {
        errors.push(`Unknown parameter: ${name}`);
        continue;
      }

      // Type validation
      if (value !== null && value !== undefined) {
        const typeError = this.validateType(name, value, param.type);
        if (typeError) {
          errors.push(typeError);
        }
      }

      // Validation rules
      if (param.validation) {
        for (const rule of param.validation) {
          const ruleError = this.validateRule(name, value, rule);
          if (ruleError) {
            errors.push(ruleError);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validateType(name: string, value: any, expectedType: string): string | null {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (actualType !== expectedType) {
      return `Parameter '${name}' should be of type ${expectedType}, got ${actualType}`;
    }

    return null;
  }

  private validateRule(name: string, value: any, rule: ValidationRule): string | null {
    switch (rule.type) {
      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          return rule.message;
        }
        break;
      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          return rule.message;
        }
        break;
      case 'regex':
        if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
          return rule.message;
        }
        break;
      case 'enum':
        if (!rule.value.includes(value)) {
          return rule.message;
        }
        break;
    }

    return null;
  }

  getToolMetrics(toolName?: string): ToolMetrics | Map<string, ToolMetrics> {
    if (toolName) {
      return this.metrics.get(toolName) || {
        calls: 0,
        successes: 0,
        failures: 0,
        averageLatency: 0,
        totalDuration: 0,
        lastUsed: new Date(),
      };
    }

    return new Map(this.metrics);
  }

  getToolConfigs(): ToolConfig[] {
    return Array.from(this.tools.values()).map(tool => tool.config);
  }

  updateContext(context: Partial<ToolExecutionContext>): void {
    this.context = { ...this.context, ...context };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down ToolRegistry...');
    
    // Shutdown all tools
    for (const tool of this.tools.values()) {
      try {
        await tool.shutdown();
      } catch (error) {
        this.logger.error(`Failed to shutdown tool: ${tool.config.name}`, { error });
      }
    }

    this.tools.clear();
    this.metrics.clear();
    
    this.logger.info('ToolRegistry shutdown complete');
  }
}

export abstract class Tool {
  readonly config: ToolConfig;
  protected context: ToolExecutionContext;

  constructor(config: ToolConfig, context: ToolExecutionContext) {
    this.config = config;
    this.context = context;
  }

  abstract execute(args: Record<string, any>): Promise<ToolResult>;
  abstract shutdown(): Promise<void>;

  protected createToolResult(success: boolean, output?: any, error?: string, stdout?: string, stderr?: string, exitCode?: number): ToolResult {
    return {
      success,
      output,
      error,
      stdout,
      stderr,
      exitCode,
      duration: 0,
    };
  }
}

class BuiltinTool extends Tool {
  async execute(args: Record<string, any>): Promise<ToolResult> {
    switch (this.config.name) {
      case 'file-read':
        return this.executeFileRead(args);
      case 'file-write':
        return this.executeFileWrite(args);
      case 'shell-exec':
        return this.executeShellExec(args);
      case 'git-status':
        return this.executeGitStatus(args);
      case 'lint-runner':
        return this.executeLintRunner(args);
      case 'test-runner':
        return this.executeTestRunner(args);
      case 'dependency-check':
        return this.executeDependencyCheck(args);
      case 'secret-scanner':
        return this.executeSecretScanner(args);
      default:
        return this.createToolResult(false, undefined, `Unknown builtin tool: ${this.config.name}`);
    }
  }

  private async executeFileRead(args: Record<string, any>): Promise<ToolResult> {
    const { path, encoding = 'utf8' } = args;
    
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(path, encoding);
      
      return this.createToolResult(true, content, undefined, content);
    } catch (error) {
      return this.createToolResult(false, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  private async executeFileWrite(args: Record<string, any>): Promise<ToolResult> {
    const { path, content, encoding = 'utf8' } = args;
    
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(path, content, encoding);
      
      return this.createToolResult(true, { path, size: content.length });
    } catch (error) {
      return this.createToolResult(false, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  private async executeShellExec(args: Record<string, any>): Promise<ToolResult> {
    const { command, cwd, env, timeout } = args;
    
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const options: any = {
        cwd: cwd || this.context.workingDirectory,
        env: { ...this.context.environment, ...env },
        timeout: timeout || this.config.timeout,
      };

      const { stdout, stderr } = await execAsync(command, options);
      
      return this.createToolResult(true, { stdout, stderr }, undefined, stdout, stderr);
    } catch (error: any) {
      return this.createToolResult(false, undefined, error.message, error.stdout, error.stderr, error.code);
    }
  }

  private async executeGitStatus(args: Record<string, any>): Promise<ToolResult> {
    const { path = this.context.workingDirectory } = args;
    
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('git status --porcelain', { cwd: path });
      
      return this.createToolResult(true, { status: stdout.trim() }, undefined, stdout);
    } catch (error: any) {
      return this.createToolResult(false, undefined, error.message, error.stdout);
    }
  }

  private async executeLintRunner(args: Record<string, any>): Promise<ToolResult> {
    // Simplified lint runner - in real implementation would use actual linters
    const { filePath, content, language } = args;
    
    try {
      // Basic validation
      const errors: string[] = [];
      
      if (language === 'javascript' || language === 'typescript') {
        // Basic JS/TS checks
        if (content.includes('var ')) {
          errors.push('Use const/let instead of var');
        }
        if (content.includes('console.log')) {
          errors.push('Remove console.log statements');
        }
      }
      
      if (errors.length > 0) {
        return this.createToolResult(false, { errors }, errors.join(', '));
      }
      
      return this.createToolResult(true, { message: 'No linting issues found' });
    } catch (error) {
      return this.createToolResult(false, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  private async executeTestRunner(args: Record<string, any>): Promise<ToolResult> {
    const { command, cwd } = args;
    
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout, stderr } = await execAsync(command, { 
        cwd: cwd || this.context.workingDirectory 
      });
      
      return this.createToolResult(true, { stdout, stderr }, undefined, stdout, stderr);
    } catch (error: any) {
      return this.createToolResult(false, undefined, error.message, error.stdout, error.stderr, error.code);
    }
  }

  private async executeDependencyCheck(args: Record<string, any>): Promise<ToolResult> {
    // Simplified dependency check - in real implementation would use actual security scanners
    const { targetFiles, severity } = args;
    
    try {
      // Mock vulnerability check
      const vulnerabilities = [];
      
      return this.createToolResult(true, { vulnerabilities, message: 'No vulnerabilities found' });
    } catch (error) {
      return this.createToolResult(false, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  private async executeSecretScanner(args: Record<string, any>): Promise<ToolResult> {
    const { targetFiles } = args;
    
    try {
      const secrets = [];
      
      // Basic secret detection patterns
      const secretPatterns = [
        /api[_-]?key\s*[:=]\s*['"]([a-zA-Z0-9]{32,})['"]/gi,
        /password\s*[:=]\s*['"]([a-zA-Z0-9]{8,})['"]/gi,
        /secret\s*[:=]\s*['"]([a-zA-Z0-9]{16,})['"]/gi,
      ];
      
      for (const filePath of targetFiles) {
        try {
          const fs = await import('fs/promises');
          const content = await fs.readFile(filePath, 'utf8');
          
          for (const pattern of secretPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
              secrets.push({
                file: filePath,
                line: content.substring(0, match.index).split('\n').length,
                type: 'potential-secret',
                match: match[0],
              });
            }
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
      
      return this.createToolResult(true, { secrets });
    } catch (error) {
      return this.createToolResult(false, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  async shutdown(): Promise<void> {
    // Builtin tools don't need special shutdown
  }
}

class ExternalTool extends Tool {
  async execute(args: Record<string, any>): Promise<ToolResult> {
    // Execute external tool command
    const command = this.buildCommand(args);
    
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.context.workingDirectory,
        env: { ...this.context.environment, ...this.config.env },
        timeout: this.config.timeout,
      });
      
      return this.createToolResult(true, { stdout, stderr }, undefined, stdout, stderr);
    } catch (error: any) {
      return this.createToolResult(false, undefined, error.message, error.stdout, error.stderr, error.code);
    }
  }

  private buildCommand(args: Record<string, any>): string {
    // Build command line from tool config and arguments
    // This is a simplified implementation
    return this.config.name;
  }

  async shutdown(): Promise<void> {
    // External tools don't need special shutdown
  }
}

class AITool extends Tool {
  async execute(args: Record<string, any>): Promise<ToolResult> {
    // Execute AI-powered tool
    // This would integrate with AI models for specialized tasks
    switch (this.config.name) {
      case 'web-search':
        return this.executeWebSearch(args);
      default:
        return this.createToolResult(false, undefined, `Unknown AI tool: ${this.config.name}`);
    }
  }

  private async executeWebSearch(args: Record<string, any>): Promise<ToolResult> {
    const { query, num = 10 } = args;
    
    try {
      // Use z-ai-web-dev-sdk for web search
      const ZAI = await import('z-ai-web-dev-sdk');
      const zai = await ZAI.create();
      
      const searchResult = await zai.functions.invoke('web_search', {
        query,
        num,
      });

      return this.createToolResult(true, searchResult);
    } catch (error) {
      return this.createToolResult(false, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  async shutdown(): Promise<void> {
    // AI tools don't need special shutdown
  }
}