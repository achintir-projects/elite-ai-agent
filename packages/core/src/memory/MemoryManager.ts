import { TaskContext, TaskResult, AuditEntry, Logger } from '@ai-app-builder/shared';

export interface MemoryConfig {
  maxTaskMemory: number;
  maxRepoMemory: number;
  cacheTTL: number;
  enableVectorStore: boolean;
  vectorStoreConfig?: {
    dimension: number;
    similarityThreshold: number;
  };
}

export interface MemoryEntry {
  id: string;
  type: 'task' | 'repo' | 'tool' | 'result';
  key: string;
  value: any;
  timestamp: Date;
  ttl?: number;
  metadata: Record<string, any>;
  accessCount: number;
  lastAccessed: Date;
}

export interface TaskMemory {
  taskId: string;
  context: TaskContext;
  steps: TaskStep[];
  results: Map<string, TaskResult>;
  auditLog: AuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  result?: TaskResult;
  dependencies: string[];
}

export interface RepoMemory {
  repoId: string;
  path: string;
  structure: RepoStructure;
  symbols: SymbolTable;
  dependencies: DependencyGraph;
  history: CommitHistory;
  metadata: RepoMetadata;
  lastUpdated: Date;
}

export interface RepoStructure {
  files: FileInfo[];
  directories: DirectoryInfo[];
  totalSize: number;
  languageStats: Record<string, number>;
}

export interface FileInfo {
  path: string;
  size: number;
  language: string;
  modified: Date;
  hash: string;
  type: 'source' | 'test' | 'config' | 'documentation' | 'other';
}

export interface DirectoryInfo {
  path: string;
  fileCount: number;
  subdirectories: string[];
  type: 'src' | 'test' | 'config' | 'docs' | 'other';
}

export interface SymbolTable {
  symbols: SymbolInfo[];
  references: SymbolReference[];
}

export interface SymbolInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'constant';
  file: string;
  line: number;
  column: number;
  signature: string;
  documentation?: string;
  visibility: 'public' | 'private' | 'protected';
  language: string;
}

export interface SymbolReference {
  symbol: string;
  file: string;
  line: number;
  column: number;
  context: string;
  type: 'call' | 'import' | 'definition' | 'reference';
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycles: string[][];
}

export interface DependencyNode {
  id: string;
  type: 'file' | 'module' | 'package';
  name: string;
  version?: string;
  path: string;
  metadata: Record<string, any>;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'imports' | 'requires' | 'extends' | 'implements';
  strength: number;
}

export interface CommitHistory {
  commits: CommitInfo[];
  branches: string[];
  tags: string[];
}

export interface CommitInfo {
  hash: string;
  author: string;
  message: string;
  timestamp: Date;
  files: string[];
  stats: {
    insertions: number;
    deletions: number;
    files: number;
  };
}

export interface RepoMetadata {
  name: string;
  description?: string;
  version?: string;
  license?: string;
  authors: string[];
  technologies: string[];
  complexity: number;
  maintainability: number;
  testCoverage: number;
}

export interface VectorStoreEntry {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
  timestamp: Date;
}

export class MemoryManager {
  private logger: Logger;
  private config: Required<MemoryConfig>;
  private memory: Map<string, MemoryEntry> = new Map();
  private taskMemories: Map<string, TaskMemory> = new Map();
  private repoMemories: Map<string, RepoMemory> = new Map();
  private vectorStore: Map<string, VectorStoreEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: MemoryConfig = {}, logger?: Logger) {
    this.logger = logger || this.createDefaultLogger();
    
    this.config = {
      maxTaskMemory: config.maxTaskMemory || 100,
      maxRepoMemory: config.maxRepoMemory || 1000,
      cacheTTL: config.cacheTTL || 3600000, // 1 hour
      enableVectorStore: config.enableVectorStore || false,
      vectorStoreConfig: config.vectorStoreConfig || {
        dimension: 1536,
        similarityThreshold: 0.8,
      },
    };
  }

  private createDefaultLogger(): Logger {
    return {
      info: (message: string, meta?: any) => {
        console.log(`[MemoryManager] ${message}`, meta || '');
      },
      warn: (message: string, meta?: any) => {
        console.warn(`[MemoryManager] ${message}`, meta || '');
      },
      error: (message: string, meta?: any) => {
        console.error(`[MemoryManager] ${message}`, meta || '');
      },
      debug: (message: string, meta?: any) => {
        console.debug(`[MemoryManager] ${message}`, meta || '');
      },
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing MemoryManager...');
    
    try {
      // Start cleanup interval
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredEntries();
      }, 60000); // Clean up every minute

      this.logger.info('MemoryManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MemoryManager', { error });
      throw error;
    }
  }

  // Task Memory Management
  async createTaskMemory(taskId: string, context: TaskContext): Promise<TaskMemory> {
    const taskMemory: TaskMemory = {
      taskId,
      context,
      steps: [],
      results: new Map(),
      auditLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.taskMemories.set(taskId, taskMemory);
    this.logger.debug(`Created task memory for: ${taskId}`);

    return taskMemory;
  }

  async getTaskMemory(taskId: string): Promise<TaskContext> {
    const taskMemory = this.taskMemories.get(taskId);
    if (!taskMemory) {
      throw new Error(`Task memory not found: ${taskId}`);
    }

    // Update access time
    taskMemory.updatedAt = new Date();

    return taskMemory.context;
  }

  async updateTaskContext(taskId: string, context: Partial<TaskContext>): Promise<void> {
    const taskMemory = this.taskMemories.get(taskId);
    if (!taskMemory) {
      throw new Error(`Task memory not found: ${taskId}`);
    }

    taskMemory.context = { ...taskMemory.context, ...context };
    taskMemory.updatedAt = new Date();

    this.logger.debug(`Updated task context for: ${taskId}`);
  }

  async addTaskStep(taskId: string, step: Omit<TaskStep, 'id'>): Promise<string> {
    const taskMemory = this.taskMemories.get(taskId);
    if (!taskMemory) {
      throw new Error(`Task memory not found: ${taskId}`);
    }

    const stepId = `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const taskStep: TaskStep = {
      id: stepId,
      ...step,
    };

    taskMemory.steps.push(taskStep);
    taskMemory.updatedAt = new Date();

    this.logger.debug(`Added task step for: ${taskId}`);

    return stepId;
  }

  async updateTaskStep(taskId: string, stepId: string, updates: Partial<TaskStep>): Promise<void> {
    const taskMemory = this.taskMemories.get(taskId);
    if (!taskMemory) {
      throw new Error(`Task memory not found: ${taskId}`);
    }

    const step = taskMemory.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Task step not found: ${stepId}`);
    }

    Object.assign(step, updates);
    taskMemory.updatedAt = new Date();

    this.logger.debug(`Updated task step for: ${taskId}`);
  }

  async storeTaskResult(taskId: string, result: TaskResult): Promise<void> {
    const taskMemory = this.taskMemories.get(taskId);
    if (!taskMemory) {
      throw new Error(`Task memory not found: ${taskId}`);
    }

    taskMemory.results.set(`result-${Date.now()}`, result);
    taskMemory.updatedAt = new Date();

    this.logger.debug(`Stored task result for: ${taskId}`);
  }

  async addAuditEntry(taskId: string, entry: AuditEntry): Promise<void> {
    const taskMemory = this.taskMemories.get(taskId);
    if (!taskMemory) {
      throw new Error(`Task memory not found: ${taskId}`);
    }

    taskMemory.auditLog.push(entry);
    taskMemory.updatedAt = new Date();

    this.logger.debug(`Added audit entry for: ${taskId}`);
  }

  async getTaskMemorySummary(taskId: string): Promise<any> {
    const taskMemory = this.taskMemories.get(taskId);
    if (!taskMemory) {
      throw new Error(`Task memory not found: ${taskId}`);
    }

    return {
      taskId,
      stepsCount: taskMemory.steps.length,
      resultsCount: taskMemory.results.size,
      auditLogCount: taskMemory.auditLog.length,
      createdAt: taskMemory.createdAt,
      updatedAt: taskMemory.updatedAt,
    };
  }

  // Repository Memory Management
  async createRepoMemory(repoId: string, path: string): Promise<RepoMemory> {
    const repoMemory: RepoMemory = {
      repoId,
      path,
      structure: {
        files: [],
        directories: [],
        totalSize: 0,
        languageStats: {},
      },
      symbols: {
        symbols: [],
        references: [],
      },
      dependencies: {
        nodes: [],
        edges: [],
        cycles: [],
      },
      history: {
        commits: [],
        branches: [],
        tags: [],
      },
      metadata: {
        name: repoId,
        authors: [],
        technologies: [],
        complexity: 0,
        maintainability: 0,
        testCoverage: 0,
      },
      lastUpdated: new Date(),
    };

    this.repoMemories.set(repoId, repoMemory);
    this.logger.debug(`Created repo memory for: ${repoId}`);

    return repoMemory;
  }

  async getRepoMemory(repoId: string): Promise<RepoMemory | null> {
    return this.repoMemories.get(repoId) || null;
  }

  async updateRepoStructure(repoId: string, structure: Partial<RepoStructure>): Promise<void> {
    const repoMemory = this.repoMemories.get(repoId);
    if (!repoMemory) {
      throw new Error(`Repo memory not found: ${repoId}`);
    }

    repoMemory.structure = { ...repoMemory.structure, ...structure };
    repoMemory.lastUpdated = new Date();

    this.logger.debug(`Updated repo structure for: ${repoId}`);
  }

  async updateRepoSymbols(repoId: string, symbols: Partial<SymbolTable>): Promise<void> {
    const repoMemory = this.repoMemories.get(repoId);
    if (!repoMemory) {
      throw new Error(`Repo memory not found: ${repoId}`);
    }

    repoMemory.symbols = { ...repoMemory.symbols, ...symbols };
    repoMemory.lastUpdated = new Date();

    this.logger.debug(`Updated repo symbols for: ${repoId}`);
  }

  async updateRepoDependencies(repoId: string, dependencies: Partial<DependencyGraph>): Promise<void> {
    const repoMemory = this.repoMemories.get(repoId);
    if (!repoMemory) {
      throw new Error(`Repo memory not found: ${repoId}`);
    }

    repoMemory.dependencies = { ...repoMemory.dependencies, ...dependencies };
    repoMemory.lastUpdated = new Date();

    this.logger.debug(`Updated repo dependencies for: ${repoId}`);
  }

  async updateRepoHistory(repoId: string, history: Partial<CommitHistory>): Promise<void> {
    const repoMemory = this.repoMemories.get(repoId);
    if (!repoMemory) {
      throw new Error(`Repo memory not found: ${repoId}`);
    }

    repoMemory.history = { ...repoMemory.history, ...history };
    repoMemory.lastUpdated = new Date();

    this.logger.debug(`Updated repo history for: ${repoId}`);
  }

  async updateRepoMetadata(repoId: string, metadata: Partial<RepoMetadata>): Promise<void> {
    const repoMemory = this.repoMemories.get(repoId);
    if (!repoMemory) {
      throw new Error(`Repo memory not found: ${repoId}`);
    }

    repoMemory.metadata = { ...repoMemory.metadata, ...metadata };
    repoMemory.lastUpdated = new Date();

    this.logger.debug(`Updated repo metadata for: ${repoId}`);
  }

  // Generic Memory Management
  async store(key: string, value: any, type: MemoryEntry['type'] = 'task', ttl?: number): Promise<void> {
    const entry: MemoryEntry = {
      id: `${type}-${key}`,
      type,
      key,
      value,
      timestamp: new Date(),
      ttl,
      metadata: {},
      accessCount: 0,
      lastAccessed: new Date(),
    };

    this.memory.set(entry.id, entry);
    this.logger.debug(`Stored memory entry: ${entry.id}`);
  }

  async retrieve(key: string, type: MemoryEntry['type'] = 'task'): Promise<any | null> {
    const entryId = `${type}-${key}`;
    const entry = this.memory.get(entryId);

    if (!entry) {
      return null;
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp.getTime() > entry.ttl) {
      this.memory.delete(entryId);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = new Date();

    return entry.value;
  }

  // Vector Store Management
  async addToVectorStore(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    if (!this.config.enableVectorStore) {
      return;
    }

    const entry: VectorStoreEntry = {
      id,
      vector,
      metadata,
      timestamp: new Date(),
    };

    this.vectorStore.set(id, entry);
    this.logger.debug(`Added to vector store: ${id}`);
  }

  async searchVectorStore(query: number[], limit: number = 10): Promise<Array<{ id: string; similarity: number; metadata: Record<string, any> }>> {
    if (!this.config.enableVectorStore) {
      return [];
    }

    const results: Array<{ id: string; similarity: number; metadata: Record<string, any> }> = [];

    for (const [id, entry] of this.vectorStore) {
      const similarity = this.calculateCosineSimilarity(query, entry.vector);
      
      if (similarity >= this.config.vectorStoreConfig.similarityThreshold) {
        results.push({
          id,
          similarity,
          metadata: entry.metadata,
        });
      }
    }

    // Sort by similarity and limit results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Cleanup and Maintenance
  private cleanupExpiredEntries(): void {
    const now = Date.now();

    // Clean up task memories
    if (this.taskMemories.size > this.config.maxTaskMemory) {
      const entries = Array.from(this.taskMemories.entries())
        .sort(([, a], [, b]) => a.updatedAt.getTime() - b.updatedAt.getTime());
      
      const toRemove = entries.slice(0, entries.length - this.config.maxTaskMemory);
      for (const [taskId] of toRemove) {
        this.taskMemories.delete(taskId);
        this.logger.debug(`Cleaned up task memory: ${taskId}`);
      }
    }

    // Clean up repo memories
    if (this.repoMemories.size > this.config.maxRepoMemory) {
      const entries = Array.from(this.repoMemories.entries())
        .sort(([, a], [, b]) => a.lastUpdated.getTime() - b.lastUpdated.getTime());
      
      const toRemove = entries.slice(0, entries.length - this.config.maxRepoMemory);
      for (const [repoId] of toRemove) {
        this.repoMemories.delete(repoId);
        this.logger.debug(`Cleaned up repo memory: ${repoId}`);
      }
    }

    // Clean up generic memory entries
    for (const [id, entry] of this.memory) {
      if (entry.ttl && now - entry.timestamp.getTime() > entry.ttl) {
        this.memory.delete(id);
        this.logger.debug(`Cleaned up expired memory entry: ${id}`);
      }
    }

    // Clean up vector store
    if (this.config.enableVectorStore) {
      for (const [id, entry] of this.vectorStore) {
        if (now - entry.timestamp.getTime() > this.config.cacheTTL) {
          this.vectorStore.delete(id);
          this.logger.debug(`Cleaned up vector store entry: ${id}`);
        }
      }
    }
  }

  // Statistics and Monitoring
  getMemoryStats(): {
    taskMemories: number;
    repoMemories: number;
    genericEntries: number;
    vectorEntries: number;
    totalSize: number;
  } {
    return {
      taskMemories: this.taskMemories.size,
      repoMemories: this.repoMemories.size,
      genericEntries: this.memory.size,
      vectorEntries: this.vectorStore.size,
      totalSize: this.calculateTotalSize(),
    };
  }

  private calculateTotalSize(): number {
    // Simple size calculation - in real implementation would be more accurate
    let totalSize = 0;
    
    // Task memories
    for (const taskMemory of this.taskMemories.values()) {
      totalSize += JSON.stringify(taskMemory).length;
    }
    
    // Repo memories
    for (const repoMemory of this.repoMemories.values()) {
      totalSize += JSON.stringify(repoMemory).length;
    }
    
    // Generic memory
    for (const entry of this.memory.values()) {
      totalSize += JSON.stringify(entry).length;
    }
    
    // Vector store
    for (const entry of this.vectorStore.values()) {
      totalSize += entry.vector.length * 8; // 8 bytes per number
      totalSize += JSON.stringify(entry.metadata).length;
    }

    return totalSize;
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down MemoryManager...');
    
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all memory
    this.memory.clear();
    this.taskMemories.clear();
    this.repoMemories.clear();
    this.vectorStore.clear();

    this.logger.info('MemoryManager shutdown complete');
  }
}