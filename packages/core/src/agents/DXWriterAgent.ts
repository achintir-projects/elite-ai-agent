import { Task, TaskContext, TaskResult, AgentConfig, Logger } from '@ai-app-builder/shared';
import { BaseAgent } from './Agent';
import { ModelRouter } from '../models/ModelRouter';
import { ToolRegistry } from '../tooling/ToolRegistry';

export interface DocumentationRequest {
  targetFiles: string[];
  docType: 'readme' | 'api' | 'user-guide' | 'developer-guide' | 'changelog' | 'architecture';
  audience: 'developers' | 'users' | 'administrators' | 'stakeholders';
  format: 'markdown' | 'html' | 'pdf' | 'docx';
  style: 'technical' | 'friendly' | 'formal' | 'casual';
  includeExamples: boolean;
  includeDiagrams: boolean;
  sections?: string[];
}

export interface DocumentationResult {
  generatedDocs: GeneratedDocument[];
  structure: DocumentStructure;
  quality: DocumentationQuality;
  metadata: DocumentationMetadata;
  reviewNotes: ReviewNote[];
}

export interface GeneratedDocument {
  path: string;
  title: string;
  content: string;
  type: string;
  format: string;
  audience: string;
  size: number;
  readingTime: number;
  sections: DocumentSection[];
  relatedDocs: string[];
}

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  level: number;
  order: number;
  subsections: DocumentSection[];
  codeExamples: CodeExample[];
  diagrams: DiagramReference[];
}

export interface CodeExample {
  id: string;
  language: string;
  code: string;
  description: string;
  output?: string;
  runnable: boolean;
  dependencies?: string[];
}

export interface DiagramReference {
  id: string;
  type: 'architecture' | 'sequence' | 'flowchart' | 'component' | 'erd';
  title: string;
  description: string;
  format: 'mermaid' | 'plantuml' | 'svg' | 'png';
}

export interface DocumentStructure {
  outline: OutlineItem[];
  navigation: NavigationItem[];
  crossReferences: CrossReference[];
}

export interface OutlineItem {
  id: string;
  title: string;
  level: number;
  page: string;
  children: OutlineItem[];
}

export interface NavigationItem {
  label: string;
  path: string;
  order: number;
  children: NavigationItem[];
}

export interface CrossReference {
  from: string;
  to: string;
  type: 'see-also' | 'related' | 'required' | 'example';
  description: string;
}

export interface DocumentationQuality {
  readability: number;
  completeness: number;
  accuracy: number;
  structure: number;
  examples: number;
  overall: number;
  issues: QualityIssue[];
}

export interface QualityIssue {
  type: 'grammar' | 'spelling' | 'structure' | 'completeness' | 'accuracy';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
  location: string;
}

export interface DocumentationMetadata {
  title: string;
  version: string;
  author: string;
  created: Date;
  modified: Date;
  tags: string[];
  categories: string[];
  estimatedReadingTime: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface ReviewNote {
  reviewer: string;
  date: Date;
  type: 'suggestion' | 'correction' | 'question' | 'approval';
  section: string;
  comment: string;
  resolved: boolean;
}

export class DXWriterAgent extends BaseAgent {
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
    this.logger.info('Initializing DXWriterAgent...');
    // Initialize documentation writer resources
    this.logger.info('DXWriterAgent initialized successfully');
  }

  protected async onExecute(task: Task, context: TaskContext): Promise<TaskResult> {
    this.logger.info(`Generating documentation for task: ${task.description}`);

    try {
      // Parse documentation request
      const request = await this.parseDocumentationRequest(task, context);
      
      // Generate documentation
      const documentationResult = await this.generateDocumentation(request, context);
      
      // Validate documentation quality
      const validation = await this.validateDocumentation(documentationResult, context);
      if (!validation.valid) {
        throw new Error(`Documentation validation failed: ${validation.errors.join(', ')}`);
      }

      return this.createTaskResult(
        true,
        {
          request,
          documentationResult,
          validation,
        },
        undefined,
        [
          ...documentationResult.generatedDocs.map(doc => ({
            type: 'file' as const,
            path: doc.path,
            metadata: {
              docType: doc.type,
              format: doc.format,
              audience: doc.audience,
              size: doc.size,
              readingTime: doc.readingTime,
              sections: doc.sections.length,
            },
          })),
          {
            type: 'file' as const,
            path: `documentation_report_${task.id}.json`,
            metadata: {
              totalDocs: documentationResult.generatedDocs.length,
              overallQuality: documentationResult.quality.overall,
              issues: documentationResult.quality.issues.length,
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
    this.logger.info('Shutting down DXWriterAgent...');
    // Clean up documentation writer resources
    this.logger.info('DXWriterAgent shutdown complete');
  }

  private async parseDocumentationRequest(task: Task, context: TaskContext): Promise<DocumentationRequest> {
    this.logger.debug('Parsing documentation request...');

    const prompt = `
Parse the following task into a structured documentation request:

Task: ${task.description}
Type: ${task.type}
Priority: ${task.priority}

Context:
- Files available: ${context.files.length}
- Environment: ${context.environment.os}

Please provide a JSON response with the following structure:
{
  "targetFiles": ["path/to/file1.js", "path/to/file2.js"],
  "docType": "readme|api|user-guide|developer-guide|changelog|architecture",
  "audience": "developers|users|administrators|stakeholders",
  "format": "markdown|html|pdf|docx",
  "style": "technical|friendly|formal|casual",
  "includeExamples": true,
  "includeDiagrams": true,
  "sections": ["Overview", "Installation", "Usage", "API Reference"]
}

Identify the appropriate documentation type and target audience based on the task description.
`;

    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert technical writer. Parse task descriptions into structured documentation requests.',
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
        targetFiles: data.targetFiles || context.files.map(f => f.path),
        docType: data.docType || 'readme',
        audience: data.audience || 'developers',
        format: data.format || 'markdown',
        style: data.style || 'technical',
        includeExamples: data.includeExamples !== false,
        includeDiagrams: data.includeDiagrams !== false,
        sections: data.sections || [],
      };
    } catch (error) {
      this.logger.error('Failed to parse documentation request', { error });
      return this.fallbackDocumentationRequest(task, context);
    }
  }

  private fallbackDocumentationRequest(task: Task, context: TaskContext): DocumentationRequest {
    return {
      targetFiles: context.files.map(f => f.path),
      docType: 'readme',
      audience: 'developers',
      format: 'markdown',
      style: 'technical',
      includeExamples: true,
      includeDiagrams: true,
    };
  }

  private async generateDocumentation(request: DocumentationRequest, context: TaskContext): Promise<DocumentationResult> {
    this.logger.debug('Generating documentation...');

    const generatedDocs: GeneratedDocument[] = [];

    // Generate documentation based on type
    switch (request.docType) {
      case 'readme':
        const readmeDoc = await this.generateReadme(request, context);
        generatedDocs.push(readmeDoc);
        break;
      case 'api':
        const apiDoc = await this.generateAPIDocumentation(request, context);
        generatedDocs.push(apiDoc);
        break;
      case 'user-guide':
        const userGuide = await this.generateUserGuide(request, context);
        generatedDocs.push(userGuide);
        break;
      case 'developer-guide':
        const devGuide = await this.generateDeveloperGuide(request, context);
        generatedDocs.push(devGuide);
        break;
      case 'architecture':
        const archDoc = await this.generateArchitectureDoc(request, context);
        generatedDocs.push(archDoc);
        break;
      case 'changelog':
        const changelog = await this.generateChangelog(request, context);
        generatedDocs.push(changelog);
        break;
      default:
        throw new Error(`Unsupported documentation type: ${request.docType}`);
    }

    // Generate document structure
    const structure = await this.generateDocumentStructure(generatedDocs);

    // Calculate quality metrics
    const quality = await this.calculateDocumentationQuality(generatedDocs);

    // Generate metadata
    const metadata = await this.generateDocumentationMetadata(generatedDocs, request);

    return {
      generatedDocs,
      structure,
      quality,
      metadata,
      reviewNotes: [],
    };
  }

  private async generateReadme(request: DocumentationRequest, context: TaskContext): Promise<GeneratedDocument> {
    const prompt = this.createReadmePrompt(request, context);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert technical writer specializing in README files. Create comprehensive, well-structured documentation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 3000,
      });

      const content = response.content;
      const sections = this.parseMarkdownSections(content);
      const codeExamples = this.extractCodeExamples(content);

      return {
        path: 'README.md',
        title: 'README',
        content,
        type: 'readme',
        format: 'markdown',
        audience: request.audience,
        size: content.length,
        readingTime: Math.ceil(content.length / 200), // Rough estimate
        sections,
        relatedDocs: [],
      };
    } catch (error) {
      this.logger.error('Failed to generate README', { error });
      throw error;
    }
  }

  private createReadmePrompt(request: DocumentationRequest, context: TaskContext): string {
    const fileContents = request.targetFiles
      .map(path => {
        const file = context.files.find(f => f.path === path);
        return file ? `## ${path}\n\`\`\`${file.language}\n${file.content}\n\`\`\`` : '';
      })
      .join('\n\n');

    return `
Generate a comprehensive README.md file for the following project:

Target Files:
${request.targetFiles.join(', ')}

Audience: ${request.audience}
Style: ${request.style}
Include Examples: ${request.includeExamples}
Include Diagrams: ${request.includeDiagrams}

File Contents:
${fileContents}

Please create a well-structured README with the following sections:
1. Project Title and Description
2. Features
3. Installation Instructions
4. Usage Examples
5. API Reference (if applicable)
6. Configuration
7. Contributing Guidelines
8. License
9. Contact Information

Use ${request.style} language appropriate for ${request.audience}.
${request.includeExamples ? 'Include practical code examples.' : ''}
${request.includeDiagrams ? 'Include mermaid diagrams where appropriate.' : ''}
`;
  }

  private async generateAPIDocumentation(request: DocumentationRequest, context: TaskContext): Promise<GeneratedDocument> {
    const prompt = this.createAPIDocumentationPrompt(request, context);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert technical writer specializing in API documentation. Create detailed, accurate API reference documentation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.2,
        maxTokens: this.config.maxTokens || 4000,
      });

      const content = response.content;
      const sections = this.parseMarkdownSections(content);
      const codeExamples = this.extractCodeExamples(content);

      return {
        path: 'API.md',
        title: 'API Documentation',
        content,
        type: 'api',
        format: 'markdown',
        audience: request.audience,
        size: content.length,
        readingTime: Math.ceil(content.length / 200),
        sections,
        relatedDocs: ['README.md'],
      };
    } catch (error) {
      this.logger.error('Failed to generate API documentation', { error });
      throw error;
    }
  }

  private createAPIDocumentationPrompt(request: DocumentationRequest, context: TaskContext): string {
    const fileContents = request.targetFiles
      .map(path => {
        const file = context.files.find(f => f.path === path);
        return file ? `## ${path}\n\`\`\`${file.language}\n${file.content}\n\`\`\`` : '';
      })
      .join('\n\n');

    return `
Generate comprehensive API documentation for the following code:

Target Files:
${request.targetFiles.join(', ')}

Audience: ${request.audience}
Style: ${request.style}
Include Examples: ${request.includeExamples}

File Contents:
${fileContents}

Please create detailed API documentation including:
1. Overview
2. Authentication
3. Endpoints/Functions
   - Method signature
   - Parameters
   - Return values
   - Error handling
   - Examples
4. Data Models/Schemas
5. Rate Limits
6. Error Codes
7. SDK Usage (if applicable)

For each endpoint/function, provide:
- Clear description
- Parameter details with types
- Return value specifications
- Code examples
- Error scenarios and handling

Use ${request.style} language appropriate for ${request.audience}.
${request.includeExamples ? 'Include comprehensive code examples for each endpoint/function.' : ''}
`;
  }

  private async generateUserGuide(request: DocumentationRequest, context: TaskContext): Promise<GeneratedDocument> {
    // Simplified implementation - similar pattern to other documentation types
    const content = `# User Guide

This is a user guide for the project.

## Getting Started
...

## Features
...

## How to Use
...

## Troubleshooting
...`;

    return {
      path: 'USER_GUIDE.md',
      title: 'User Guide',
      content,
      type: 'user-guide',
      format: 'markdown',
      audience: request.audience,
      size: content.length,
      readingTime: Math.ceil(content.length / 200),
      sections: this.parseMarkdownSections(content),
      relatedDocs: ['README.md'],
    };
  }

  private async generateDeveloperGuide(request: DocumentationRequest, context: TaskContext): Promise<GeneratedDocument> {
    // Simplified implementation
    const content = `# Developer Guide

This is a developer guide for the project.

## Development Setup
...

## Architecture
...

## Contributing
...

## Testing
...

## Deployment
...`;

    return {
      path: 'DEVELOPER_GUIDE.md',
      title: 'Developer Guide',
      content,
      type: 'developer-guide',
      format: 'markdown',
      audience: request.audience,
      size: content.length,
      readingTime: Math.ceil(content.length / 200),
      sections: this.parseMarkdownSections(content),
      relatedDocs: ['README.md', 'API.md'],
    };
  }

  private async generateArchitectureDoc(request: DocumentationRequest, context: TaskContext): Promise<GeneratedDocument> {
    // Simplified implementation
    const content = `# Architecture Documentation

This document describes the system architecture.

## Overview
...

## Components
...

## Data Flow
...

## Design Patterns
...

## Scalability
...

## Security
...`;

    return {
      path: 'ARCHITECTURE.md',
      title: 'Architecture Documentation',
      content,
      type: 'architecture',
      format: 'markdown',
      audience: request.audience,
      size: content.length,
      readingTime: Math.ceil(content.length / 200),
      sections: this.parseMarkdownSections(content),
      relatedDocs: ['README.md', 'DEVELOPER_GUIDE.md'],
    };
  }

  private async generateChangelog(request: DocumentationRequest, context: TaskContext): Promise<GeneratedDocument> {
    // Simplified implementation
    const content = `# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Initial release

### Changed
- Nothing yet

### Deprecated
- Nothing yet

### Removed
- Nothing yet

### Fixed
- Nothing yet

### Security
- Nothing yet
`;

    return {
      path: 'CHANGELOG.md',
      title: 'Changelog',
      content,
      type: 'changelog',
      format: 'markdown',
      audience: request.audience,
      size: content.length,
      readingTime: Math.ceil(content.length / 200),
      sections: this.parseMarkdownSections(content),
      relatedDocs: ['README.md'],
    };
  }

  private parseMarkdownSections(content: string): DocumentSection[] {
    const lines = content.split('\n');
    const sections: DocumentSection[] = [];
    let currentSection: DocumentSection | null = null;
    let sectionStack: DocumentSection[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2];

        const section: DocumentSection = {
          id: title.toLowerCase().replace(/\s+/g, '-'),
          title,
          content: '',
          level,
          order: sections.length,
          subsections: [],
          codeExamples: [],
          diagrams: [],
        };

        // Find parent section
        while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
          sectionStack.pop();
        }

        if (sectionStack.length > 0) {
          sectionStack[sectionStack.length - 1].subsections.push(section);
        } else {
          sections.push(section);
        }

        sectionStack.push(section);
        currentSection = section;
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    return sections;
  }

  private extractCodeExamples(content: string): CodeExample[] {
    const codeExamples: CodeExample[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();

      codeExamples.push({
        id: `example-${codeExamples.length}`,
        language,
        code,
        description: 'Code example',
        runnable: false,
      });
    }

    return codeExamples;
  }

  private async generateDocumentStructure(docs: GeneratedDocument[]): Promise<DocumentStructure> {
    const outline: OutlineItem[] = [];
    const navigation: NavigationItem[] = [];
    const crossReferences: CrossReference[] = [];

    // Generate outline
    for (const doc of docs) {
      const outlineItem: OutlineItem = {
        id: doc.title.toLowerCase().replace(/\s+/g, '-'),
        title: doc.title,
        level: 1,
        page: doc.path,
        children: doc.sections.map(section => ({
          id: section.id,
          title: section.title,
          level: section.level + 1,
          page: `${doc.path}#${section.id}`,
          children: [],
        })),
      };
      outline.push(outlineItem);

      // Generate navigation
      const navItem: NavigationItem = {
        label: doc.title,
        path: doc.path,
        order: docs.indexOf(doc),
        children: doc.sections.map(section => ({
          label: section.title,
          path: `${doc.path}#${section.id}`,
          order: section.order,
          children: [],
        })),
      };
      navigation.push(navItem);
    }

    // Generate cross-references (simplified)
    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        crossReferences.push({
          from: docs[i].path,
          to: docs[j].path,
          type: 'related',
          description: `Related documentation`,
        });
      }
    }

    return {
      outline,
      navigation,
      crossReferences,
    };
  }

  private async calculateDocumentationQuality(docs: GeneratedDocument[]): Promise<DocumentationQuality> {
    // Simplified quality calculation
    const totalSize = docs.reduce((sum, doc) => sum + doc.size, 0);
    const totalSections = docs.reduce((sum, doc) => sum + doc.sections.length, 0);
    const avgSectionsPerDoc = totalSections / docs.length;

    return {
      readability: 0.8,
      completeness: Math.min(avgSectionsPerDoc / 10, 1),
      accuracy: 0.9,
      structure: 0.8,
      examples: 0.7,
      overall: 0.8,
      issues: [],
    };
  }

  private async generateDocumentationMetadata(docs: GeneratedDocument[], request: DocumentationRequest): Promise<DocumentationMetadata> {
    const totalReadingTime = docs.reduce((sum, doc) => sum + doc.readingTime, 0);
    const allTags = [...new Set(docs.flatMap(doc => doc.metadata?.tags || []))];

    return {
      title: 'Project Documentation',
      version: '1.0.0',
      author: 'AI App Builder',
      created: new Date(),
      modified: new Date(),
      tags: allTags,
      categories: ['documentation', request.docType],
      estimatedReadingTime: totalReadingTime,
      difficulty: 'intermediate',
    };
  }

  private async validateDocumentation(result: DocumentationResult, context: TaskContext): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic validation
    if (result.generatedDocs.length === 0) {
      errors.push('No documentation was generated');
    }

    // Validate document quality
    if (result.quality.overall < 0.6) {
      errors.push('Documentation quality is below acceptable threshold');
    }

    // Check for required sections
    for (const doc of result.generatedDocs) {
      if (doc.sections.length === 0) {
        errors.push(`Document ${doc.path} has no sections`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}