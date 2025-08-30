import { Task, TaskContext, TaskResult, AgentConfig, Logger } from '@ai-app-builder/shared';
import { BaseAgent } from './Agent';
import { ModelRouter } from '../models/ModelRouter';
import { ToolRegistry } from '../tooling/ToolRegistry';

export interface ReviewRequest {
  targetFiles: string[];
  reviewType: 'code' | 'architecture' | 'security' | 'performance' | 'documentation';
  focus: string[];
  standards: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoFix: boolean;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  metrics: ReviewMetrics;
  recommendations: ReviewRecommendation[];
  score: number;
  summary: string;
  fixes: CodeFix[];
}

export interface ReviewFinding {
  id: string;
  type: 'issue' | 'warning' | 'suggestion' | 'best-practice';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'code-quality' | 'security' | 'performance' | 'maintainability' | 'documentation';
  title: string;
  description: string;
  file: string;
  line?: number;
  code?: string;
  impact: string;
  suggestion: string;
  confidence: number;
  autoFixable: boolean;
}

export interface ReviewMetrics {
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  codeQuality: number;
  securityScore: number;
  performanceScore: number;
  maintainabilityScore: number;
  documentationScore: number;
}

export interface ReviewRecommendation {
  priority: 'immediate' | 'short-term' | 'long-term';
  category: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  findings: string[];
}

export interface CodeFix {
  findingId: string;
  file: string;
  originalCode: string;
  fixedCode: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  confidence: number;
}

export class ReviewerAgent extends BaseAgent {
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
    this.logger.info('Initializing ReviewerAgent...');
    // Initialize reviewer-specific resources
    this.logger.info('ReviewerAgent initialized successfully');
  }

  protected async onExecute(task: Task, context: TaskContext): Promise<TaskResult> {
    this.logger.info(`Reviewing for task: ${task.description}`);

    try {
      // Parse review request
      const request = await this.parseReviewRequest(task, context);
      
      // Perform review
      const reviewResult = await this.performReview(request, context);
      
      // Generate fixes if requested
      if (request.autoFix) {
        reviewResult.fixes = await this.generateFixes(reviewResult.findings, context);
      }

      return this.createTaskResult(
        true,
        {
          request,
          reviewResult,
        },
        undefined,
        [
          {
            type: 'file' as const,
            path: `review_report_${task.id}.json`,
            metadata: {
              reviewType: request.reviewType,
              score: reviewResult.score,
              findings: reviewResult.findings.length,
              criticalIssues: reviewResult.metrics.criticalIssues,
            },
          },
          ...reviewResult.fixes.map(fix => ({
            type: 'file' as const,
            path: fix.file,
            metadata: {
              fixType: 'code-fix',
              findingId: fix.findingId,
              risk: fix.risk,
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
    this.logger.info('Shutting down ReviewerAgent...');
    // Clean up reviewer-specific resources
    this.logger.info('ReviewerAgent shutdown complete');
  }

  private async parseReviewRequest(task: Task, context: TaskContext): Promise<ReviewRequest> {
    this.logger.debug('Parsing review request...');

    const prompt = `
Parse the following task into a structured review request:

Task: ${task.description}
Type: ${task.type}
Priority: ${task.priority}

Context:
- Files available: ${context.files.length}
- Environment: ${context.environment.os}

Please provide a JSON response with the following structure:
{
  "targetFiles": ["path/to/file1.js", "path/to/file2.js"],
  "reviewType": "code|architecture|security|performance|documentation",
  "focus": ["readability", "performance", "security"],
  "standards": ["ES6+", "Airbnb", "OWASP"],
  "severity": "low|medium|high|critical",
  "autoFix": true
}

Identify the files to review and the appropriate review type based on the task description.
`;

    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software reviewer. Parse task descriptions into structured review requests.',
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
        reviewType: data.reviewType || 'code',
        focus: data.focus || ['code-quality'],
        standards: data.standards || [],
        severity: data.severity || 'medium',
        autoFix: data.autoFix || false,
      };
    } catch (error) {
      this.logger.error('Failed to parse review request', { error });
      return this.fallbackReviewRequest(task, context);
    }
  }

  private fallbackReviewRequest(task: Task, context: TaskContext): ReviewRequest {
    return {
      targetFiles: context.files.map(f => f.path),
      reviewType: 'code',
      focus: ['code-quality'],
      standards: [],
      severity: 'medium',
      autoFix: false,
    };
  }

  private async performReview(request: ReviewRequest, context: TaskContext): Promise<ReviewResult> {
    this.logger.debug('Performing review...');

    const findings: ReviewFinding[] = [];
    const metrics: ReviewMetrics = {
      totalIssues: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
      codeQuality: 0,
      securityScore: 0,
      performanceScore: 0,
      maintainabilityScore: 0,
      documentationScore: 0,
    };

    // Review each file
    for (const filePath of request.targetFiles) {
      const fileContent = context.files.find(f => f.path === filePath)?.content;
      if (!fileContent) {
        continue;
      }

      const fileFindings = await this.reviewFile(filePath, fileContent, request, context);
      findings.push(...fileFindings);
    }

    // Calculate metrics
    this.calculateMetrics(findings, metrics);

    // Generate recommendations
    const recommendations = await this.generateRecommendations(findings, metrics);

    // Calculate overall score
    const score = this.calculateOverallScore(metrics);

    // Generate summary
    const summary = await this.generateSummary(findings, metrics, recommendations);

    return {
      findings,
      metrics,
      recommendations,
      score,
      summary,
      fixes: [],
    };
  }

  private async reviewFile(filePath: string, content: string, request: ReviewRequest, context: TaskContext): Promise<ReviewFinding[]> {
    const findings: ReviewFinding[] = [];

    // Use AI to review the file
    const prompt = this.createFileReviewPrompt(filePath, content, request);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert software reviewer specializing in ${request.reviewType} reviews. Provide detailed, actionable feedback.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 2000,
      });

      const data = JSON.parse(response.content);
      return (data.findings || []).map((finding: any) => ({
        id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: finding.type || 'issue',
        severity: finding.severity || 'medium',
        category: finding.category || 'code-quality',
        title: finding.title,
        description: finding.description,
        file: filePath,
        line: finding.line,
        code: finding.code,
        impact: finding.impact,
        suggestion: finding.suggestion,
        confidence: finding.confidence || 0.8,
        autoFixable: finding.autoFixable || false,
      }));
    } catch (error) {
      this.logger.error(`Failed to review file ${filePath}`, { error });
      return [];
    }
  }

  private createFileReviewPrompt(filePath: string, content: string, request: ReviewRequest): string {
    return `
Review the following file for ${request.reviewType} issues:

File: ${filePath}
Review Type: ${request.reviewType}
Focus Areas: ${request.focus.join(', ')}
Standards: ${request.standards.join(', ')}
Severity Level: ${request.severity}

File Content:
\`\`\`
${content}
\`\`\`

Please provide a JSON response with the following structure:
{
  "findings": [
    {
      "type": "issue|warning|suggestion|best-practice",
      "severity": "low|medium|high|critical",
      "category": "code-quality|security|performance|maintainability|documentation",
      "title": "Brief title of the finding",
      "description": "Detailed description of the issue",
      "line": 42,
      "code": "problematic code snippet",
      "impact": "What impact this issue has",
      "suggestion": "How to fix this issue",
      "confidence": 0.8,
      "autoFixable": true
    }
  ]
}

Focus on the specified areas and provide actionable feedback. Include specific line numbers and code examples where possible.
`;
  }

  private calculateMetrics(findings: ReviewFinding[], metrics: ReviewMetrics): void {
    metrics.totalIssues = findings.length;
    metrics.criticalIssues = findings.filter(f => f.severity === 'critical').length;
    metrics.highIssues = findings.filter(f => f.severity === 'high').length;
    metrics.mediumIssues = findings.filter(f => f.severity === 'medium').length;
    metrics.lowIssues = findings.filter(f => f.severity === 'low').length;

    // Calculate category scores
    const categoryScores: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};

    findings.forEach(finding => {
      categoryCounts[finding.category] = (categoryCounts[finding.category] || 0) + 1;
    });

    Object.keys(categoryCounts).forEach(category => {
      const maxScore = 100;
      const penalty = categoryCounts[category] * 10; // 10 points per issue
      categoryScores[category] = Math.max(0, maxScore - penalty);
    });

    metrics.codeQuality = categoryScores['code-quality'] || 100;
    metrics.securityScore = categoryScores['security'] || 100;
    metrics.performanceScore = categoryScores['performance'] || 100;
    metrics.maintainabilityScore = categoryScores['maintainability'] || 100;
    metrics.documentationScore = categoryScores['documentation'] || 100;
  }

  private async generateRecommendations(findings: ReviewFinding[], metrics: ReviewMetrics): Promise<ReviewRecommendation[]> {
    const recommendations: ReviewRecommendation[] = [];

    // Group findings by category
    const categoryGroups: Record<string, ReviewFinding[]> = {};
    findings.forEach(finding => {
      if (!categoryGroups[finding.category]) {
        categoryGroups[finding.category] = [];
      }
      categoryGroups[finding.category].push(finding);
    });

    // Generate recommendations for each category
    for (const [category, categoryFindings] of Object.entries(categoryGroups)) {
      const criticalCount = categoryFindings.filter(f => f.severity === 'critical').length;
      const highCount = categoryFindings.filter(f => f.severity === 'high').length;

      let priority: ReviewRecommendation['priority'] = 'long-term';
      let effort: ReviewRecommendation['effort'] = 'low';
      let impact: ReviewRecommendation['impact'] = 'low';

      if (criticalCount > 0) {
        priority = 'immediate';
        effort = 'high';
        impact = 'high';
      } else if (highCount > 0) {
        priority = 'short-term';
        effort = 'medium';
        impact = 'medium';
      }

      recommendations.push({
        priority,
        category,
        description: `Address ${categoryFindings.length} ${category} issues`,
        effort,
        impact,
        findings: categoryFindings.map(f => f.id),
      });
    }

    return recommendations;
  }

  private calculateOverallScore(metrics: ReviewMetrics): number {
    const weights = {
      codeQuality: 0.3,
      securityScore: 0.25,
      performanceScore: 0.2,
      maintainabilityScore: 0.15,
      documentationScore: 0.1,
    };

    const weightedScore = 
      metrics.codeQuality * weights.codeQuality +
      metrics.securityScore * weights.securityScore +
      metrics.performanceScore * weights.performanceScore +
      metrics.maintainabilityScore * weights.maintainabilityScore +
      metrics.documentationScore * weights.documentationScore;

    return Math.round(weightedScore);
  }

  private async generateSummary(findings: ReviewFinding[], metrics: ReviewMetrics, recommendations: ReviewRecommendation[]): Promise<string> {
    const prompt = `
Generate a comprehensive review summary based on the following data:

Findings: ${findings.length} total
- Critical: ${metrics.criticalIssues}
- High: ${metrics.highIssues}
- Medium: ${metrics.mediumIssues}
- Low: ${metrics.lowIssues}

Scores:
- Code Quality: ${metrics.codeQuality}%
- Security: ${metrics.securityScore}%
- Performance: ${metrics.performanceScore}%
- Maintainability: ${metrics.maintainabilityScore}%
- Documentation: ${metrics.documentationScore}%

Overall Score: ${this.calculateOverallScore(metrics)}%

Recommendations: ${recommendations.length}

Please provide a concise summary that highlights the key findings, overall quality assessment, and priority actions.
`;

    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert technical writer. Generate clear, concise review summaries.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 500,
      });

      return response.content;
    } catch (error) {
      this.logger.error('Failed to generate summary', { error });
      return `Review completed with ${findings.length} findings. Overall score: ${this.calculateOverallScore(metrics)}%.`;
    }
  }

  private async generateFixes(findings: ReviewFinding[], context: TaskContext): Promise<CodeFix[]> {
    const fixes: CodeFix[] = [];
    const autoFixableFindings = findings.filter(f => f.autoFixable);

    for (const finding of autoFixableFindings) {
      try {
        const fix = await this.generateFix(finding, context);
        if (fix) {
          fixes.push(fix);
        }
      } catch (error) {
        this.logger.error(`Failed to generate fix for finding ${finding.id}`, { error });
      }
    }

    return fixes;
  }

  private async generateFix(finding: ReviewFinding, context: TaskContext): Promise<CodeFix | null> {
    const fileContent = context.files.find(f => f.path === finding.file)?.content;
    if (!fileContent || !finding.code) {
      return null;
    }

    const prompt = `
Generate a fix for the following code issue:

Finding: ${finding.title}
Description: ${finding.description}
File: ${finding.file}
Line: ${finding.line}
Problematic Code:
\`\`\`
${finding.code}
\`\`\`

Suggestion: ${finding.suggestion}

Please provide a JSON response with the fixed code:
{
  "fixedCode": "fixed code snippet"
}

Provide only the fixed code, maintaining the same style and context.
`;

    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software developer. Generate precise code fixes.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.2,
        maxTokens: this.config.maxTokens || 500,
      });

      const data = JSON.parse(response.content);
      
      return {
        findingId: finding.id,
        file: finding.file,
        originalCode: finding.code,
        fixedCode: data.fixedCode,
        description: finding.suggestion,
        risk: finding.severity === 'critical' ? 'high' : finding.severity === 'high' ? 'medium' : 'low',
        confidence: finding.confidence,
      };
    } catch (error) {
      this.logger.error(`Failed to generate fix for finding ${finding.id}`, { error });
      return null;
    }
  }
}