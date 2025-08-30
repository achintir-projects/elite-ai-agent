import { Task, TaskContext, TaskResult, AgentConfig, Logger } from '@ai-app-builder/shared';
import { BaseAgent } from './Agent';
import { ModelRouter } from '../models/ModelRouter';
import { ToolRegistry } from '../tooling/ToolRegistry';

export interface TestGenerationRequest {
  targetFiles: string[];
  testFramework: string;
  testType: 'unit' | 'integration' | 'e2e' | 'property' | 'fuzz';
  coverageTarget?: number;
  requirements: string[];
  constraints: string[];
}

export interface TestGenerationResult {
  generatedTests: GeneratedTest[];
  testConfig: TestConfiguration;
  coverageReport: CoverageReport;
  testCommands: TestCommand[];
  qualityMetrics: TestQualityMetrics;
}

export interface GeneratedTest {
  path: string;
  content: string;
  type: 'unit' | 'integration' | 'e2e' | 'property' | 'fuzz';
  targetFile: string;
  targetFunctions: string[];
  description: string;
  assertions: number;
  mocks: MockDefinition[];
}

export interface MockDefinition {
  name: string;
  type: 'function' | 'module' | 'service' | 'database';
  behavior: 'stub' | 'spy' | 'fake';
  implementation: string;
  reason: string;
}

export interface TestConfiguration {
  framework: string;
  setupCommands: string[];
  environment: Record<string, string>;
  dependencies: TestDependency[];
  reporters: string[];
  timeout: number;
}

export interface TestDependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer';
  reason: string;
}

export interface CoverageReport {
  totalLines: number;
  coveredLines: number;
  totalFunctions: number;
  coveredFunctions: number;
  totalBranches: number;
  coveredBranches: number;
  percentage: number;
  files: FileCoverage[];
}

export interface FileCoverage {
  path: string;
  lines: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
}

export interface TestCommand {
  command: string;
  description: string;
  type: 'run' | 'watch' | 'coverage' | 'report';
  expected: string;
}

export interface TestQualityMetrics {
  assertionQuality: number;
  testIsolation: number;
  mockQuality: number;
  readability: number;
  maintainability: number;
  overall: number;
}

export class TesterAgent extends BaseAgent {
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
    this.logger.info('Initializing TesterAgent...');
    // Initialize tester-specific resources
    this.logger.info('TesterAgent initialized successfully');
  }

  protected async onExecute(task: Task, context: TaskContext): Promise<TaskResult> {
    this.logger.info(`Generating tests for task: ${task.description}`);

    try {
      // Parse test generation request
      const request = await this.parseTestRequest(task, context);
      
      // Generate tests
      const generationResult = await this.generateTests(request, context);
      
      // Validate generated tests
      const validation = await this.validateTests(generationResult, context);
      if (!validation.valid) {
        throw new Error(`Test validation failed: ${validation.errors.join(', ')}`);
      }

      // Apply test changes
      const applyResult = await this.applyTestChanges(generationResult, context);

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
          ...generationResult.generatedTests.map(test => ({
            type: 'file' as const,
            path: test.path,
            metadata: {
              testType: test.type,
              targetFile: test.targetFile,
              assertions: test.assertions,
              mocks: test.mocks.length,
            },
          })),
          {
            type: 'test-report' as const,
            path: `coverage_${task.id}.json`,
            metadata: {
              coverage: generationResult.coverageReport.percentage,
              tests: generationResult.generatedTests.length,
            },
          },
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
    this.logger.info('Shutting down TesterAgent...');
    // Clean up tester-specific resources
    this.logger.info('TesterAgent shutdown complete');
  }

  private async parseTestRequest(task: Task, context: TaskContext): Promise<TestGenerationRequest> {
    this.logger.debug('Parsing test generation request...');

    // Use AI model to parse the task into a structured test request
    const prompt = this.createRequestParsingPrompt(task, context);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software testing engineer. Parse task descriptions into structured test generation requests with clear requirements and test specifications.',
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
      return this.normalizeTestRequest(data, context);
    } catch (error) {
      this.logger.error('Failed to parse request with AI', { error });
      // Fallback to basic request parsing
      return this.fallbackRequestParsing(task, context);
    }
  }

  private createRequestParsingPrompt(task: Task, context: TaskContext): string {
    const existingFiles = context.files.map(f => `${f.path} (${f.language})`).join('\n');

    return `
Parse the following task into a structured test generation request:

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
  "targetFiles": [
    "path/to/file.js",
    "path/to/another-file.js"
  ],
  "testFramework": "jest|pytest|go-test|etc",
  "testType": "unit|integration|e2e|property|fuzz",
  "coverageTarget": 80,
  "requirements": [
    "Test requirement 1",
    "Test requirement 2"
  ],
  "constraints": [
    "Test constraint 1",
    "Test constraint 2"
  ]
}

Identify the files that need testing and the appropriate test framework based on the existing codebase.
`;
  }

  private normalizeTestRequest(data: any, context: TaskContext): TestGenerationRequest {
    return {
      targetFiles: data.targetFiles || this.detectTargetFiles(context),
      testFramework: data.testFramework || this.detectTestFramework(context),
      testType: data.testType || 'unit',
      coverageTarget: data.coverageTarget || 80,
      requirements: data.requirements || [],
      constraints: data.constraints || [],
    };
  }

  private detectTargetFiles(context: TaskContext): string[] {
    // Simple detection - in a real implementation, this would be more sophisticated
    return context.files
      .filter(f => !f.path.includes('test') && !f.path.includes('spec'))
      .map(f => f.path)
      .slice(0, 3); // Limit to 3 files for now
  }

  private detectTestFramework(context: TaskContext): string {
    // Detect existing test framework from package.json or existing test files
    const testFiles = context.files.filter(f => 
      f.path.includes('test') || f.path.includes('spec')
    );

    if (testFiles.length > 0) {
      const languages = testFiles.map(f => f.language);
      if (languages.includes('javascript') || languages.includes('typescript')) {
        return 'jest';
      } else if (languages.includes('python')) {
        return 'pytest';
      } else if (languages.includes('go')) {
        return 'go-test';
      }
    }

    // Default based on main language
    const mainLanguage = this.detectMainLanguage(context);
    const frameworkMap: Record<string, string> = {
      'javascript': 'jest',
      'typescript': 'jest',
      'python': 'pytest',
      'go': 'go-test',
      'rust': 'cargo-test',
      'java': 'junit',
    };

    return frameworkMap[mainLanguage] || 'jest';
  }

  private detectMainLanguage(context: TaskContext): string {
    if (context.files.length === 0) return 'javascript';
    
    const languageCounts = context.files.reduce((acc, file) => {
      acc[file.language] = (acc[file.language] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(languageCounts)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  private fallbackRequestParsing(task: Task, context: TaskContext): TestGenerationRequest {
    return {
      targetFiles: this.detectTargetFiles(context),
      testFramework: this.detectTestFramework(context),
      testType: 'unit',
      coverageTarget: 80,
      requirements: [
        'Test all public functions',
        'Achieve good code coverage',
        'Include edge cases',
      ],
      constraints: [
        'Tests should be maintainable',
        'Tests should run quickly',
      ],
    };
  }

  private async generateTests(request: TestGenerationRequest, context: TaskContext): Promise<TestGenerationResult> {
    this.logger.debug('Generating tests...');

    const generatedTests: GeneratedTest[] = [];

    // Generate tests for each target file
    for (const targetFile of request.targetFiles) {
      const fileContent = context.files.find(f => f.path === targetFile)?.content || '';
      const tests = await this.generateFileTests(targetFile, fileContent, request, context);
      generatedTests.push(...tests);
    }

    // Generate test configuration
    const testConfig = await this.generateTestConfiguration(request, context);

    // Generate coverage report (simulated)
    const coverageReport = await this.generateCoverageReport(generatedTests, request);

    // Generate test commands
    const testCommands = await this.generateTestCommands(request, testConfig);

    // Calculate quality metrics
    const qualityMetrics = await this.calculateTestQualityMetrics(generatedTests, request);

    return {
      generatedTests,
      testConfig,
      coverageReport,
      testCommands,
      qualityMetrics,
    };
  }

  private async generateFileTests(targetFile: string, fileContent: string, request: TestGenerationRequest, context: TaskContext): Promise<GeneratedTest[]> {
    const prompt = this.createFileTestPrompt(targetFile, fileContent, request);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert ${request.testFramework} testing engineer. Generate comprehensive, high-quality tests following best practices.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 3000,
      });

      const data = JSON.parse(response.content);
      return data.tests.map((test: any) => ({
        path: test.path,
        content: test.content,
        type: request.testType,
        targetFile,
        targetFunctions: test.targetFunctions || [],
        description: test.description,
        assertions: test.assertions || 0,
        mocks: (test.mocks || []).map((mock: any) => ({
          name: mock.name,
          type: mock.type,
          behavior: mock.behavior,
          implementation: mock.implementation,
          reason: mock.reason,
        })),
      }));
    } catch (error) {
      this.logger.error(`Failed to generate tests for ${targetFile}`, { error });
      return [];
    }
  }

  private createFileTestPrompt(targetFile: string, fileContent: string, request: TestGenerationRequest): string {
    return `
Generate comprehensive tests for the following file:

File: ${targetFile}
Test Framework: ${request.testFramework}
Test Type: ${request.testType}
Coverage Target: ${request.coverageTarget}%

File Content:
\`\`\`
${fileContent}
\`\`\`

Requirements:
${request.requirements.map(r => `- ${r}`).join('\n')}

Constraints:
${request.constraints.map(c => `- ${c}`).join('\n')}

Please provide a JSON response with the following structure:
{
  "tests": [
    {
      "path": "test/file.test.js",
      "content": "Complete test file content",
      "targetFunctions": ["function1", "function2"],
      "description": "What this test file covers",
      "assertions": 5,
      "mocks": [
        {
          "name": "mockName",
          "type": "function|module|service|database",
          "behavior": "stub|spy|fake",
          "implementation": "mock implementation code",
          "reason": "Why this mock is needed"
        }
      ]
    }
  ]
}

Generate tests that cover all important functionality, including edge cases and error conditions.
Include proper setup, teardown, and mocking where necessary.
Ensure tests are isolated, readable, and maintainable.
`;
  }

  private async generateTestConfiguration(request: TestGenerationRequest, context: TaskContext): Promise<TestConfiguration> {
    const dependencies: TestDependency[] = [];

    // Add framework-specific dependencies
    if (request.testFramework === 'jest') {
      dependencies.push({
        name: 'jest',
        version: '^29.0.0',
        type: 'dev',
        reason: 'Test framework',
      });
      dependencies.push({
        name: '@types/jest',
        version: '^29.0.0',
        type: 'dev',
        reason: 'TypeScript types for Jest',
      });
    } else if (request.testFramework === 'pytest') {
      dependencies.push({
        name: 'pytest',
        version: '^7.0.0',
        type: 'dev',
        reason: 'Test framework',
      });
      dependencies.push({
        name: 'pytest-cov',
        version: '^4.0.0',
        type: 'dev',
        reason: 'Coverage reporting',
      });
    }

    return {
      framework: request.testFramework,
      setupCommands: [
        `npm install ${dependencies.filter(d => d.type === 'dev').map(d => `${d.name}@${d.version}`).join(' ')}`,
      ],
      environment: {
        NODE_ENV: 'test',
      },
      dependencies,
      reporters: ['default'],
      timeout: 30000,
    };
  }

  private async generateCoverageReport(generatedTests: GeneratedTest[], request: TestGenerationRequest): Promise<CoverageReport> {
    // Simulate coverage report - in a real implementation, this would run the tests and collect actual coverage
    const totalLines = 100; // Placeholder
    const coveredLines = Math.floor(totalLines * (request.coverageTarget || 80) / 100);
    const totalFunctions = 10; // Placeholder
    const coveredFunctions = Math.floor(totalFunctions * (request.coverageTarget || 80) / 100);
    const totalBranches = 20; // Placeholder
    const coveredBranches = Math.floor(totalBranches * (request.coverageTarget || 80) / 100);

    return {
      totalLines,
      coveredLines,
      totalFunctions,
      coveredFunctions,
      totalBranches,
      coveredBranches,
      percentage: request.coverageTarget || 80,
      files: generatedTests.map(test => ({
        path: test.targetFile,
        lines: { total: 50, covered: 40, percentage: 80 },
        functions: { total: 5, covered: 4, percentage: 80 },
        branches: { total: 10, covered: 8, percentage: 80 },
      })),
    };
  }

  private async generateTestCommands(request: TestGenerationRequest, testConfig: TestConfiguration): Promise<TestCommand[]> {
    const commands: TestCommand[] = [];

    if (request.testFramework === 'jest') {
      commands.push({
        command: 'npm test',
        description: 'Run all tests',
        type: 'run',
        expected: 'Tests pass successfully',
      });
      commands.push({
        command: 'npm test -- --coverage',
        description: 'Run tests with coverage',
        type: 'coverage',
        expected: 'Coverage report generated',
      });
      commands.push({
        command: 'npm test -- --watch',
        description: 'Run tests in watch mode',
        type: 'watch',
        expected: 'Tests running in watch mode',
      });
    } else if (request.testFramework === 'pytest') {
      commands.push({
        command: 'pytest',
        description: 'Run all tests',
        type: 'run',
        expected: 'Tests pass successfully',
      });
      commands.push({
        command: 'pytest --cov',
        description: 'Run tests with coverage',
        type: 'coverage',
        expected: 'Coverage report generated',
      });
    }

    return commands;
  }

  private async calculateTestQualityMetrics(generatedTests: GeneratedTest[], request: TestGenerationRequest): Promise<TestQualityMetrics> {
    // Simple quality metrics calculation
    const totalAssertions = generatedTests.reduce((sum, test) => sum + test.assertions, 0);
    const totalTests = generatedTests.length;
    const totalMocks = generatedTests.reduce((sum, test) => sum + test.mocks.length, 0);

    return {
      assertionQuality: Math.min(totalAssertions / (totalTests * 3), 1), // Aim for 3 assertions per test
      testIsolation: 0.8, // Placeholder
      mockQuality: Math.min(totalMocks / totalTests, 1), // Not too many mocks per test
      readability: 0.8, // Placeholder
      maintainability: 0.8, // Placeholder
      overall: 0.8, // Placeholder
    };
  }

  private async validateTests(result: TestGenerationResult, context: TaskContext): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic validation
    if (result.generatedTests.length === 0) {
      errors.push('No tests were generated');
    }

    // Check if tests meet coverage target
    if (result.coverageReport.percentage < (result.testConfig.coverageTarget || 80)) {
      errors.push(`Coverage target not met: ${result.coverageReport.percentage}% < ${result.testConfig.coverageTarget}%`);
    }

    // Validate test syntax if linter is available
    if (this.toolRegistry.hasTool('lint-runner')) {
      for (const test of result.generatedTests) {
        try {
          const lintResult = await this.toolRegistry.executeTool('lint-runner', {
            filePath: test.path,
            content: test.content,
            language: test.path.split('.').pop() || 'javascript',
          });

          if (!lintResult.success) {
            errors.push(`Linting failed for test ${test.path}: ${lintResult.error}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to lint test ${test.path}`, { error });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private async applyTestChanges(result: TestGenerationResult, context: TaskContext): Promise<any> {
    const appliedChanges = [];

    // Apply generated test files
    for (const test of result.generatedTests) {
      try {
        if (this.toolRegistry.hasTool('file-write')) {
          await this.toolRegistry.executeTool('file-write', {
            path: test.path,
            content: test.content,
          });
          appliedChanges.push({ path: test.path, action: 'created' });
        }
      } catch (error) {
        this.logger.error(`Failed to create test file ${test.path}`, { error });
      }
    }

    // Update package.json with test dependencies if needed
    if (this.toolRegistry.hasTool('file-read') && this.toolRegistry.hasTool('file-write')) {
      try {
        const packageJsonResult = await this.toolRegistry.executeTool('file-read', {
          path: 'package.json',
        });

        if (packageJsonResult.success) {
          const packageJson = JSON.parse(packageJsonResult.output);
          let updated = false;

          // Add dev dependencies
          if (!packageJson.devDependencies) {
            packageJson.devDependencies = {};
          }

          for (const dep of result.testConfig.dependencies) {
            if (dep.type === 'dev' && !packageJson.devDependencies[dep.name]) {
              packageJson.devDependencies[dep.name] = dep.version;
              updated = true;
            }
          }

          // Add test script if not present
          if (!packageJson.scripts) {
            packageJson.scripts = {};
          }

          if (!packageJson.scripts.test) {
            packageJson.scripts.test = result.testConfig.framework === 'jest' ? 'jest' : 'pytest';
            updated = true;
          }

          if (updated) {
            await this.toolRegistry.executeTool('file-write', {
              path: 'package.json',
              content: JSON.stringify(packageJson, null, 2),
            });
            appliedChanges.push({ path: 'package.json', action: 'modified' });
          }
        }
      } catch (error) {
        this.logger.error('Failed to update package.json', { error });
      }
    }

    return { appliedChanges };
  }
}