# AI App Builder - Shared Package

This package contains shared types, utilities, and constants used across all AI App Builder packages.

## Installation

```bash
npm install @ai-app-builder/shared
```

## Usage

```typescript
import { createTask, generateId, TASK_TYPES } from '@ai-app-builder/shared';

// Create a new task
const task = createTask(
  'Build a REST API server',
  TASK_TYPES.CODE_GENERATION,
  'high'
);

console.log(task.id); // Generated UUID
console.log(task.status); // 'pending'
```

## Contents

### Types
- Core types for tasks, agents, projects, and tools
- File system and Git operation types
- Security and testing types
- Zod schemas for validation

### Utils
- UUID generation
- Date and time utilities
- Task and project creation helpers
- File and path utilities
- Error handling and async utilities
- Logging and performance utilities

### Constants
- Agent types and task types
- Supported languages and build systems
- Security and RTL tools
- Default configurations
- Error and success messages

## License

MIT