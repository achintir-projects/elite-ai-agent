import { Task, TaskContext, TaskResult, AgentConfig, Logger } from '@ai-app-builder/shared';
import { BaseAgent } from './Agent';
import { ModelRouter } from '../models/ModelRouter';
import { ToolRegistry } from '../tooling/ToolRegistry';

export interface ResearchResult {
  query: string;
  findings: ResearchFinding[];
  sources: ResearchSource[];
  summary: string;
  recommendations: string[];
  confidence: number;
}

export interface ResearchFinding {
  title: string;
  description: string;
  relevance: number;
  source: string;
  url?: string;
  metadata: Record<string, any>;
}

export interface ResearchSource {
  name: string;
  url: string;
  type: 'documentation' | 'stackoverflow' | 'blog' | 'tutorial' | 'official' | 'other';
  credibility: number;
  lastUpdated?: string;
}

export class ResearcherAgent extends BaseAgent {
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
    this.logger.info('Initializing ResearcherAgent...');
    // Initialize researcher-specific resources
    this.logger.info('ResearcherAgent initialized successfully');
  }

  protected async onExecute(task: Task, context: TaskContext): Promise<TaskResult> {
    this.logger.info(`Researching task: ${task.description}`);

    try {
      // Extract research queries from task
      const queries = await this.extractResearchQueries(task, context);
      
      // Conduct research for each query
      const researchResults: ResearchResult[] = [];
      for (const query of queries) {
        const result = await this.conductResearch(query, context);
        researchResults.push(result);
      }

      // Synthesize research findings
      const synthesis = await this.synthesizeFindings(researchResults, task, context);

      return this.createTaskResult(
        true,
        {
          researchResults,
          synthesis,
          queries,
        },
        undefined,
        [{
          type: 'file',
          path: `research_${task.id}.json`,
          metadata: {
            taskId: task.id,
            queries: queries.length,
            findings: researchResults.reduce((sum, r) => sum + r.findings.length, 0),
            sources: researchResults.reduce((sum, r) => sum + r.sources.length, 0),
          },
        }]
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
    this.logger.info('Shutting down ResearcherAgent...');
    // Clean up researcher-specific resources
    this.logger.info('ResearcherAgent shutdown complete');
  }

  private async extractResearchQueries(task: Task, context: TaskContext): Promise<string[]> {
    this.logger.debug('Extracting research queries...');

    // Use AI model to extract research queries
    const prompt = this.createQueryExtractionPrompt(task, context);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert researcher. Extract key research queries from tasks that would help in finding relevant information, best practices, and solutions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 500,
      });

      const data = JSON.parse(response.content);
      return data.queries || [];
    } catch (error) {
      this.logger.error('Failed to extract queries with AI', { error });
      // Fallback to basic query extraction
      return this.fallbackQueryExtraction(task, context);
    }
  }

  private createQueryExtractionPrompt(task: Task, context: TaskContext): string {
    return `
Extract key research queries for the following task:

Task: ${task.description}
Type: ${task.type}
Priority: ${task.priority}

Context:
- Files: ${context.files.length} files
- Languages: ${[...new Set(context.files.map(f => f.language))].join(', ')}
- Environment: ${context.environment.os}

Please provide a JSON response with the following structure:
{
  "queries": [
    "Best practices for REST API design",
    "How to implement authentication in Node.js",
    "Database schema design patterns"
  ]
}

Extract 3-5 specific, actionable research queries that would help in completing this task successfully.
`;
  }

  private fallbackQueryExtraction(task: Task, context: TaskContext): string[] {
    // Basic query extraction based on task type and description
    const keywords = task.description.toLowerCase().split(' ');
    const taskType = task.type.toLowerCase();

    const queries = [
      `Best practices for ${taskType}`,
      `How to implement ${keywords.slice(0, 3).join(' ')}`,
      `Common issues with ${taskType}`,
    ];

    return queries.slice(0, 3);
  }

  private async conductResearch(query: string, context: TaskContext): Promise<ResearchResult> {
    this.logger.debug(`Conducting research for query: ${query}`);

    // Use available tools to gather information
    const findings: ResearchFinding[] = [];
    const sources: ResearchSource[] = [];

    try {
      // Try web search if available
      if (this.toolRegistry.hasTool('web-search')) {
        const searchResult = await this.toolRegistry.executeTool('web-search', {
          query,
          num: 5,
        });

        if (searchResult.success && searchResult.output) {
          const searchFindings = this.processSearchResults(searchResult.output, query);
          findings.push(...searchFindings.findings);
          sources.push(...searchFindings.sources);
        }
      }

      // Try documentation lookup if available
      if (this.toolRegistry.hasTool('documentation-lookup')) {
        const docResult = await this.toolRegistry.executeTool('documentation-lookup', {
          query,
          language: context.files[0]?.language || 'javascript',
        });

        if (docResult.success && docResult.output) {
          const docFindings = this.processDocumentationResults(docResult.output, query);
          findings.push(...docFindings.findings);
          sources.push(...docFindings.sources);
        }
      }

      // Use AI to analyze and summarize findings
      const summary = await this.summarizeFindings(query, findings, sources);

      return {
        query,
        findings,
        sources,
        summary: summary.summary,
        recommendations: summary.recommendations,
        confidence: summary.confidence,
      };
    } catch (error) {
      this.logger.error(`Failed to conduct research for query: ${query}`, { error });
      
      // Return minimal result
      return {
        query,
        findings: [],
        sources: [],
        summary: `Research failed for query: ${query}`,
        recommendations: [],
        confidence: 0,
      };
    }
  }

  private processSearchResults(searchResults: any, query: string): { findings: ResearchFinding[]; sources: ResearchSource[] } {
    const findings: ResearchFinding[] = [];
    const sources: ResearchSource[] = [];

    // Process search results (assuming they come in a standard format)
    if (Array.isArray(searchResults)) {
      for (const result of searchResults) {
        const finding: ResearchFinding = {
          title: result.name || result.title || 'Untitled',
          description: result.snippet || result.description || 'No description available',
          relevance: this.calculateRelevance(query, result.name || result.title || '', result.snippet || result.description || ''),
          source: result.host_name || result.source || 'Unknown',
          url: result.url,
          metadata: {
            rank: result.rank || 0,
            date: result.date,
          },
        };

        findings.push(finding);

        const source: ResearchSource = {
          name: result.host_name || result.source || 'Unknown',
          url: result.url || '',
          type: this.determineSourceType(result.url || ''),
          credibility: this.calculateCredibility(result.host_name || result.source || ''),
          lastUpdated: result.date,
        };

        sources.push(source);
      }
    }

    return { findings, sources };
  }

  private processDocumentationResults(docResults: any, query: string): { findings: ResearchFinding[]; sources: ResearchSource[] } {
    const findings: ResearchFinding[] = [];
    const sources: ResearchSource[] = [];

    // Process documentation results
    if (Array.isArray(docResults)) {
      for (const result of docResults) {
        const finding: ResearchFinding = {
          title: result.title || 'Documentation',
          description: result.content || result.description || 'No content available',
          relevance: this.calculateRelevance(query, result.title || '', result.content || result.description || ''),
          source: result.source || 'Documentation',
          url: result.url,
          metadata: {
            section: result.section,
            language: result.language,
          },
        };

        findings.push(finding);

        const source: ResearchSource = {
          name: result.source || 'Documentation',
          url: result.url || '',
          type: 'documentation',
          credibility: 0.9, // Documentation is usually highly credible
          lastUpdated: result.lastUpdated,
        };

        sources.push(source);
      }
    }

    return { findings, sources };
  }

  private calculateRelevance(query: string, title: string, description: string): number {
    const queryTerms = query.toLowerCase().split(' ');
    const text = (title + ' ' + description).toLowerCase();
    
    let relevance = 0;
    for (const term of queryTerms) {
      if (text.includes(term)) {
        relevance += 1;
      }
    }

    return Math.min(relevance / queryTerms.length, 1);
  }

  private determineSourceType(url: string): ResearchSource['type'] {
    if (url.includes('stackoverflow.com')) return 'stackoverflow';
    if (url.includes('github.com')) return 'official';
    if (url.includes('docs.') || url.includes('/docs/')) return 'documentation';
    if (url.includes('blog.') || url.includes('/blog/')) return 'blog';
    if (url.includes('tutorial') || url.includes('guide')) return 'tutorial';
    return 'other';
  }

  private calculateCredibility(source: string): number {
    const highCredibility = ['github.com', 'docs.python.org', 'developer.mozilla.org', 'nodejs.org'];
    const mediumCredibility = ['stackoverflow.com', 'medium.com', 'dev.to'];
    
    if (highCredibility.some(domain => source.includes(domain))) {
      return 0.9;
    }
    
    if (mediumCredibility.some(domain => source.includes(domain))) {
      return 0.7;
    }
    
    return 0.5;
  }

  private async summarizeFindings(query: string, findings: ResearchFinding[], sources: ResearchSource[]): Promise<{ summary: string; recommendations: string[]; confidence: number }> {
    if (findings.length === 0) {
      return {
        summary: `No relevant information found for query: ${query}`,
        recommendations: ['Try refining the search query', 'Check official documentation'],
        confidence: 0,
      };
    }

    // Use AI to summarize findings
    const prompt = this.createSummaryPrompt(query, findings, sources);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert research analyst. Summarize research findings and provide actionable recommendations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 800,
      });

      const data = JSON.parse(response.content);
      return {
        summary: data.summary || 'No summary available',
        recommendations: data.recommendations || [],
        confidence: data.confidence || 0.5,
      };
    } catch (error) {
      this.logger.error('Failed to summarize findings with AI', { error });
      
      // Fallback to basic summarization
      return this.fallbackSummary(query, findings, sources);
    }
  }

  private createSummaryPrompt(query: string, findings: ResearchFinding[], sources: ResearchSource[]): string {
    const findingsText = findings.map(f => 
      `- ${f.title}: ${f.description} (Relevance: ${f.relevance.toFixed(2)})`
    ).join('\n');

    const sourcesText = sources.map(s => 
      `- ${s.name} (${s.type}, Credibility: ${s.credibility.toFixed(2)})`
    ).join('\n');

    return `
Summarize the following research findings and provide recommendations:

Query: ${query}

Findings:
${findingsText}

Sources:
${sourcesText}

Please provide a JSON response with the following structure:
{
  "summary": "Comprehensive summary of the research findings",
  "recommendations": [
    "Specific recommendation 1",
    "Specific recommendation 2"
  ],
  "confidence": 0.8
}

The summary should be comprehensive and actionable. Recommendations should be specific and practical.
`;
  }

  private fallbackSummary(query: string, findings: ResearchFinding[], sources: ResearchSource[]): { summary: string; recommendations: string[]; confidence: number } {
    const topFindings = findings
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3);

    const summary = `Research for "${query}" found ${findings.length} relevant results. Top findings include: ${topFindings.map(f => f.title).join(', ')}.`;

    const recommendations = [
      'Review the most relevant findings first',
      'Check official documentation for authoritative information',
      'Consider multiple sources for comprehensive understanding',
    ];

    const avgRelevance = findings.reduce((sum, f) => sum + f.relevance, 0) / findings.length;
    const confidence = Math.min(avgRelevance, 1);

    return { summary, recommendations, confidence };
  }

  private async synthesizeFindings(researchResults: ResearchResult[], task: Task, context: TaskContext): Promise<any> {
    this.logger.debug('Synthesizing research findings...');

    // Use AI to synthesize all research results
    const prompt = this.createSynthesisPrompt(researchResults, task, context);
    
    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert research synthesizer. Combine multiple research results into a comprehensive analysis with actionable insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0.3,
        maxTokens: this.config.maxTokens || 1000,
      });

      return JSON.parse(response.content);
    } catch (error) {
      this.logger.error('Failed to synthesize findings with AI', { error });
      
      // Fallback to basic synthesis
      return this.fallbackSynthesis(researchResults, task, context);
    }
  }

  private createSynthesisPrompt(researchResults: ResearchResult[], task: Task, context: TaskContext): string {
    const researchSummary = researchResults.map(r => 
      `Query: ${r.query}\nSummary: ${r.summary}\nConfidence: ${r.confidence}\nRecommendations: ${r.recommendations.join(', ')}`
    ).join('\n\n');

    return `
Synthesize the following research results for the given task:

Task: ${task.description}
Type: ${task.type}

Research Results:
${researchSummary}

Please provide a JSON response with the following structure:
{
  "overallSummary": "Comprehensive summary combining all research",
  "keyInsights": [
    "Key insight 1",
    "Key insight 2"
  ],
  "actionableRecommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2"
  ],
  "knowledgeGaps": [
    "Knowledge gap 1",
    "Knowledge gap 2"
  ],
  "confidenceScore": 0.8
}

The synthesis should provide a comprehensive view of all research and highlight the most important insights for completing the task.
`;
  }

  private fallbackSynthesis(researchResults: ResearchResult[], task: Task, context: TaskContext): any {
    const totalFindings = researchResults.reduce((sum, r) => sum + r.findings.length, 0);
    const totalSources = researchResults.reduce((sum, r) => sum + r.sources.length, 0);
    const avgConfidence = researchResults.reduce((sum, r) => sum + r.confidence, 0) / researchResults.length;

    const allRecommendations = researchResults.flatMap(r => r.recommendations);
    const uniqueRecommendations = [...new Set(allRecommendations)];

    return {
      overallSummary: `Research completed for task "${task.description}" with ${totalFindings} findings from ${totalSources} sources.`,
      keyInsights: [
        `Research covered ${researchResults.length} different queries`,
        `Average confidence score: ${avgConfidence.toFixed(2)}`,
        `Multiple sources consulted for comprehensive coverage`,
      ],
      actionableRecommendations: uniqueRecommendations.slice(0, 5),
      knowledgeGaps: [
        'Real-world implementation examples',
        'Performance considerations',
        'Security best practices',
      ],
      confidenceScore: avgConfidence,
    };
  }
}