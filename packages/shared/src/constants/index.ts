// Agent Types
export const AGENT_TYPES = {
  PLANNER: 'planner',
  RESEARCHER: 'researcher',
  CODER: 'coder',
  TESTER: 'tester',
  PACKAGER: 'packager',
  REVIEWER: 'reviewer',
  SECURITY: 'security',
  DX_WRITER: 'dx-writer',
} as const;

// Task Types
export const TASK_TYPES = {
  CODE_GENERATION: 'code-generation',
  TESTING: 'testing',
  PACKAGING: 'packaging',
  SECURITY: 'security',
  RTL: 'rtl',
  DOCUMENTATION: 'documentation',
} as const;

// Task Status
export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

// Task Priority
export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

// Project Types
export const PROJECT_TYPES = {
  WEB: 'web',
  API: 'api',
  CLI: 'cli',
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
  RTL: 'rtl',
  SMART_CONTRACT: 'smart-contract',
} as const;

// Supported Languages
export const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
  'swift',
  'kotlin',
  'php',
  'ruby',
  'sql',
  'bash',
  'dockerfile',
  'terraform',
  'ansible',
  'solidity',
  'vyper',
  'move',
  'verilog',
  'systemverilog',
  'vhdl',
  'chisel',
  'markdown',
] as const;

// Build Systems
export const BUILD_SYSTEMS = {
  NPM: 'npm',
  PNPM: 'pnpm',
  BUN: 'bun',
  PIP: 'pip',
  UV: 'uv',
  POETRY: 'poetry',
  CARGO: 'cargo',
  GO: 'go',
  GRADLE: 'gradle',
  MAVEN: 'maven',
  CMAKE: 'cmake',
  MAKE: 'make',
  MSBUILD: 'msbuild',
} as const;

// Test Frameworks
export const TEST_FRAMEWORKS = {
  JEST: 'jest',
  VITEST: 'vitest',
  PYTEST: 'pytest',
  GO_TEST: 'go-test',
  CARGO_TEST: 'cargo-test',
  JUNIT: 'junit',
  GTEST: 'gtest',
  PLAYWRIGHT: 'playwright',
  CYPRESS: 'cypress',
  FOUNDRY: 'foundry',
  ECHIDNA: 'echidna',
  SLITHER: 'slither',
  SYMBIYOSYS: 'symbiyosys',
} as const;

// Packaging Types
export const PACKAGE_TYPES = {
  DOCKER: 'docker',
  NPM: 'npm',
  PIP: 'pip',
  MSIX: 'msix',
  MSI: 'msi',
  ELECTRON: 'electron',
  TAURI: 'tauri',
  WHEEL: 'wheel',
  DEB: 'deb',
  RPM: 'rpm',
} as const;

// Security Tools
export const SECURITY_TOOLS = {
  TRUFFLEHOG: 'trufflehog',
  GITLEAKS: 'gitleaks',
  OSV_SCANNER: 'osv-scanner',
  SNYK: 'snyk',
  LICENSE_CHECKER: 'license-checker',
  SYFT: 'syft',
  GRYPE: 'grype',
} as const;

// RTL Tools
export const RTL_TOOLS = {
  VERILATOR: 'verilator',
  MODELSIM: 'modelsim',
  VCS: 'vcs',
  YOSYS: 'yosys',
  SYMBIYOSYS: 'symbiyosys',
  JASPER: 'jasper',
  FORMALITY: 'formality',
  VIVADO: 'vivado',
  QUARTUS: 'quartus',
  COCOTB: 'cocotb',
} as const;

// Model Names
export const MODEL_NAMES = {
  DEEPSEEK_CODER: 'deepseek-coder',
  CODE_LLAMA: 'code-llama',
  STARCODER: 'starcoder',
  GEMMA_CODE: 'gemma-code',
  QWEN_CODER: 'qwen-coder',
} as const;

// File Operations
export const FILE_OPS = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  MOVE: 'move',
  COPY: 'copy',
  MKDIR: 'mkdir',
} as const;

// Git Operations
export const GIT_OPS = {
  INIT: 'init',
  COMMIT: 'commit',
  BRANCH: 'branch',
  CHECKOUT: 'checkout',
  MERGE: 'merge',
  REBASE: 'rebase',
  TAG: 'tag',
} as const;

// Security Finding Severity
export const SECURITY_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
} as const;

// Default Configuration
export const DEFAULT_CONFIG = {
  AGENT: {
    TEMPERATURE: 0.7,
    MAX_TOKENS: 2048,
    TIMEOUT: 30000, // 30 seconds
  },
  TASK: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    TIMEOUT: 300000, // 5 minutes
  },
  TOOL: {
    TIMEOUT: 60000, // 1 minute
    MAX_OUTPUT_SIZE: 1024 * 1024, // 1MB
  },
  MODEL: {
    DEFAULT: 'deepseek-coder',
    MAX_CONTEXT_LENGTH: 8192,
  },
  MEMORY: {
    MAX_TASK_MEMORY: 100, // entries
    MAX_REPO_MEMORY: 1000, // entries
    CACHE_TTL: 3600000, // 1 hour
  },
  SECURITY: {
    SCAN_ON_EVERY_ITERATION: true,
    FAIL_ON_CRITICAL: true,
    MAX_SEVERITY: 'high',
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  TASK_TIMEOUT: 'Task execution timeout',
  TOOL_TIMEOUT: 'Tool execution timeout',
  MODEL_TIMEOUT: 'Model request timeout',
  INVALID_TASK: 'Invalid task configuration',
  INVALID_AGENT: 'Invalid agent configuration',
  TOOL_NOT_FOUND: 'Tool not found',
  MODEL_NOT_FOUND: 'Model not found',
  PERMISSION_DENIED: 'Permission denied',
  RESOURCE_NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation error',
  UNKNOWN_ERROR: 'Unknown error occurred',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  TASK_COMPLETED: 'Task completed successfully',
  TOOL_EXECUTED: 'Tool executed successfully',
  MODEL_RESPONDED: 'Model responded successfully',
  FILE_CREATED: 'File created successfully',
  FILE_UPDATED: 'File updated successfully',
  FILE_DELETED: 'File deleted successfully',
  PROJECT_CREATED: 'Project created successfully',
  PACKAGE_CREATED: 'Package created successfully',
  TESTS_PASSED: 'All tests passed',
  SECURITY_SCAN_COMPLETED: 'Security scan completed',
} as const;

// File Extensions
export const FILE_EXTENSIONS = {
  JAVASCRIPT: ['.js', '.jsx', '.mjs'],
  TYPESCRIPT: ['.ts', '.tsx'],
  PYTHON: ['.py'],
  GO: ['.go'],
  RUST: ['.rs'],
  JAVA: ['.java'],
  C: ['.c', '.h'],
  CPP: ['.cpp', '.cxx', '.cc', '.hpp', '.hxx'],
  CSHARP: ['.cs'],
  SWIFT: ['.swift'],
  KOTLIN: ['.kt'],
  PHP: ['.php'],
  RUBY: ['.rb'],
  SQL: ['.sql'],
  BASH: ['.sh', '.bash'],
  DOCKERFILE: ['Dockerfile'],
  TERRAFORM: ['.tf', '.tfvars'],
  ANSIBLE: ['.yml', '.yaml'],
  SOLIDITY: ['.sol'],
  VYPER: ['.vy'],
  MOVE: ['.move'],
  VERILOG: ['.v'],
  SYSTEMVERILOG: ['.sv', '.svh'],
  VHDL: ['.vhd', '.vhdl'],
  CHISEL: ['.scala'],
  MARKDOWN: ['.md'],
  JSON: ['.json'],
  YAML: ['.yaml', '.yml'],
  XML: ['.xml'],
} as const;

// Environment Variables
export const ENV_VARS = {
  NODE_ENV: 'NODE_ENV',
  AI_MODEL_API_KEY: 'AI_MODEL_API_KEY',
  AI_MODEL_ENDPOINT: 'AI_MODEL_ENDPOINT',
  DATABASE_URL: 'DATABASE_URL',
  REDIS_URL: 'REDIS_URL',
  LOG_LEVEL: 'LOG_LEVEL',
  MAX_TOKENS: 'MAX_TOKENS',
  TEMPERATURE: 'TEMPERATURE',
  TIMEOUT: 'TIMEOUT',
} as const;