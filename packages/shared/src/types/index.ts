import { z } from 'zod';

// Core Types
export interface AgentConfig {
  id: string;
  name: string;
  type: 'planner' | 'researcher' | 'coder' | 'tester' | 'packager' | 'reviewer' | 'security' | 'dx-writer';
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools: string[];
}

export interface Task {
  id: string;
  description: string;
  type: 'code-generation' | 'testing' | 'packaging' | 'security' | 'rtl' | 'documentation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string;
  dependencies?: string[];
  context?: TaskContext;
  result?: TaskResult;
}

export interface TaskContext {
  files: FileContext[];
  environment: EnvironmentContext;
  memory: MemoryContext;
  tools: ToolContext[];
}

export interface FileContext {
  path: string;
  content: string;
  language: string;
  modified: boolean;
}

export interface EnvironmentContext {
  os: string;
  nodeVersion?: string;
  pythonVersion?: string;
  availableTools: string[];
  workingDirectory: string;
}

export interface MemoryContext {
  taskMemory: Record<string, any>;
  repoMemory: Record<string, any>;
  toolResults: Record<string, any>;
}

export interface ToolContext {
  name: string;
  version: string;
  capabilities: string[];
  config: Record<string, any>;
}

export interface TaskResult {
  success: boolean;
  output?: any;
  artifacts?: Artifact[];
  errors?: string[];
  metrics: TaskMetrics;
  auditLog: AuditEntry[];
}

export interface Artifact {
  type: 'file' | 'directory' | 'package' | 'docker-image' | 'installer' | 'test-report';
  path: string;
  metadata: Record<string, any>;
}

export interface TaskMetrics {
  duration: number;
  tokensUsed: number;
  toolCalls: number;
  memoryUsage: number;
  cost?: number;
}

export interface AuditEntry {
  timestamp: Date;
  agent: string;
  action: string;
  input?: any;
  output?: any;
  error?: string;
}

// Tool Types
export interface ToolCall {
  tool: string;
  args: Record<string, any>;
  timeout?: number;
}

export interface ToolResult {
  success: boolean;
  output?: any;
  error?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  duration: number;
}

// Model Types
export interface ModelConfig {
  name: string;
  type: 'oss' | 'closed';
  endpoint?: string;
  apiKey?: string;
  maxTokens: number;
  supportsStreaming: boolean;
  costPerToken?: number;
}

export interface ModelRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ModelResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}

// Project Types
export interface Project {
  id: string;
  name: string;
  description: string;
  type: 'web' | 'api' | 'cli' | 'desktop' | 'mobile' | 'rtl' | 'smart-contract';
  template?: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  language: string;
  framework?: string;
  buildSystem: string;
  testFramework: string;
  packaging: PackageConfig[];
  security: SecurityConfig;
  rtl?: RTLConfig;
}

export interface PackageConfig {
  type: 'docker' | 'npm' | 'pip' | 'msix' | 'msi' | 'electron' | 'tauri';
  enabled: boolean;
  config: Record<string, any>;
}

export interface SecurityConfig {
  scanDependencies: boolean;
  scanSecrets: boolean;
  generateSBOM: boolean;
  licenseCheck: boolean;
  failOnCritical: boolean;
}

export interface RTLConfig {
  language: 'verilog' | 'systemverilog' | 'vhdl' | 'chisel';
  simulator: 'verilator' | 'modelsim' | 'vcs';
  formalTool: 'symbiyosys' | 'jasper' | 'formality';
  synthesisTool?: 'vivado' | 'quartus' | 'yosys';
  targetFPGA?: string;
}

// File System Types
export interface FileSystemOp {
  type: 'read' | 'write' | 'delete' | 'move' | 'copy' | 'mkdir';
  path: string;
  content?: string;
  options?: Record<string, any>;
}

export interface FileDiff {
  path: string;
  oldContent?: string;
  newContent?: string;
  type: 'added' | 'modified' | 'deleted';
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

// Git Types
export interface GitOp {
  type: 'init' | 'commit' | 'branch' | 'checkout' | 'merge' | 'rebase' | 'tag';
  args: string[];
  message?: string;
}

// Build System Types
export interface BuildConfig {
  system: 'npm' | 'pnpm' | 'bun' | 'pip' | 'uv' | 'poetry' | 'cargo' | 'go' | 'gradle' | 'maven' | 'cmake' | 'make';
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Test Types
export interface TestConfig {
  framework: 'jest' | 'vitest' | 'pytest' | 'go-test' | 'cargo-test' | 'junit' | 'gtest' | 'playwright' | 'cypress';
  command: string;
  args: string[];
  coverage?: boolean;
  watch?: boolean;
}

// Security Types
export interface SecurityScan {
  type: 'dependency' | 'secret' | 'license' | 'sast' | 'dast';
  tool: string;
  config: Record<string, any>;
  findings: SecurityFinding[];
}

export interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  cve?: string;
  recommendation: string;
}

// Zod Schemas for validation
export const TaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.enum(['code-generation', 'testing', 'packaging', 'security', 'rtl', 'documentation']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']),
  createdAt: z.date(),
  updatedAt: z.date(),
  assignedTo: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  context: z.any().optional(),
  result: z.any().optional(),
});

export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['planner', 'researcher', 'coder', 'tester', 'packager', 'reviewer', 'security', 'dx-writer']),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  tools: z.array(z.string()),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['web', 'api', 'cli', 'desktop', 'mobile', 'rtl', 'smart-contract']),
  template: z.string().optional(),
  path: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  settings: z.any(),
});

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface ProgressCallback {
  (progress: number, message: string): void;
}

export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}