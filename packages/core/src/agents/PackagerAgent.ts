import { Task, TaskContext, TaskResult, AgentConfig, Logger } from '@ai-app-builder/shared';
import { BaseAgent } from './Agent';
import { ModelRouter } from '../models/ModelRouter';
import { ToolRegistry } from '../tooling/ToolRegistry';

export interface PackagingRequest {
  projectPath: string;
  packageTypes: string[];
  targetPlatforms?: string[];
  version: string;
  description: string;
  buildCommand?: string;
  outputDir?: string;
  includeFiles?: string[];
  excludeFiles?: string[];
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface PackagingResult {
  packages: GeneratedPackage[];
  buildLog: string[];
  artifacts: PackageArtifact[];
  sizeReport: SizeReport;
  checksums: ChecksumReport;
  deploymentInstructions: DeploymentInstruction[];
}

export interface GeneratedPackage {
  type: string;
  path: string;
  size: number;
  platform?: string;
  architecture?: string;
  format: string;
  compression: string;
  metadata: PackageMetadata;
}

export interface PackageMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  files?: string[];
}

export interface PackageArtifact {
  path: string;
  type: 'executable' | 'library' | 'documentation' | 'configuration' | 'resource';
  size: number;
  checksum: string;
  required: boolean;
}

export interface SizeReport {
  totalSize: number;
  uncompressedSize: number;
  compressionRatio: number;
  files: FileSizeInfo[];
}

export interface FileSizeInfo {
  path: string;
  size: number;
  compressedSize: number;
  percentage: number;
}

export interface ChecksumReport {
  algorithm: string;
  files: ChecksumInfo[];
}

export interface ChecksumInfo {
  path: string;
  checksum: string;
  algorithm: string;
}

export interface DeploymentInstruction {
  platform: string;
  steps: DeploymentStep[];
  prerequisites: string[];
  estimatedTime: number;
}

export interface DeploymentStep {
  order: number;
  command: string;
  description: string;
  expectedOutput?: string;
  critical: boolean;
}

export class PackagerAgent extends BaseAgent {
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
    this.logger.info('Initializing PackagerAgent...');
    // Initialize packager-specific resources
    this.logger.info('PackagerAgent initialized successfully');
  }

  protected async onExecute(task: Task, context: TaskContext): Promise<TaskResult> {
    this.logger.info(`Packaging for task: ${task.description}`);

    try {
      // Parse packaging request
      const request = await this.parsePackagingRequest(task, context);
      
      // Generate packages
      const packagingResult = await this.generatePackages(request, context);
      
      // Validate packages
      const validation = await this.validatePackages(packagingResult, context);
      if (!validation.valid) {
        throw new Error(`Package validation failed: ${validation.errors.join(', ')}`);
      }

      return this.createTaskResult(
        true,
        {
          request,
          packagingResult,
          validation,
        },
        undefined,
        [
          ...packagingResult.packages.map(pkg => ({
            type: 'package' as const,
            path: pkg.path,
            metadata: {
              packageType: pkg.type,
              size: pkg.size,
              platform: pkg.platform,
              format: pkg.format,
            },
          })),
          {
            type: 'file' as const,
            path: `packaging_report_${task.id}.json`,
            metadata: {
              packages: packagingResult.packages.length,
              totalSize: packagingResult.sizeReport.totalSize,
              compressionRatio: packagingResult.sizeReport.compressionRatio,
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
    this.logger.info('Shutting down PackagerAgent...');
    // Clean up packager-specific resources
    this.logger.info('PackagerAgent shutdown complete');
  }

  private async parsePackagingRequest(task: Task, context: TaskContext): Promise<PackagingRequest> {
    this.logger.debug('Parsing packaging request...');

    const prompt = `
Parse the following task into a structured packaging request:

Task: ${task.description}
Type: ${task.type}
Priority: ${task.priority}

Context:
- Project path: ${context.environment.workingDirectory}
- Available tools: ${context.environment.availableTools.join(', ')}

Please provide a JSON response with the following structure:
{
  "projectPath": "path/to/project",
  "packageTypes": ["docker", "npm", "msix"],
  "targetPlatforms": ["linux", "windows", "macos"],
  "version": "1.0.0",
  "description": "Package description",
  "buildCommand": "npm run build",
  "outputDir": "dist",
  "includeFiles": ["src/**/*", "README.md"],
  "excludeFiles": ["*.test.js", "node_modules/**"],
  "dependencies": {},
  "scripts": {}
}

Identify the appropriate package types and build commands based on the project structure and requirements.
`;

    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software packaging engineer. Parse task descriptions into structured packaging requests.',
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
      return {
        projectPath: data.projectPath || context.environment.workingDirectory,
        packageTypes: data.packageTypes || ['npm'],
        targetPlatforms: data.targetPlatforms,
        version: data.version || '1.0.0',
        description: data.description || task.description,
        buildCommand: data.buildCommand,
        outputDir: data.outputDir || 'dist',
        includeFiles: data.includeFiles,
        excludeFiles: data.excludeFiles,
        dependencies: data.dependencies || {},
        scripts: data.scripts || {},
      };
    } catch (error) {
      this.logger.error('Failed to parse packaging request', { error });
      return this.fallbackPackagingRequest(task, context);
    }
  }

  private fallbackPackagingRequest(task: Task, context: TaskContext): PackagingRequest {
    return {
      projectPath: context.environment.workingDirectory,
      packageTypes: ['npm'],
      version: '1.0.0',
      description: task.description,
      outputDir: 'dist',
    };
  }

  private async generatePackages(request: PackagingRequest, context: TaskContext): Promise<PackagingResult> {
    this.logger.debug('Generating packages...');

    const packages: GeneratedPackage[] = [];
    const buildLog: string[] = [];
    const artifacts: PackageArtifact[] = [];

    // Generate packages for each type
    for (const packageType of request.packageTypes) {
      try {
        const result = await this.generatePackage(packageType, request, context);
        packages.push(result.package);
        buildLog.push(...result.buildLog);
        artifacts.push(...result.artifacts);
      } catch (error) {
        this.logger.error(`Failed to generate ${packageType} package`, { error });
        buildLog.push(`Failed to generate ${packageType} package: ${error}`);
      }
    }

    // Generate size report
    const sizeReport = await this.generateSizeReport(packages);

    // Generate checksums
    const checksums = await this.generateChecksums(packages);

    // Generate deployment instructions
    const deploymentInstructions = await this.generateDeploymentInstructions(packages, request);

    return {
      packages,
      buildLog,
      artifacts,
      sizeReport,
      checksums,
      deploymentInstructions,
    };
  }

  private async generatePackage(packageType: string, request: PackagingRequest, context: TaskContext): Promise<{ package: GeneratedPackage; buildLog: string[]; artifacts: PackageArtifact[] }> {
    this.logger.debug(`Generating ${packageType} package...`);

    const buildLog: string[] = [];
    const artifacts: PackageArtifact[] = [];

    switch (packageType) {
      case 'npm':
        return await this.generateNpmPackage(request, context);
      case 'docker':
        return await this.generateDockerPackage(request, context);
      case 'msix':
        return await this.generateMsixPackage(request, context);
      case 'electron':
        return await this.generateElectronPackage(request, context);
      default:
        throw new Error(`Unsupported package type: ${packageType}`);
    }
  }

  private async generateNpmPackage(request: PackagingRequest, context: TaskContext): Promise<{ package: GeneratedPackage; buildLog: string[]; artifacts: PackageArtifact[] }> {
    const buildLog: string[] = [];
    const artifacts: PackageArtifact[] = [];

    // Build the project if needed
    if (request.buildCommand) {
      buildLog.push(`Running build command: ${request.buildCommand}`);
      try {
        const buildResult = await this.toolRegistry.executeTool('shell-exec', {
          command: request.buildCommand,
          cwd: request.projectPath,
        });
        
        if (buildResult.success) {
          buildLog.push('Build completed successfully');
        } else {
          buildLog.push(`Build failed: ${buildResult.error}`);
        }
      } catch (error) {
        buildLog.push(`Build error: ${error}`);
      }
    }

    // Generate package.json if needed
    const packageJson = {
      name: request.description.toLowerCase().replace(/\s+/g, '-'),
      version: request.version,
      description: request.description,
      main: 'dist/index.js',
      scripts: request.scripts || {},
      dependencies: request.dependencies || {},
      devDependencies: {},
      files: request.includeFiles || ['dist/**/*'],
      keywords: ['generated', 'ai-app-builder'],
      author: 'AI App Builder',
      license: 'MIT',
    };

    const packageJsonPath = `${request.projectPath}/package.json`;
    try {
      await this.toolRegistry.executeTool('file-write', {
        path: packageJsonPath,
        content: JSON.stringify(packageJson, null, 2),
      });
      buildLog.push('Generated package.json');
    } catch (error) {
      buildLog.push(`Failed to generate package.json: ${error}`);
    }

    // Pack the package
    try {
      const packResult = await this.toolRegistry.executeTool('shell-exec', {
        command: 'npm pack',
        cwd: request.projectPath,
      });

      if (packResult.success) {
        buildLog.push('Package packed successfully');
        
        // Find the generated .tgz file
        const packageName = `${packageJson.name}-${packageJson.version}.tgz`;
        const packagePath = `${request.projectPath}/${packageName}`;
        
        artifacts.push({
          path: packagePath,
          type: 'library',
          size: 0, // Will be calculated
          checksum: '',
          required: true,
        });

        return {
          package: {
            type: 'npm',
            path: packagePath,
            size: 0, // Will be calculated
            format: 'tgz',
            compression: 'gzip',
            metadata: packageJson,
          },
          buildLog,
          artifacts,
        };
      } else {
        throw new Error(`npm pack failed: ${packResult.error}`);
      }
    } catch (error) {
      throw new Error(`Failed to pack npm package: ${error}`);
    }
  }

  private async generateDockerPackage(request: PackagingRequest, context: TaskContext): Promise<{ package: GeneratedPackage; buildLog: string[]; artifacts: PackageArtifact[] }> {
    const buildLog: string[] = [];
    const artifacts: PackageArtifact[] = [];

    // Generate Dockerfile
    const dockerfileContent = this.generateDockerfile(request);
    const dockerfilePath = `${request.projectPath}/Dockerfile`;
    
    try {
      await this.toolRegistry.executeTool('file-write', {
        path: dockerfilePath,
        content: dockerfileContent,
      });
      buildLog.push('Generated Dockerfile');
    } catch (error) {
      buildLog.push(`Failed to generate Dockerfile: ${error}`);
    }

    // Build Docker image
    const imageName = request.description.toLowerCase().replace(/\s+/g, '-') + ':' + request.version;
    try {
      const buildResult = await this.toolRegistry.executeTool('shell-exec', {
        command: `docker build -t ${imageName} .`,
        cwd: request.projectPath,
      });

      if (buildResult.success) {
        buildLog.push(`Docker image built successfully: ${imageName}`);
        
        artifacts.push({
          path: imageName,
          type: 'executable',
          size: 0,
          checksum: '',
          required: true,
        });

        return {
          package: {
            type: 'docker',
            path: imageName,
            size: 0,
            format: 'docker',
            compression: 'none',
            metadata: {
              name: imageName,
              version: request.version,
              description: request.description,
            },
          },
          buildLog,
          artifacts,
        };
      } else {
        throw new Error(`Docker build failed: ${buildResult.error}`);
      }
    } catch (error) {
      throw new Error(`Failed to build Docker image: ${error}`);
    }
  }

  private generateDockerfile(request: PackagingRequest): string {
    return `# Generated Dockerfile for ${request.description}
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
${request.buildCommand ? `RUN ${request.buildCommand}` : ''}

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
`;
  }

  private async generateMsixPackage(request: PackagingRequest, context: TaskContext): Promise<{ package: GeneratedPackage; buildLog: string[]; artifacts: PackageArtifact[] }> {
    const buildLog: string[] = [];
    const artifacts: PackageArtifact[] = [];

    // MSIX packaging is complex and requires specific tools
    // This is a simplified implementation
    buildLog.push('MSIX packaging requires Windows-specific tools and configuration');
    
    return {
      package: {
        type: 'msix',
        path: `${request.outputDir}/${request.description.toLowerCase().replace(/\s+/g, '-')}_${request.version}.msix`,
        size: 0,
        platform: 'windows',
        format: 'msix',
        compression: 'zip',
        metadata: {
          name: request.description,
          version: request.version,
          description: request.description,
        },
      },
      buildLog,
      artifacts,
    };
  }

  private async generateElectronPackage(request: PackagingRequest, context: TaskContext): Promise<{ package: GeneratedPackage; buildLog: string[]; artifacts: PackageArtifact[] }> {
    const buildLog: string[] = [];
    const artifacts: PackageArtifact[] = [];

    // Electron packaging requires electron-builder or similar
    buildLog.push('Electron packaging requires electron-builder configuration');
    
    return {
      package: {
        type: 'electron',
        path: `${request.outputDir}/${request.description.toLowerCase().replace(/\s+/g, '-')}-${request.version}.exe`,
        size: 0,
        platform: 'windows',
        format: 'exe',
        compression: 'none',
        metadata: {
          name: request.description,
          version: request.version,
          description: request.description,
        },
      },
      buildLog,
      artifacts,
    };
  }

  private async generateSizeReport(packages: GeneratedPackage[]): Promise<SizeReport> {
    // Calculate sizes (simplified - in real implementation would read actual file sizes)
    const totalSize = packages.reduce((sum, pkg) => sum + pkg.size, 0);
    const uncompressedSize = totalSize * 1.5; // Estimate
    const compressionRatio = totalSize / uncompressedSize;

    return {
      totalSize,
      uncompressedSize,
      compressionRatio,
      files: packages.map(pkg => ({
        path: pkg.path,
        size: pkg.size,
        compressedSize: pkg.size,
        percentage: (pkg.size / totalSize) * 100,
      })),
    };
  }

  private async generateChecksums(packages: GeneratedPackage[]): Promise<ChecksumReport> {
    // Generate checksums (simplified - in real implementation would calculate actual checksums)
    return {
      algorithm: 'sha256',
      files: packages.map(pkg => ({
        path: pkg.path,
        checksum: 'mock-checksum-' + pkg.path.length,
        algorithm: 'sha256',
      })),
    };
  }

  private async generateDeploymentInstructions(packages: GeneratedPackage[], request: PackagingRequest): Promise<DeploymentInstruction[]> {
    const instructions: DeploymentInstruction[] = [];

    for (const pkg of packages) {
      switch (pkg.type) {
        case 'npm':
          instructions.push({
            platform: 'npm',
            steps: [
              {
                order: 1,
                command: `npm install ${pkg.metadata.name}@${pkg.metadata.version}`,
                description: 'Install the package',
                critical: true,
              },
            ],
            prerequisites: ['Node.js and npm installed'],
            estimatedTime: 2,
          });
          break;
        case 'docker':
          instructions.push({
            platform: 'docker',
            steps: [
              {
                order: 1,
                command: `docker pull ${pkg.path}`,
                description: 'Pull the Docker image',
                critical: true,
              },
              {
                order: 2,
                command: `docker run -p 3000:3000 ${pkg.path}`,
                description: 'Run the container',
                critical: true,
              },
            ],
            prerequisites: ['Docker installed and running'],
            estimatedTime: 5,
          });
          break;
      }
    }

    return instructions;
  }

  private async validatePackages(result: PackagingResult, context: TaskContext): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic validation
    if (result.packages.length === 0) {
      errors.push('No packages were generated');
    }

    // Validate package integrity
    for (const pkg of result.packages) {
      if (pkg.size === 0) {
        errors.push(`Package ${pkg.path} has zero size`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}