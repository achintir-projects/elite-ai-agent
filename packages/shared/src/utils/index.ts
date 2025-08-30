import { v4 as uuidv4 } from 'uuid';
import { Task, AgentConfig, Project, ToolResult, Logger } from '../types';

// UUID generation
export function generateId(): string {
  return uuidv4();
}

// Date utilities
export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

// Task utilities
export function createTask(
  description: string,
  type: Task['type'],
  priority: Task['priority'] = 'medium'
): Task {
  const now = new Date();
  return {
    id: generateId(),
    description,
    type,
    priority,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

export function updateTaskStatus(task: Task, status: Task['status']): Task {
  return {
    ...task,
    status,
    updatedAt: new Date(),
  };
}

// Agent utilities
export function createAgentConfig(
  id: string,
  name: string,
  type: AgentConfig['type'],
  model: string,
  tools: string[] = []
): AgentConfig {
  return {
    id,
    name,
    type,
    model,
    tools,
    temperature: 0.7,
    maxTokens: 2048,
  };
}

// Project utilities
export function createProject(
  name: string,
  description: string,
  type: Project['type'],
  path: string
): Project {
  const now = new Date();
  return {
    id: generateId(),
    name,
    description,
    type,
    path,
    createdAt: now,
    updatedAt: now,
    settings: {
      language: 'typescript',
      buildSystem: 'npm',
      testFramework: 'jest',
      packaging: [],
      security: {
        scanDependencies: true,
        scanSecrets: true,
        generateSBOM: true,
        licenseCheck: true,
        failOnCritical: true,
      },
    },
  };
}

// File utilities
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.slice(lastDot + 1);
}

export function getLanguageFromExtension(extension: string): string {
  const languageMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    sh: 'bash',
    sql: 'sql',
    dockerfile: 'dockerfile',
    tf: 'terraform',
    yaml: 'yaml',
    yml: 'yaml',
    json: 'json',
    xml: 'xml',
    md: 'markdown',
    v: 'verilog',
    sv: 'systemverilog',
    vhdl: 'vhdl',
  };

  return languageMap[extension.toLowerCase()] || 'text';
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9\-_\.]/gi, '_');
}

// Tool result utilities
export function createToolResult(
  success: boolean,
  output?: any,
  error?: string,
  stdout?: string,
  stderr?: string,
  exitCode?: number
): ToolResult {
  return {
    success,
    output,
    error,
    stdout,
    stderr,
    exitCode,
    duration: 0, // Will be set by the tool executor
  };
}

// Error handling utilities
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}

// Async utilities
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = isError(error) ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        await sleep(delayMs * Math.pow(2, i)); // Exponential backoff
      }
    }
  }

  throw lastError!;
}

// Logging utilities
export function createConsoleLogger(): Logger {
  return {
    info: (message: string, meta?: any) => {
      console.log(`[INFO] ${message}`, meta || '');
    },
    warn: (message: string, meta?: any) => {
      console.warn(`[WARN] ${message}`, meta || '');
    },
    error: (message: string, meta?: any) => {
      console.error(`[ERROR] ${message}`, meta || '');
    },
    debug: (message: string, meta?: any) => {
      console.debug(`[DEBUG] ${message}`, meta || '');
    },
  };
}

// String utilities
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Object utilities
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function mergeDeep<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeDeep(result[key] || {}, source[key] as any);
    } else {
      result[key] = source[key] as any;
    }
  }
  
  return result;
}

// Array utilities
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

// Validation utilities
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Path utilities
export function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

export function dirname(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

export function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

// Performance utilities
export function createTimer() {
  const start = Date.now();
  
  return {
    elapsed: () => Date.now() - start,
    reset: () => {
      const elapsed = Date.now() - start;
      return elapsed;
    }
  };
}

// Environment utilities
export function getEnvVar(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

export function getEnvVarRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
}