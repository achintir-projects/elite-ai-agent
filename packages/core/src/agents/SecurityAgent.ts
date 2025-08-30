import { Task, TaskContext, TaskResult, AgentConfig, Logger } from '@ai-app-builder/shared';
import { BaseAgent } from './Agent';
import { ModelRouter } from '../models/ModelRouter';
import { ToolRegistry } from '../tooling/ToolRegistry';

export interface SecurityScanRequest {
  targetFiles: string[];
  scanTypes: ('dependency' | 'secret' | 'sast' | 'dast' | 'license')[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  complianceStandards: string[];
  customRules?: SecurityRule[];
  failOnCritical: boolean;
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  type: 'pattern' | 'regex' | 'semantic';
  pattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'injection' | 'auth' | 'crypto' | 'data' | 'config' | 'network';
  cwe?: string;
  remediation: string;
}

export interface SecurityScanResult {
  findings: SecurityFinding[];
  metrics: SecurityMetrics;
  compliance: ComplianceReport;
  riskAssessment: RiskAssessment;
  recommendations: SecurityRecommendation[];
  sbom: SBOM;
}

export interface SecurityFinding {
  id: string;
  type: 'vulnerability' | 'secret' | 'misconfiguration' | 'weakness';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  file: string;
  line?: number;
  code?: string;
  cve?: string;
  cwe?: string;
  cvss?: number;
  impact: string;
  likelihood: string;
  remediation: string;
  references: string[];
  confidence: number;
  falsePositive: boolean;
}

export interface SecurityMetrics {
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  vulnerabilityScore: number;
  securityPosture: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  trend: 'improving' | 'stable' | 'degrading';
}

export interface ComplianceReport {
  standards: ComplianceStandard[];
  overallScore: number;
  gaps: ComplianceGap[];
}

export interface ComplianceStandard {
  name: string;
  version: string;
  score: number;
  status: 'compliant' | 'partial' | 'non-compliant';
  findings: string[];
}

export interface ComplianceGap {
  standard: string;
  requirement: string;
  current: string;
  target: string;
  effort: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  mitigation: MitigationStrategy[];
}

export interface RiskFactor {
  category: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  likelihood: string;
  findings: string[];
}

export interface MitigationStrategy {
  priority: 'immediate' | 'short-term' | 'long-term';
  description: string;
  effort: 'low' | 'medium' | 'high';
  effectiveness: 'low' | 'medium' | 'high';
  cost: 'low' | 'medium' | 'high';
}

export interface SecurityRecommendation {
  id: string;
  type: 'fix' | 'config' | 'process' | 'training';
  priority: 'immediate' | 'short-term' | 'long-term';
  category: string;
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  findings: string[];
  steps: string[];
}

export interface SBOM {
  format: 'cyclonedx' | 'spdx';
  version: string;
  components: SBOMComponent[];
  dependencies: SBOMDependency[];
}

export interface SBOMComponent {
  name: string;
  version: string;
  type: 'library' | 'framework' | 'tool' | 'platform';
  supplier?: string;
  licenses: string[];
  purl?: string;
  cpe?: string;
  vulnerabilities: Vulnerability[];
}

export interface Vulnerability {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
  references: string[];
}

export interface SBOMDependency {
  ref: string;
  dependsOn: string[];
}

export class SecurityAgent extends BaseAgent {
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
    this.logger.info('Initializing SecurityAgent...');
    // Initialize security-specific resources
    this.logger.info('SecurityAgent initialized successfully');
  }

  protected async onExecute(task: Task, context: TaskContext): Promise<TaskResult> {
    this.logger.info(`Security scanning for task: ${task.description}`);

    try {
      // Parse security scan request
      const request = await this.parseSecurityRequest(task, context);
      
      // Perform security scan
      const scanResult = await this.performSecurityScan(request, context);
      
      // Check if critical findings should fail the task
      if (request.failOnCritical && scanResult.findings.some(f => f.severity === 'critical')) {
        throw new Error('Critical security vulnerabilities found - scan failed');
      }

      return this.createTaskResult(
        true,
        {
          request,
          scanResult,
        },
        undefined,
        [
          {
            type: 'file' as const,
            path: `security_scan_${task.id}.json`,
            metadata: {
              scanTypes: request.scanTypes,
              totalFindings: scanResult.findings.length,
              criticalFindings: scanResult.metrics.criticalFindings,
              securityPosture: scanResult.metrics.securityPosture,
            },
          },
          {
            type: 'file' as const,
            path: `sbom_${task.id}.json`,
            metadata: {
              format: scanResult.sbom.format,
              components: scanResult.sbom.components.length,
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
    this.logger.info('Shutting down SecurityAgent...');
    // Clean up security-specific resources
    this.logger.info('SecurityAgent shutdown complete');
  }

  private async parseSecurityRequest(task: Task, context: TaskContext): Promise<SecurityScanRequest> {
    this.logger.debug('Parsing security scan request...');

    const prompt = `
Parse the following task into a structured security scan request:

Task: ${task.description}
Type: ${task.type}
Priority: ${task.priority}

Context:
- Files available: ${context.files.length}
- Environment: ${context.environment.os}

Please provide a JSON response with the following structure:
{
  "targetFiles": ["path/to/file1.js", "path/to/file2.js"],
  "scanTypes": ["dependency", "secret", "sast", "dast", "license"],
  "severity": "low|medium|high|critical",
  "complianceStandards": ["OWASP", "NIST", "GDPR"],
  "failOnCritical": true
}

Identify the files to scan and the appropriate scan types based on the task description.
`;

    try {
      const response = await this.modelRouter.generateResponse({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert security analyst. Parse task descriptions into structured security scan requests.',
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
        scanTypes: data.scanTypes || ['dependency', 'secret'],
        severity: data.severity || 'medium',
        complianceStandards: data.complianceStandards || ['OWASP'],
        failOnCritical: data.failOnCritical || true,
      };
    } catch (error) {
      this.logger.error('Failed to parse security request', { error });
      return this.fallbackSecurityRequest(task, context);
    }
  }

  private fallbackSecurityRequest(task: Task, context: TaskContext): SecurityScanRequest {
    return {
      targetFiles: context.files.map(f => f.path),
      scanTypes: ['dependency', 'secret'],
      severity: 'medium',
      complianceStandards: ['OWASP'],
      failOnCritical: true,
    };
  }

  private async performSecurityScan(request: SecurityScanRequest, context: TaskContext): Promise<SecurityScanResult> {
    this.logger.debug('Performing security scan...');

    const findings: SecurityFinding[] = [];
    const sbom: SBOM = {
      format: 'cyclonedx',
      version: '1.4',
      components: [],
      dependencies: [],
    };

    // Perform different types of scans
    for (const scanType of request.scanTypes) {
      try {
        const scanResults = await this.performScanType(scanType, request, context);
        findings.push(...scanResults.findings);
        
        if (scanType === 'dependency') {
          sbom.components.push(...scanResults.components);
          sbom.dependencies.push(...scanResults.dependencies);
        }
      } catch (error) {
        this.logger.error(`Failed to perform ${scanType} scan`, { error });
      }
    }

    // Calculate metrics
    const metrics = this.calculateSecurityMetrics(findings);

    // Generate compliance report
    const compliance = await this.generateComplianceReport(findings, request.complianceStandards);

    // Generate risk assessment
    const riskAssessment = await this.generateRiskAssessment(findings, metrics);

    // Generate recommendations
    const recommendations = await this.generateSecurityRecommendations(findings, riskAssessment);

    return {
      findings,
      metrics,
      compliance,
      riskAssessment,
      recommendations,
      sbom,
    };
  }

  private async performScanType(scanType: string, request: SecurityScanRequest, context: TaskContext): Promise<{ findings: SecurityFinding[]; components: SBOMComponent[]; dependencies: SBOMDependency[] }> {
    const findings: SecurityFinding[] = [];
    const components: SBOMComponent[] = [];
    const dependencies: SBOMDependency[] = [];

    switch (scanType) {
      case 'dependency':
        return await this.scanDependencies(request, context);
      case 'secret':
        return await this.scanSecrets(request, context);
      case 'sast':
        return await this.scanSAST(request, context);
      case 'dast':
        return await this.scanDAST(request, context);
      case 'license':
        return await this.scanLicenses(request, context);
      default:
        this.logger.warn(`Unknown scan type: ${scanType}`);
        return { findings: [], components: [], dependencies: [] };
    }
  }

  private async scanDependencies(request: SecurityScanRequest, context: TaskContext): Promise<{ findings: SecurityFinding[]; components: SBOMComponent[]; dependencies: SBOMDependency[] }> {
    const findings: SecurityFinding[] = [];
    const components: SBOMComponent[] = [];
    const dependencies: SBOMDependency[] = [];

    // Try to use dependency scanning tool
    if (this.toolRegistry.hasTool('dependency-check')) {
      try {
        const result = await this.toolRegistry.executeTool('dependency-check', {
          targetFiles: request.targetFiles,
          severity: request.severity,
        });

        if (result.success && result.output) {
          const scanResults = this.parseDependencyScanResults(result.output);
          findings.push(...scanResults.findings);
          components.push(...scanResults.components);
          dependencies.push(...scanResults.dependencies);
        }
      } catch (error) {
        this.logger.error('Dependency scan failed', { error });
      }
    }

    // Fallback to AI-based analysis
    if (findings.length === 0) {
      const aiResults = await this.analyzeDependenciesWithAI(request, context);
      findings.push(...aiResults.findings);
      components.push(...aiResults.components);
      dependencies.push(...aiResults.dependencies);
    }

    return { findings, components, dependencies };
  }

  private parseDependencyScanResults(output: any): { findings: SecurityFinding[]; components: SBOMComponent[]; dependencies: SBOMDependency[] } {
    // Parse dependency scan results (simplified)
    return {
      findings: [],
      components: [],
      dependencies: [],
    };
  }

  private async analyzeDependenciesWithAI(request: SecurityScanRequest, context: TaskContext): Promise<{ findings: SecurityFinding[]; components: SBOMComponent[]; dependencies: SBOMDependency[] }> {
    const findings: SecurityFinding[] = [];
    const components: SBOMComponent[] = [];
    const dependencies: SBOMDependency[] = [];

    // Analyze package.json or similar dependency files
    for (const filePath of request.targetFiles) {
      if (filePath.includes('package.json')) {
        try {
          const fileContent = context.files.find(f => f.path === filePath)?.content;
          if (fileContent) {
            const packageJson = JSON.parse(fileContent);
            
            // Analyze dependencies
            const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            for (const [name, version] of Object.entries(allDeps)) {
              components.push({
                name,
                version: version as string,
                type: 'library',
                licenses: ['Unknown'],
                vulnerabilities: [],
              });

              dependencies.push({
                ref: `pkg:npm/${name}@${version}`,
                dependsOn: [],
              });
            }
          }
        } catch (error) {
          this.logger.error(`Failed to analyze ${filePath}`, { error });
        }
      }
    }

    return { findings, components, dependencies };
  }

  private async scanSecrets(request: SecurityScanRequest, context: TaskContext): Promise<{ findings: SecurityFinding[]; components: SBOMComponent[]; dependencies: SBOMDependency[] }> {
    const findings: SecurityFinding[] = [];

    // Try to use secret scanning tool
    if (this.toolRegistry.hasTool('secret-scanner')) {
      try {
        const result = await this.toolRegistry.executeTool('secret-scanner', {
          targetFiles: request.targetFiles,
        });

        if (result.success && result.output) {
          const scanResults = this.parseSecretScanResults(result.output);
          findings.push(...scanResults);
        }
      } catch (error) {
        this.logger.error('Secret scan failed', { error });
      }
    }

    // Fallback to AI-based analysis
    if (findings.length === 0) {
      const aiResults = await this.analyzeSecretsWithAI(request, context);
      findings.push(...aiResults);
    }

    return { findings, components: [], dependencies: [] };
  }

  private parseSecretScanResults(output: any): SecurityFinding[] {
    // Parse secret scan results (simplified)
    return [];
  }

  private async analyzeSecretsWithAI(request: SecurityScanRequest, context: TaskContext): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Use AI to analyze files for secrets
    for (const filePath of request.targetFiles) {
      const fileContent = context.files.find(f => f.path === filePath)?.content;
      if (!fileContent) continue;

      const prompt = `
Analyze the following file for potential secrets, API keys, passwords, or other sensitive information:

File: ${filePath}

Content:
\`\`\`
${fileContent}
\`\`\`

Please provide a JSON response with any secrets found:
{
  "secrets": [
    {
      "type": "api-key|password|token|certificate",
      "line": 42,
      "code": "line with secret",
      "description": "Description of the secret type",
      "severity": "high|critical"
    }
  ]
}

If no secrets are found, return an empty array.
`;

      try {
        const response = await this.modelRouter.generateResponse({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert security analyst specializing in secret detection.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: this.config.temperature || 0.2,
          maxTokens: this.config.maxTokens || 1000,
        });

        const data = JSON.parse(response.content);
        
        for (const secret of data.secrets || []) {
          findings.push({
            id: `secret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'secret',
            severity: secret.severity,
            category: 'data',
            title: `Potential ${secret.type} detected`,
            description: secret.description,
            file: filePath,
            line: secret.line,
            code: secret.code,
            impact: 'Exposure of sensitive credentials could lead to unauthorized access',
            likelihood: 'high',
            remediation: 'Remove the secret and use environment variables or a secret management system',
            references: ['OWASP Secret Management Cheat Sheet'],
            confidence: 0.8,
            falsePositive: false,
          });
        }
      } catch (error) {
        this.logger.error(`Failed to analyze ${filePath} for secrets`, { error });
      }
    }

    return findings;
  }

  private async scanSAST(request: SecurityScanRequest, context: TaskContext): Promise<{ findings: SecurityFinding[]; components: SBOMComponent[]; dependencies: SBOMDependency[] }> {
    const findings: SecurityFinding[] = [];

    // Use AI to perform static analysis
    for (const filePath of request.targetFiles) {
      const fileContent = context.files.find(f => f.path === filePath)?.content;
      if (!fileContent) continue;

      const prompt = `
Perform static application security testing (SAST) on the following file:

File: ${filePath}

Content:
\`\`\`
${fileContent}
\`\`\`

Please provide a JSON response with security vulnerabilities found:
{
  "vulnerabilities": [
    {
      "type": "injection|auth|crypto|data|config|network",
      "severity": "low|medium|high|critical",
      "line": 42,
      "code": "vulnerable code",
      "description": "Description of the vulnerability",
      "cwe": "CWE-79",
      "remediation": "How to fix this vulnerability"
    }
  ]
}

Focus on common vulnerabilities like SQL injection, XSS, CSRF, insecure authentication, weak cryptography, etc.
`;

      try {
        const response = await this.modelRouter.generateResponse({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert security analyst specializing in static application security testing.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: this.config.temperature || 0.3,
          maxTokens: this.config.maxTokens || 1500,
        });

        const data = JSON.parse(response.content);
        
        for (const vuln of data.vulnerabilities || []) {
          findings.push({
            id: `sast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'vulnerability',
            severity: vuln.severity,
            category: vuln.type,
            title: `Security vulnerability: ${vuln.type}`,
            description: vuln.description,
            file: filePath,
            line: vuln.line,
            code: vuln.code,
            cwe: vuln.cwe,
            impact: 'Potential security breach',
            likelihood: 'medium',
            remediation: vuln.remediation,
            references: ['OWASP Top 10'],
            confidence: 0.7,
            falsePositive: false,
          });
        }
      } catch (error) {
        this.logger.error(`Failed to perform SAST on ${filePath}`, { error });
      }
    }

    return { findings, components: [], dependencies: [] };
  }

  private async scanDAST(request: SecurityScanRequest, context: TaskContext): Promise<{ findings: SecurityFinding[]; components: SBOMComponent[]; dependencies: SBOMDependency[] }> {
    // DAST requires running application - simplified implementation
    return { findings: [], components: [], dependencies: [] };
  }

  private async scanLicenses(request: SecurityScanRequest, context: TaskContext): Promise<{ findings: SecurityFinding[]; components: SBOMComponent[]; dependencies: SBOMDependency[] }> {
    const findings: SecurityFinding[] = [];

    // Analyze licenses in dependencies
    // This is a simplified implementation
    return { findings, components: [], dependencies: [] };
  }

  private calculateSecurityMetrics(findings: SecurityFinding[]): SecurityMetrics {
    const totalFindings = findings.length;
    const criticalFindings = findings.filter(f => f.severity === 'critical').length;
    const highFindings = findings.filter(f => f.severity === 'high').length;
    const mediumFindings = findings.filter(f => f.severity === 'medium').length;
    const lowFindings = findings.filter(f => f.severity === 'low').length;

    // Calculate vulnerability score (inverse of findings)
    const maxScore = 100;
    const criticalPenalty = criticalFindings * 20;
    const highPenalty = highFindings * 10;
    const mediumPenalty = mediumFindings * 5;
    const lowPenalty = lowFindings * 2;
    
    const vulnerabilityScore = Math.max(0, maxScore - criticalPenalty - highPenalty - mediumPenalty - lowPenalty);

    // Determine security posture
    let securityPosture: SecurityMetrics['securityPosture'] = 'excellent';
    if (criticalFindings > 0) {
      securityPosture = 'critical';
    } else if (highFindings > 2) {
      securityPosture = 'poor';
    } else if (highFindings > 0 || mediumFindings > 5) {
      securityPosture = 'fair';
    } else if (mediumFindings > 0) {
      securityPosture = 'good';
    }

    return {
      totalFindings,
      criticalFindings,
      highFindings,
      mediumFindings,
      lowFindings,
      vulnerabilityScore,
      securityPosture,
      trend: 'stable', // Would need historical data for trend
    };
  }

  private async generateComplianceReport(findings: SecurityFinding[], standards: string[]): Promise<ComplianceReport> {
    const complianceStandards: ComplianceStandard[] = [];

    for (const standard of standards) {
      const score = this.calculateComplianceScore(findings, standard);
      const status: ComplianceStandard['status'] = score >= 90 ? 'compliant' : score >= 70 ? 'partial' : 'non-compliant';
      
      complianceStandards.push({
        name: standard,
        version: 'latest',
        score,
        status,
        findings: findings.filter(f => this.isRelevantToStandard(f, standard)).map(f => f.title),
      });
    }

    const overallScore = complianceStandards.reduce((sum, s) => sum + s.score, 0) / complianceStandards.length;

    return {
      standards: complianceStandards,
      overallScore,
      gaps: [], // Would need more detailed analysis
    };
  }

  private calculateComplianceScore(findings: SecurityFinding[], standard: string): number {
    const relevantFindings = findings.filter(f => this.isRelevantToStandard(f, standard));
    const maxScore = 100;
    const penalty = relevantFindings.reduce((sum, f) => {
      switch (f.severity) {
        case 'critical': return sum + 20;
        case 'high': return sum + 10;
        case 'medium': return sum + 5;
        case 'low': return sum + 2;
        default: return sum;
      }
    }, 0);
    
    return Math.max(0, maxScore - penalty);
  }

  private isRelevantToStandard(finding: SecurityFinding, standard: string): boolean {
    // Simplified relevance check
    return true;
  }

  private async generateRiskAssessment(findings: SecurityFinding[], metrics: SecurityMetrics): Promise<RiskAssessment> {
    let overallRisk: RiskAssessment['overallRisk'] = 'low';
    
    if (metrics.criticalFindings > 0) {
      overallRisk = 'critical';
    } else if (metrics.highFindings > 2) {
      overallRisk = 'high';
    } else if (metrics.highFindings > 0 || metrics.mediumFindings > 5) {
      overallRisk = 'medium';
    }

    const factors: RiskFactor[] = [
      {
        category: 'Vulnerabilities',
        level: overallRisk,
        description: `${metrics.totalFindings} security findings detected`,
        impact: 'Potential security breaches and data loss',
        likelihood: overallRisk === 'critical' ? 'high' : 'medium',
        findings: findings.map(f => f.id),
      },
    ];

    const mitigation: MitigationStrategy[] = [
      {
        priority: 'immediate',
        description: 'Address critical and high-severity findings',
        effort: 'high',
        effectiveness: 'high',
        cost: 'medium',
      },
    ];

    return {
      overallRisk,
      factors,
      mitigation,
    };
  }

  private async generateSecurityRecommendations(findings: SecurityFinding[], riskAssessment: RiskAssessment): Promise<SecurityRecommendation[]> {
    const recommendations: SecurityRecommendation[] = [];

    // Group findings by severity and type
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');

    if (criticalFindings.length > 0) {
      recommendations.push({
        id: 'rec-critical-fixes',
        type: 'fix',
        priority: 'immediate',
        category: 'vulnerability',
        title: 'Fix Critical Security Vulnerabilities',
        description: `Address ${criticalFindings.length} critical security vulnerabilities immediately`,
        effort: 'high',
        impact: 'high',
        findings: criticalFindings.map(f => f.id),
        steps: [
          'Review each critical finding',
          'Implement recommended fixes',
          'Test fixes thoroughly',
          'Deploy patches',
        ],
      });
    }

    if (highFindings.length > 0) {
      recommendations.push({
        id: 'rec-high-fixes',
        type: 'fix',
        priority: 'short-term',
        category: 'vulnerability',
        title: 'Fix High-Severity Security Issues',
        description: `Address ${highFindings.length} high-severity security issues`,
        effort: 'medium',
        impact: 'medium',
        findings: highFindings.map(f => f.id),
        steps: [
          'Prioritize high-severity findings',
          'Schedule fixes for next sprint',
          'Implement security best practices',
        ],
      });
    }

    return recommendations;
  }
}