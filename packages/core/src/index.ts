// Core orchestrator
export { Orchestrator } from './orchestrator/Orchestrator';
export type { OrchestratorConfig } from './orchestrator/Orchestrator';

// Agents
export * from './agents';

// Models
export { ModelRouter } from './models/ModelRouter';
export type { ModelRouterConfig, ModelMetrics, ModelRecommendation } from './models/ModelRouter';

// Tooling
export { ToolRegistry } from './tooling/ToolRegistry';
export type { 
  ToolConfig, 
  ToolParameter, 
  ToolExecutionContext, 
  ToolMetrics,
  ValidationRule 
} from './tooling/ToolRegistry';

// Memory
export { MemoryManager } from './memory/MemoryManager';
export type { 
  MemoryConfig, 
  MemoryEntry, 
  TaskMemory, 
  RepoMemory,
  RepoStructure,
  SymbolTable,
  DependencyGraph,
  CommitHistory,
  RepoMetadata
} from './memory/MemoryManager';

// Version
export const version = '0.1.0';