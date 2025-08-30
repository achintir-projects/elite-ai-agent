import { Task, TaskContext, TaskResult, AgentConfig, Logger, FileDiff } from '@ai-app-builder/shared';
import { BaseAgent } from './Agent';
import { ModelRouter } from '../models/ModelRouter';
import { ToolRegistry } from '../tooling/ToolRegistry';

export interface CodeGenerationRequest {
  description: string;
  language: string;
  framework?: string;
  files: {
    path: string;
    content?: string;
    purpose: string;
  }[];
  requirements: string[];
  constraints: string[];
  style?: {
    indentation: 'spaces' | 'tabs';
    indentSize: number;
    lineEnding: 'lf' | 'crlf';
  };
}

export interface CodeGenerationResult {
  generatedFiles: GeneratedFile[];
  modifiedFiles: ModifiedFile[];
  buildInstructions: BuildInstruction[];
  testInstructions: TestInstruction[];
  dependencies: Dependency[];
  documentation: Documentation;
  quality: QualityMetrics;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  purpose: string;
  size: number;
  lines: number;
}

export interface ModifiedFile {
  path: string;
  originalContent: string;
  newContent: string;
  changes: FileDiff[];
  reason: string;
}

export interface BuildInstruction {
  step: number;
  command: string;
  description: string;
  expectedOutput?: string;
}

export interface TestInstruction {
  framework: string;
  command: string;
  description: string;
  expectedBehavior: string;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer';
  reason: string;
}

export interface Documentation {
  overview: string;
  api: ApiDocumentation[];
  usage: UsageExample[];
  configuration: ConfigurationOption[];
}

export interface ApiDocumentation {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable';
  signature: string;
  description: string;
  parameters?: Parameter[];
  returns?: string;
  examples: string[];
}

export interface Parameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

export interface UsageExample {
  title: string;
  code: string;
  description: string;
  expectedOutput?: string;
}

export interface ConfigurationOption {
  name: string;
  type: string;
  description: string;
  defaultValue?: string;
  possibleValues?: string[];
  required: boolean;
}

export interface QualityMetrics {
  codeQuality: number;
  testability: number;
  maintainability: number;
  security: number;
  performance: number;
  overall: number;
}

export class CoderAgent extends BaseAgent {
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
    this.logger.info('Initializing CoderAgent...');
    // Initialize coder-specific resources
    this.logger.info('CoderAgent initialized successfully');
  }

  protected async onExecute(task: Task, context: TaskContext): Promise<TaskResult> {
    this.logger.info(`Generating code for task: ${task.description}`);

    try {
      // Parse code generation request
      const request = await this.parseCodeRequest(task, context);
      
      // Generate code
      const generationResult = await this.generateCode(request, context);
      
      // Validate generated code
      const validation = await this.validateCode(generationResult, context);
      if (!validation.valid) {
        throw new Error(`Code validation failed: ${validation.errors.join(', ')}`);
      }

      // Apply code changes
      const applyResult = await this.applyCodeChanges(generationResult, context);

      return this.createTaskResult(
        true,
        {
          request,
          generationResult,
          validation,
          applyResult,
        },
        undefined,
        [
          ...generationResult.generatedFiles.map(file => ({
            type: 'file' as const,
            path: file.path,
            metadata: {
              language: file.language,
              size: file.size,
              lines: file.lines,
              purpose: file.purpose,
            },
          })),
          ...generationResult.modifiedFiles.map(file => ({
            type: 'file' as const,
            path: file.path,
            metadata: {
              modified: true,
              changes: file.changes.length,
              reason: file.reason,
            },
          })),
        ]
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
    this.logger.info('Shutting down CoderAgent...');
    // Clean up coder-specific resources
    this.logger.info('CoderAgent shutdown complete');
  }

  private async parseCodeRequest(task: Task, context: TaskContext): Promise<CodeGenerationRequest> {
    this.logger.debug('Parsing code generation request...');

    // Use AI model to parse the task into a structured request
    const prompt = this.createRequestParsingPrompt(task, context);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software developer. Parse task descriptions into structured code generation requests with clear requirements and file specifications.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 1000,
      });

      const data = JSON.parse(response.content);
      return this.normalizeCodeRequest(data, context);
    } catch (error) {
      this.logger.error('Failed to parse request with AI', { error });
      // Fallback to basic request parsing
      return this.fallbackRequestParsing(task, context);
    }
  }

  private createRequestParsingPrompt(task: Task, context: TaskContext): string {
    const existingFiles = context.files.map(f => `${f.path} (${f.language})`).join('\n');

    return `
Parse the following task into a structured code generation request:

Task: ${task.description}
Type: ${task.type}
Priority: ${task.priority}

Existing Files:
${existingFiles}

Environment:
- OS: ${context.environment.os}
- Available tools: ${context.environment.availableTools.join(', ')}

Please provide a JSON response with the following structure:
{
  "description": "Detailed description of what needs to be implemented",
  "language": "Primary programming language",
  "framework": "Framework to use (if applicable)",
  "files": [
    {
      "path": "path/to/file.js",
      "content": "existing content (if modifying)",
      "purpose": "What this file should do"
    }
  ],
  "requirements": [
    "Functional requirement 1",
    "Functional requirement 2"
  ],
  "constraints": [
    "Performance constraint",
    "Security constraint"
  ],
  "style": {
    "indentation": "spaces",
    "indentSize": 2,
    "lineEnding": "lf"
  }
}

Be specific about file paths, purposes, and requirements. Consider the existing codebase structure.
`;
  }

  private normalizeCodeRequest(data: any, context: TaskContext): CodeGenerationRequest {
    return {
      description: data.description || task.description,
      language: data.language || this.detectLanguage(context),
      framework: data.framework,
      files: (data.files || []).map((file: any) => ({
        path: file.path,
        content: file.content,
        purpose: file.purpose || 'General purpose',
      })),
      requirements: data.requirements || [],
      constraints: data.constraints || [],
      style: {
        indentation: data.style?.indentation || 'spaces',
        indentSize: data.style?.indentSize || 2,
        lineEnding: data.style?.lineEnding || 'lf',
      },
    };
  }

  private detectLanguage(context: TaskContext): string {
    if (context.files.length > 0) {
      const languages = context.files.map(f => f.language);
      const mostCommon = languages.reduce((acc, lang) => {
        acc[lang] = (acc[lang] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return Object.entries(mostCommon).sort(([,a], [,b]) => b - a)[0]?.[0] || 'javascript';
    }
    return 'javascript';
  }

  private fallbackRequestParsing(task: Task, context: TaskContext): CodeGenerationRequest {
    return {
      description: task.description,
      language: this.detectLanguage(context),
      files: context.files.map(f => ({
        path: f.path,
        content: f.content,
        purpose: 'Existing file to be modified',
      })),
      requirements: [
        'Implement the requested functionality',
        'Follow best practices',
        'Ensure code quality',
      ],
      constraints: [
        'Must work with existing codebase',
        'Should be maintainable',
      ],
      style: {
        indentation: 'spaces',
        indentSize: 2,
        lineEnding: 'lf',
      },
    };
  }

  private async generateCode(request: CodeGenerationRequest, context: TaskContext): Promise<CodeGenerationResult> {
    this.logger.debug('Generating code...');

    const generatedFiles: GeneratedFile[] = [];
    const modifiedFiles: ModifiedFile[] = [];
    const dependencies: Dependency[] = [];

    // Generate code for each file
    for (const fileSpec of request.files) {
      const existingFile = context.files.find(f => f.path === fileSpec.path);
      
      if (existingFile) {
        // Modify existing file
        const modification = await this.generateFileModification(fileSpec, existingFile, request);
        modifiedFiles.push(modification);
      } else {
        // Generate new file
        const generated = await this.generateNewFile(fileSpec, request);
        generatedFiles.push(generated);
      }
    }

    // Generate dependencies
    const deps = await this.generateDependencies(request, context);
    dependencies.push(...deps);

    // Generate build and test instructions
    const buildInstructions = await this.generateBuildInstructions(request, context);
    const testInstructions = await this.generateTestInstructions(request, context);

    // Generate documentation
    const documentation = await this.generateDocumentation(request, generatedFiles, modifiedFiles);

    // Calculate quality metrics
    const quality = await this.calculateQualityMetrics(generatedFiles, modifiedFiles, request);

    return {
      generatedFiles,
      modifiedFiles,
      buildInstructions,
      testInstructions,
      dependencies,
      documentation,
      quality,
    };
  }

  private async generateNewFile(fileSpec: any, request: CodeGenerationRequest): Promise<GeneratedFile> {
    const prompt = this.createFileGenerationPrompt(fileSpec, request);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert ${request.language} developer. Generate high-quality, production-ready code following best practices.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 2000,
      });

      const content = response.content;
      
      return {
        path: fileSpec.path,
        content,
        language: request.language,
        purpose: fileSpec.purpose,
        size: content.length,
        lines: content.split('\n').length,
      };
    } catch (error) {
      this.logger.error(`Failed to generate file ${fileSpec.path}`, { error });
      throw error;
    }
  }

  private createFileGenerationPrompt(fileSpec: any, request: CodeGenerationRequest): string {
    return `
Generate a new file with the following specifications:

File Path: ${fileSpec.path}
Language: ${request.language}
Framework: ${request.framework || 'None'}
Purpose: ${fileSpec.purpose}

Requirements:
${request.requirements.map(r => `- ${r}`).join('\n')}

Constraints:
${request.constraints.map(c => `- ${c}`).join('\n')}

Style:
- Indentation: ${request.style.indentation}
- Indent Size: ${request.style.indentSize}
- Line Ending: ${request.style.lineEnding}

Please generate the complete file content. Include proper imports, error handling, and documentation.
Ensure the code follows best practices for ${request.language} and is production-ready.
`;
  }

  private async generateFileModification(fileSpec: any, existingFile: any, request: CodeGenerationRequest): Promise<ModifiedFile> {
    const prompt = this.createFileModificationPrompt(fileSpec, existingFile, request);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert ${request.language} developer. Modify existing code while preserving its structure and adding new functionality.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 2000,
      });

      const newContent = response.content;
      const changes = this.calculateDiffs(existingFile.content, newContent);
      
      return {
        path: fileSpec.path,
        originalContent: existingFile.content,
        newContent,
        changes,
        reason: fileSpec.purpose,
      };
    } catch (error) {
      this.logger.error(`Failed to modify file ${fileSpec.path}`, { error });
      throw error;
    }
  }

  private createFileModificationPrompt(fileSpec: any, existingFile: any, request: CodeGenerationRequest): string {
    return `
Modify the existing file according to the following specifications:

File Path: ${fileSpec.path}
Current Language: ${existingFile.language}
Purpose: ${fileSpec.purpose}

Existing Content:
\`\`\`${existingFile.language}
${existingFile.content}
\`\`\`

Requirements:
${request.requirements.map(r => `- ${r}`).join('\n')}

Constraints:
${request.constraints.map(c => `- ${c}`).join('\n')}

Please provide the complete modified file content. Preserve existing functionality that doesn't need to change, and add the new functionality as specified.
`;
  }

  private calculateDiffs(original: string, modified: string): FileDiff[] {
    // Simple diff calculation - in a real implementation, you'd use a proper diff library
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    
    const diffs: FileDiff[] = [];
    
    if (original === modified) {
      return diffs;
    }

    // For now, create a simple diff that shows the whole file as modified
    diffs.push({
      path: '',
      oldContent: original,
      newContent: modified,
      type: 'modified',
      hunks: [{
        oldStart: 1,
        oldLines: originalLines.length,
        newStart: 1,
        newLines: modifiedLines.length,
        lines: modifiedLines,
      }],
    });

    return diffs;
  }

  private async generateDependencies(request: CodeGenerationRequest, context: TaskContext): Promise<Dependency[]> {
    // Use AI to identify required dependencies
    const prompt = this.createDependencyPrompt(request, context);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software developer. Identify required dependencies for the given code generation request.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 500,
      });

      const data = JSON.parse(response.content);
      return (data.dependencies || []).map((dep: any) => ({
        name: dep.name,
        version: dep.version || 'latest',
        type: dep.type || 'runtime',
        reason: dep.reason || 'Required for functionality',
      }));
    } catch (error) {
      this.logger.error('Failed to generate dependencies', { error });
      return [];
    }
  }

  private createDependencyPrompt(request: CodeGenerationRequest, context: TaskContext): string {
    return `
Identify required dependencies for the following code generation request:

Language: ${request.language}
Framework: ${request.framework || 'None'}
Description: ${request.description}

Requirements:
${request.requirements.map(r => `- ${r}`).join('\n')}

Files to generate/modify:
${request.files.map(f => `- ${f.path}: ${f.purpose}`).join('\n')}

Please provide a JSON response with the following structure:
{
  "dependencies": [
    {
      "name": "package-name",
      "version": "version-specifier",
      "type": "runtime|dev|peer",
      "reason": "Why this dependency is needed"
    }
  ]
}

Consider the language and framework when suggesting dependencies. Only include dependencies that are actually needed.
`;
  }

  private async generateBuildInstructions(request: CodeGenerationRequest, context: TaskContext): Promise<BuildInstruction[]> {
    // Generate build instructions based on the language and framework
    const instructions: BuildInstruction[] = [];

    if (request.language === 'javascript' || request.language === 'typescript') {
      instructions.push({
        step: 1,
        command: 'npm install',
        description: 'Install dependencies',
      });
      
      if (request.framework === 'react') {
        instructions.push({
          step: 2,
          command: 'npm run build',
          description: 'Build the React application',
        });
      } else {
        instructions.push({
          step: 2,
          command: 'npm run build',
          description: 'Build the application',
        });
      }
    } else if (request.language === 'python') {
      instructions.push({
        step: 1,
        command: 'pip install -r requirements.txt',
        description: 'Install Python dependencies',
      });
    }

    return instructions;
  }

  private async generateTestInstructions(request: CodeGenerationRequest, context: TaskContext): Promise<TestInstruction[]> {
    // Generate test instructions based on the language and framework
    const instructions: TestInstruction[] = [];

    if (request.language === 'javascript' || request.language === 'typescript') {
      instructions.push({
        framework: 'jest',
        command: 'npm test',
        description: 'Run unit tests',
        expectedBehavior: 'All tests should pass',
      });
    } else if (request.language === 'python') {
      instructions.push({
        framework: 'pytest',
        command: 'pytest',
        description: 'Run Python tests',
        expectedBehavior: 'All tests should pass',
      });
    }

    return instructions;
  }

  private async generateDocumentation(request: CodeGenerationRequest, generatedFiles: GeneratedFile[], modifiedFiles: ModifiedFile[]): Promise<Documentation> {
    // Generate basic documentation
    return {
      overview: `Implementation of ${request.description}`,
      api: [],
      usage: [],
      configuration: [],
    };
  }

  private async calculateQualityMetrics(generatedFiles: GeneratedFile[], modifiedFiles: ModifiedFile[], request: CodeGenerationRequest): Promise<QualityMetrics> {
    // Simple quality metrics calculation
    const totalFiles = generatedFiles.length + modifiedFiles.length;
    const totalLines = generatedFiles.reduce((sum, f) => sum + f.lines, 0) + 
                      modifiedFiles.reduce((sum, f) => sum + f.newContent.split('\n').length, 0);

    return {
      codeQuality: 0.8, // Placeholder
      testability: 0.7, // Placeholder
      maintainability: 0.8, // Placeholder
      security: 0.9, // Placeholder
      performance: 0.8, // Placeholder
      overall: 0.8, // Placeholder
    };
  }

  private async validateCode(result: CodeGenerationResult, context: TaskContext): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic validation
    if (result.generatedFiles.length === 0 && result.modifiedFiles.length === 0) {
      errors.push('No files were generated or modified');
    }

    // Check for syntax errors if linter is available
    if (this.toolRegistry.hasTool('lint-runner')) {
      for (const file of [...result.generatedFiles, ...result.modifiedFiles]) {
        try {
          const lintResult = await this.toolRegistry.executeTool('lint-runner', {
            filePath: file.path,
            content: 'content' in file ? file.content : file.newContent,
            language: file.path.split('.').pop() || 'text',
          });

          if (!lintResult.success) {
            errors.push(`Linting failed for ${file.path}: ${lintResult.error}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to lint file ${file.path}`, { error });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private async applyCodeChanges(result: CodeGenerationResult, context: TaskContext): Promise<any> {
    const appliedChanges = [];

    // Apply generated files
    for (const file of result.generatedFiles) {
      try {
        if (this.toolRegistry.hasTool('file-write')) {
          await this.toolRegistry.executeTool('file-write', {
            path: file.path,
            content: file.content,
          });
          appliedChanges.push({ path: file.path, action: 'created' });
        }
      } catch (error) {
        this.logger.error(`Failed to create file ${file.path}`, { error });
      }
    }

    // Apply modified files
    for (const file of result.modifiedFiles) {
      try {
        if (this.toolRegistry.hasTool('file-write')) {
          await this.toolRegistry.executeTool('file-write', {
            path: file.path,
            content: file.newContent,
          });
          appliedChanges.push({ path: file.path, action: 'modified' });
        }
      } catch (error) {
        this.logger.error(`Failed to modify file ${file.path}`, { error });
      }
    }

    return { appliedChanges };
  }
}