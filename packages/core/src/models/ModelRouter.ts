import { ModelConfig, ModelRequest, ModelResponse, Logger } from '@ai-app-builder/shared';
import ZAI from 'z-ai-web-dev-sdk';

export interface ModelRouterConfig {
  defaultModel: string;
  fallbackModels: string[];
  timeout: number;
  maxRetries: number;
  costBudget?: number;
  rateLimit: {
    requests: number;
    window: number; // in milliseconds
  };
}

export interface ModelMetrics {
  requests: number;
  tokensUsed: number;
  cost: number;
  latency: number[];
  errors: number;
}

export class ModelRouter {
  private logger: Logger;
  private config: Required<ModelRouterConfig>;
  private models: Map<string, ModelConfig> = new Map();
  private zai: ZAI | null = null;
  private metrics: ModelMetrics = {
    requests: 0,
    tokensUsed: 0,
    cost: 0,
    latency: [],
    errors: 0,
  };
  private requestTimes: Map<string, number[]> = new Map();

  constructor(config: ModelRouterConfig = {}, logger?: Logger) {
    this.logger = logger || this.createDefaultLogger();
    
    this.config = {
      defaultModel: config.defaultModel || 'deepseek-coder',
      fallbackModels: config.fallbackModels || ['code-llama', 'starcoder'],
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      costBudget: config.costBudget,
      rateLimit: {
        requests: config.rateLimit?.requests || 60,
        window: config.rateLimit?.window || 60000, // 1 minute
      },
    };
  }

  private createDefaultLogger(): Logger {
    return {
      info: (message: string, meta?: any) => {
        console.log(`[ModelRouter] ${message}`, meta || '');
      },
      warn: (message: string, meta?: any) => {
        console.warn(`[ModelRouter] ${message}`, meta || '');
      },
      error: (message: string, meta?: any) => {
        console.error(`[ModelRouter] ${message}`, meta || '');
      },
      debug: (message: string, meta?: any) => {
        console.debug(`[ModelRouter] ${message}`, meta || '');
      },
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing ModelRouter...');
    
    try {
      // Initialize ZAI SDK
      this.zai = await ZAI.create();
      
      // Register default models
      await this.registerDefaultModels();
      
      this.logger.info('ModelRouter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ModelRouter', { error });
      throw error;
    }
  }

  private async registerDefaultModels(): Promise<void> {
    const defaultModels: ModelConfig[] = [
      {
        name: 'deepseek-coder',
        type: 'oss',
        maxTokens: 8192,
        supportsStreaming: true,
        costPerToken: 0.0001, // Example cost
      },
      {
        name: 'code-llama',
        type: 'oss',
        maxTokens: 4096,
        supportsStreaming: true,
        costPerToken: 0.0002,
      },
      {
        name: 'starcoder',
        type: 'oss',
        maxTokens: 8192,
        supportsStreaming: true,
        costPerToken: 0.00015,
      },
      {
        name: 'gemma-code',
        type: 'oss',
        maxTokens: 8192,
        supportsStreaming: true,
        costPerToken: 0.0001,
      },
      {
        name: 'qwen-coder',
        type: 'oss',
        maxTokens: 8192,
        supportsStreaming: true,
        costPerToken: 0.00012,
      },
    ];

    for (const modelConfig of defaultModels) {
      this.registerModel(modelConfig);
      this.logger.debug(`Registered model: ${modelConfig.name}`);
    }
  }

  registerModel(modelConfig: ModelConfig): void {
    this.models.set(modelConfig.name, modelConfig);
    this.logger.info(`Registered model: ${modelConfig.name}`);
  }

  async generateResponse(request: ModelRequest): Promise<ModelResponse> {
    if (!this.zai) {
      throw new Error('ModelRouter not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Check rate limits
      this.checkRateLimit();

      // Select best model
      const modelName = this.selectModel(request);
      const model = this.models.get(modelName);
      
      if (!model) {
        throw new Error(`Model not found: ${modelName}`);
      }

      this.logger.debug(`Using model: ${modelName} for request`);

      // Prepare request for ZAI
      const zaiRequest = this.prepareZAIRequest(request, model);

      // Execute with retry logic
      const response = await this.executeWithRetry(modelName, zaiRequest);

      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(response, latency);

      // Transform response
      return this.transformResponse(response, modelName);

    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Failed to generate response', { error });
      throw error;
    }
  }

  private selectModel(request: ModelRequest): string {
    // Simple model selection logic
    // In a real implementation, this would be more sophisticated
    
    // Use default model first
    let selectedModel = this.config.defaultModel;
    
    // Check if default model is available and suitable
    const defaultModelConfig = this.models.get(selectedModel);
    if (!defaultModelConfig) {
      // Fall back to first available model
      selectedModel = this.config.fallbackModels[0] || Array.from(this.models.keys())[0];
    }

    // Check token requirements
    const estimatedTokens = this.estimateTokenCount(request);
    if (defaultModelConfig && estimatedTokens > defaultModelConfig.maxTokens) {
      // Find a model with higher token limit
      for (const [modelName, modelConfig] of this.models) {
        if (modelConfig.maxTokens >= estimatedTokens) {
          selectedModel = modelName;
          break;
        }
      }
    }

    // Check cost budget
    if (this.config.costBudget) {
      const modelCost = this.models.get(selectedModel)?.costPerToken || 0;
      const estimatedCost = estimatedTokens * modelCost;
      
      if (this.metrics.cost + estimatedCost > this.config.costBudget) {
        // Find a cheaper model
        for (const [modelName, modelConfig] of this.models) {
          const cost = estimatedTokens * (modelConfig.costPerToken || 0);
          if (this.metrics.cost + cost <= this.config.costBudget) {
            selectedModel = modelName;
            break;
          }
        }
      }
    }

    this.logger.debug(`Selected model: ${selectedModel}`);
    return selectedModel;
  }

  private estimateTokenCount(request: ModelRequest): number {
    // Simple token estimation
    const text = request.messages.map(m => m.content).join(' ');
    return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 characters
  }

  private prepareZAIRequest(request: ModelRequest, model: ModelConfig): any {
    // Transform our request format to ZAI format
    return {
      messages: request.messages,
      temperature: request.temperature || 0.7,
      max_tokens: Math.min(request.maxTokens || 2048, model.maxTokens),
      stream: request.stream || false,
    };
  }

  private async executeWithRetry(modelName: string, zaiRequest: any): Promise<any> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.logger.debug(`Executing request (attempt ${attempt})`);
        
        // Set timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), this.config.timeout);
        });

        // Execute request
        const executionPromise = this.zai!.chat.completions.create({
          ...zaiRequest,
          model: modelName,
        });

        // Race with timeout
        const result = await Promise.race([executionPromise, timeoutPromise]);
        
        this.logger.debug('Request completed successfully');
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Request attempt ${attempt} failed: ${lastError.message}`);
        
        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  private transformResponse(zaiResponse: any, modelName: string): ModelResponse {
    // Transform ZAI response to our format
    const choice = zaiResponse.choices?.[0];
    const message = choice?.message;
    
    return {
      content: message?.content || '',
      usage: {
        promptTokens: zaiResponse.usage?.prompt_tokens || 0,
        completionTokens: zaiResponse.usage?.completion_tokens || 0,
        totalTokens: zaiResponse.usage?.total_tokens || 0,
      },
      model: modelName,
      finishReason: choice?.finish_reason || 'stop',
    };
  }

  private checkRateLimit(): void {
    const now = Date.now();
    const windowStart = now - this.config.rateLimit.window;
    
    // Clean old request times
    for (const [model, times] of this.requestTimes) {
      const validTimes = times.filter(time => time > windowStart);
      this.requestTimes.set(model, validTimes);
    }

    // Check if we're over the limit
    for (const [model, times] of this.requestTimes) {
      if (times.length >= this.config.rateLimit.requests) {
        throw new Error(`Rate limit exceeded for model ${model}`);
      }
    }

    // Record this request time
    const modelTimes = this.requestTimes.get(this.config.defaultModel) || [];
    modelTimes.push(now);
    this.requestTimes.set(this.config.defaultModel, modelTimes);
  }

  private updateMetrics(response: ModelResponse, latency: number): void {
    this.metrics.requests++;
    this.metrics.tokensUsed += response.usage.totalTokens;
    this.metrics.latency.push(latency);
    
    // Calculate cost
    const modelConfig = this.models.get(response.model);
    if (modelConfig?.costPerToken) {
      this.metrics.cost += response.usage.totalTokens * modelConfig.costPerToken;
    }

    // Keep only recent latency measurements (last 100)
    if (this.metrics.latency.length > 100) {
      this.metrics.latency = this.metrics.latency.slice(-100);
    }
  }

  getMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  getModelConfigs(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down ModelRouter...');
    
    // Clean up resources
    this.zai = null;
    this.models.clear();
    this.requestTimes.clear();
    
    this.logger.info('ModelRouter shutdown complete');
  }

  // Streaming support
  async generateStreamingResponse(request: ModelRequest): Promise<AsyncIterable<string>> {
    if (!this.zai) {
      throw new Error('ModelRouter not initialized');
    }

    const modelName = this.selectModel(request);
    const model = this.models.get(modelName);
    
    if (!model || !model.supportsStreaming) {
      throw new Error(`Streaming not supported for model: ${modelName}`);
    }

    const zaiRequest = this.prepareZAIRequest({ ...request, stream: true }, model);

    try {
      const stream = await this.zai.chat.completions.create({
        ...zaiRequest,
        model: modelName,
        stream: true,
      });

      return this.transformStream(stream);
    } catch (error) {
      this.logger.error('Failed to create streaming response', { error });
      throw error;
    }
  }

  private async* transformStream(stream: any): AsyncIterable<string> {
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  // Batch processing
  async generateBatchResponses(requests: ModelRequest[]): Promise<ModelResponse[]> {
    const responses: ModelResponse[] = [];
    
    // Process requests in parallel with concurrency limit
    const concurrencyLimit = 5;
    const chunks = this.chunkArray(requests, concurrencyLimit);
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(request => this.generateResponse(request));
      const chunkResponses = await Promise.allSettled(chunkPromises);
      
      for (const result of chunkResponses) {
        if (result.status === 'fulfilled') {
          responses.push(result.value);
        } else {
          this.logger.error('Batch request failed', { error: result.reason });
          // Add error response
          responses.push({
            content: '',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            model: 'error',
            finishReason: 'error',
          });
        }
      }
    }

    return responses;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Model health check
  async checkModelHealth(modelName: string): Promise<{ healthy: boolean; latency: number; error?: string }> {
    if (!this.models.has(modelName)) {
      return {
        healthy: false,
        latency: 0,
        error: 'Model not registered',
      };
    }

    const startTime = Date.now();
    
    try {
      const testRequest: ModelRequest = {
        model: modelName,
        messages: [
          { role: 'user', content: 'Hello' },
        ],
        maxTokens: 10,
      };

      await this.generateResponse(testRequest);
      
      const latency = Date.now() - startTime;
      return { healthy: true, latency };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        healthy: false,
        latency,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Get model recommendations
  getModelRecommendations(request: ModelRequest): ModelRecommendation[] {
    const recommendations: ModelRecommendation[] = [];
    const estimatedTokens = this.estimateTokenCount(request);

    for (const [modelName, modelConfig] of this.models) {
      const score = this.calculateModelScore(modelConfig, request, estimatedTokens);
      
      recommendations.push({
        model: modelName,
        score,
        reasons: this.getScoreReasons(modelConfig, request, estimatedTokens),
        estimatedCost: estimatedTokens * (modelConfig.costPerToken || 0),
        estimatedLatency: this.estimateLatency(modelConfig, estimatedTokens),
      });
    }

    // Sort by score (highest first)
    return recommendations.sort((a, b) => b.score - a.score);
  }

  private calculateModelScore(model: ModelConfig, request: ModelRequest, estimatedTokens: number): number {
    let score = 100;

    // Penalize for insufficient token limit
    if (estimatedTokens > model.maxTokens) {
      score -= 50;
    }

    // Penalize for high cost
    const cost = estimatedTokens * (model.costPerToken || 0);
    score -= Math.min(cost * 1000, 20); // Max 20 point penalty for cost

    // Bonus for streaming support if requested
    if (request.stream && model.supportsStreaming) {
      score += 10;
    }

    // Bonus for preferred model types
    if (model.type === 'oss') {
      score += 5;
    }

    return Math.max(0, score);
  }

  private getScoreReasons(model: ModelConfig, request: ModelRequest, estimatedTokens: number): string[] {
    const reasons: string[] = [];

    if (estimatedTokens > model.maxTokens) {
      reasons.push('Insufficient token limit');
    }

    if (request.stream && model.supportsStreaming) {
      reasons.push('Supports streaming');
    }

    if (model.type === 'oss') {
      reasons.push('Open source model');
    }

    if (model.costPerToken && model.costPerToken < 0.0002) {
      reasons.push('Low cost');
    }

    return reasons;
  }

  private estimateLatency(model: ModelConfig, estimatedTokens: number): number {
    // Simple latency estimation based on model type and token count
    const baseLatency = model.type === 'oss' ? 1000 : 500; // OSS models typically slower
    const tokenLatency = estimatedTokens * 10; // 10ms per token
    return baseLatency + tokenLatency;
  }
}

export interface ModelRecommendation {
  model: string;
  score: number;
  reasons: string[];
  estimatedCost: number;
  estimatedLatency: number;
}