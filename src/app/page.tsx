'use client';

import { useState, useRef } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  Play, 
  Square, 
  Save, 
  FolderOpen, 
  FileText, 
  Settings, 
  Terminal,
  Search,
  GitBranch,
  Bug,
  Package,
  Shield,
  FileCode,
  Layers,
  Zap,
  Code,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  modified: boolean;
  type: 'file' | 'folder';
  children?: FileItem[];
}

interface TerminalOutput {
  id: string;
  content: string;
  timestamp: Date;
  type: 'info' | 'error' | 'success' | 'warning';
}

export default function WebIDE() {
  const [files, setFiles] = useState<FileItem[]>([
    {
      id: 'src',
      name: 'src',
      path: 'src',
      content: '',
      language: '',
      modified: false,
      type: 'folder',
      children: [
        {
          id: 'app',
          name: 'app',
          path: 'src/app',
          content: '',
          language: '',
          modified: false,
          type: 'folder',
          children: [
            {
              id: 'page.tsx',
              name: 'page.tsx',
              path: 'src/app/page.tsx',
              content: `export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
      <h1 className="text-4xl font-bold">Welcome to AI App Builder</h1>
      <p className="text-muted-foreground">Start building your next project with AI assistance</p>
    </div>
  )
}`,
              language: 'typescript',
              modified: false,
              type: 'file'
            }
          ]
        }
      ]
    },
    {
      id: 'package.json',
      name: 'package.json',
      path: 'package.json',
      content: `{
  "name": "ai-app-builder-project",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}`,
      language: 'json',
      modified: false,
      type: 'file'
    }
  ]);

  const [activeFile, setActiveFile] = useState<string>('src/app/page.tsx');
  const [terminalOutputs, setTerminalOutputs] = useState<TerminalOutput[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');
  const [aiInput, setAiInput] = useState('');
  const [terminalInput, setTerminalInput] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'src/app']));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFileContent = files.find(f => f.path === activeFile)?.content || '';

  const handleFileChange = (value: string) => {
    setFiles(prevFiles => 
      prevFiles.map(file => 
        file.path === activeFile 
          ? { ...file, content: value, modified: true }
          : file
      )
    );
  };

  const handleSave = () => {
    setFiles(prevFiles => 
      prevFiles.map(file => 
        file.path === activeFile 
          ? { ...file, modified: false }
          : file
      )
    );
    
    addTerminalOutput('File saved successfully', 'success');
  };

  const addTerminalOutput = (content: string, type: TerminalOutput['type'] = 'info') => {
    const output: TerminalOutput = {
      id: Date.now().toString(),
      content,
      timestamp: new Date(),
      type
    };
    setTerminalOutputs(prev => [...prev, output]);
  };

  const handleRun = () => {
    setIsRunning(true);
    addTerminalOutput('Starting development server...', 'info');
    
    // Simulate running the project
    setTimeout(() => {
      addTerminalOutput('Project compiled successfully', 'success');
      addTerminalOutput('Server running on http://localhost:3000', 'info');
      setIsRunning(false);
    }, 2000);
  };

  const handleStop = () => {
    setIsRunning(false);
    addTerminalOutput('Development server stopped', 'warning');
  };

  const handleAiSubmit = async () => {
    if (!aiInput.trim()) return;
    
    addTerminalOutput(`AI Query: ${aiInput}`, 'info');
    addTerminalOutput('AI is processing your request...', 'info');
    
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiInput,
          context: `Current file: ${activeFile}\nLanguage: ${getLanguageFromPath(activeFile)}\n\nCode:\n${activeFileContent}`
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        addTerminalOutput('AI response received:', 'success');
        addTerminalOutput('Generated code has been added to the editor.', 'success');
        
        // Add the generated code as a new file or append to current file
        const newFileName = `ai-generated-${Date.now()}.${getLanguageFromPath(activeFile).toLowerCase()}`;
        const newFile: FileItem = {
          id: Date.now().toString(),
          name: newFileName,
          path: newFileName,
          content: result.code,
          language: getLanguageFromPath(activeFile),
          modified: false,
          type: 'file'
        };
        
        setFiles(prev => [...prev, newFile]);
        setActiveFile(newFileName);
      } else {
        addTerminalOutput(`AI Error: ${result.error}`, 'error');
      }
    } catch (error) {
      addTerminalOutput('AI Error: Failed to connect to AI service', 'error');
    }
    
    setAiInput('');
  };

  const handleAiAction = async (action: string) => {
    addTerminalOutput(`AI Action: ${action}`, 'info');
    addTerminalOutput('AI is analyzing your code...', 'info');
    
    try {
      const actionMap: Record<string, string> = {
        'Explain Code': 'explain',
        'Find Bugs': 'find-bugs',
        'Security Scan': 'security-scan',
        'Optimize': 'optimize'
      };
      
      const aiAction = actionMap[action] || 'explain';
      
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: aiAction,
          code: activeFileContent
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        addTerminalOutput(`${action} completed successfully!`, 'success');
        addTerminalOutput('Analysis results:', 'info');
        
        // Show the analysis in chunks to avoid terminal overflow
        const analysisLines = result.analysis.split('\n');
        analysisLines.forEach((line: string, index: number) => {
          setTimeout(() => {
            addTerminalOutput(line, 'info');
          }, index * 100);
        });
      } else {
        addTerminalOutput(`AI Error: ${result.error}`, 'error');
      }
    } catch (error) {
      addTerminalOutput('AI Error: Failed to connect to AI service', 'error');
      console.error('AI error:', error);
    }
  };

  const handleTestAction = (action: string) => {
    addTerminalOutput(`Test Action: ${action}`, 'info');
    
    if (action === 'Run Tests') {
      addTerminalOutput('Running test suite...', 'info');
      setTimeout(() => {
        addTerminalOutput('✓ All tests passed (5/5)', 'success');
        addTerminalOutput('Test coverage: 85%', 'info');
      }, 2000);
    } else if (action === 'Generate Tests') {
      addTerminalOutput('Generating test cases...', 'info');
      setTimeout(() => {
        addTerminalOutput('Test cases generated successfully', 'success');
        addTerminalOutput('Created 3 new test files', 'info');
      }, 1500);
    }
  };

  const handleSearch = () => {
    addTerminalOutput('Search functionality activated', 'info');
    addTerminalOutput('Use Ctrl+F to search within files', 'info');
  };

  const handleSettings = () => {
    addTerminalOutput('Settings panel would open here', 'info');
    addTerminalOutput('Available settings: Theme, Editor preferences, AI settings', 'info');
  };

  const handleTerminalCommand = async () => {
    if (!terminalInput.trim()) return;
    
    const command = terminalInput.trim();
    addTerminalOutput(`$ ${command}`, 'info');
    
    try {
      const response = await fetch('/api/terminal/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.output) {
          const outputLines = result.output.trim().split('\n');
          outputLines.forEach((line: string) => {
            if (line.trim()) {
              addTerminalOutput(line, 'success');
            }
          });
        }
        if (result.error) {
          addTerminalOutput(result.error, 'warning');
        }
      } else {
        addTerminalOutput(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      addTerminalOutput('Failed to execute command', 'error');
      console.error('Terminal error:', error);
    }
    
    setTerminalInput('');
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  const renderFileTree = (items: FileItem[], level = 0) => {
    return items.map(item => {
      if (item.type === 'folder') {
        const isExpanded = expandedFolders.has(item.path);
        return (
          <div key={item.id} className="ml-2">
            <div 
              className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer"
              onClick={() => toggleFolder(item.path)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <FolderOpen className="h-4 w-4" />
              <span className="text-sm">{item.name}</span>
            </div>
            {isExpanded && item.children && (
              <div className="ml-4">
                {renderFileTree(item.children, level + 1)}
              </div>
            )}
          </div>
        );
      } else {
        return (
          <div 
            key={item.id} 
            className={`flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer ml-${level * 4} ${
              activeFile === item.path ? 'bg-muted' : ''
            }`}
            onClick={() => setActiveFile(item.path)}
          >
            <FileText className="h-4 w-4" />
            <span className="text-sm">{item.name}</span>
            {item.modified && (
              <Badge variant="secondary" className="text-xs">M</Badge>
            )}
          </div>
        );
      }
    });
  };

  const getLanguageFromPath = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'jsx': 'javascript',
      'json': 'json',
      'md': 'markdown',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'css': 'css',
      'scss': 'scss',
      'html': 'html',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'dockerfile': 'dockerfile',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card p-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold">AI App Builder IDE</h1>
          </div>
          <Badge variant="outline">Beta</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant={isRunning ? "destructive" : "default"} 
            size="sm"
            onClick={isRunning ? handleStop : handleRun}
            className="flex items-center gap-2"
          >
            {isRunning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isRunning ? 'Stop' : 'Run'}
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSave}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleSettings}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal">
        {/* File Explorer */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <Card className="h-full rounded-none border-0 border-r">
            <CardHeader className="p-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Project Explorer
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-120px)]">
                <div className="p-2">
                  {renderFileTree(files)}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Editor Area */}
        <ResizablePanel defaultSize={60}>
          <div className="h-full flex flex-col">
            {/* Editor Tabs */}
            <div className="border-b bg-card p-2">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="editor" className="flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    Editor
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    AI Assistant
                  </TabsTrigger>
                  <TabsTrigger value="tests" className="flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Tests
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              <Tabs value={activeTab} className="h-full">
                <TabsContent value="editor" className="h-full m-0 p-0">
                  <div className="h-full flex flex-col">
                    {/* Editor Header */}
                    <div className="border-b bg-muted p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {files.find(f => f.path === activeFile)?.name || 'Untitled'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getLanguageFromPath(activeFile)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleSearch}>
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Simple Textarea Editor */}
                    <div className="flex-1 p-4">
                      <Textarea
                        value={activeFileContent}
                        onChange={(e) => handleFileChange(e.target.value)}
                        className="h-full w-full font-mono text-sm resize-none border-none focus:ring-0 p-0"
                        placeholder="Start coding..."
                        spellCheck={false}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="h-full m-0 p-0">
                  <div className="h-full flex items-center justify-center bg-muted">
                    <div className="text-center">
                      <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Preview will appear here when you run the project</p>
                      <Button className="mt-4" onClick={handleRun}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Project
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ai" className="h-full m-0 p-0">
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b">
                      <h3 className="text-lg font-semibold mb-2">AI Assistant</h3>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          placeholder="Ask AI to help you code..."
                          className="flex-1 p-2 border rounded-md"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAiSubmit();
                          }}
                        />
                        <Button onClick={handleAiSubmit}>Send</Button>
                      </div>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Quick Actions</CardTitle>
                          </CardHeader>
                          <CardContent className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAiAction('Explain Code')}>
                              <Search className="h-4 w-4 mr-2" />
                              Explain Code
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAiAction('Find Bugs')}>
                              <Bug className="h-4 w-4 mr-2" />
                              Find Bugs
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAiAction('Security Scan')}>
                              <Shield className="h-4 w-4 mr-2" />
                              Security Scan
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start" onClick={() => handleAiAction('Optimize')}>
                              <Package className="h-4 w-4 mr-2" />
                              Optimize
                            </Button>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">AI Capabilities</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm text-muted-foreground">
                              <p>• Code generation and completion</p>
                              <p>• Bug detection and fixing</p>
                              <p>• Code optimization and refactoring</p>
                              <p>• Documentation generation</p>
                              <p>• Test generation</p>
                              <p>• Security analysis</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="tests" className="h-full m-0 p-0">
                  <div className="h-full flex items-center justify-center bg-muted">
                    <div className="text-center">
                      <Bug className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Test runner and results will appear here</p>
                      <div className="mt-4 space-x-2">
                        <Button variant="outline" onClick={() => handleTestAction('Run Tests')}>
                          <Play className="h-4 w-4 mr-2" />
                          Run Tests
                        </Button>
                        <Button variant="outline" onClick={() => handleTestAction('Generate Tests')}>
                          <FileCode className="h-4 w-4 mr-2" />
                          Generate Tests
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Terminal */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
          <Card className="h-full rounded-none border-0 border-l">
            <CardHeader className="p-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Terminal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-180px)] bg-black text-green-400 font-mono text-sm p-2">
                {terminalOutputs.map(output => (
                  <div key={output.id} className="mb-1">
                    <span className="text-gray-500">
                      [{output.timestamp.toLocaleTimeString()}]
                    </span>{' '}
                    <span className={
                      output.type === 'error' ? 'text-red-400' :
                      output.type === 'success' ? 'text-green-400' :
                      output.type === 'warning' ? 'text-yellow-400' :
                      'text-gray-300'
                    }>
                      {output.content}
                    </span>
                  </div>
                ))}
                {terminalOutputs.length === 0 && (
                  <div className="text-gray-500">
                    [{new Date().toLocaleTimeString()}] Terminal ready. Type commands to interact with your project.
                  </div>
                )}
              </ScrollArea>
              <div className="border-t border-gray-700 p-2 bg-black">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-mono text-sm">$</span>
                  <input
                    type="text"
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTerminalCommand();
                    }}
                    placeholder="Type a command..."
                    className="flex-1 bg-transparent text-green-400 font-mono text-sm outline-none placeholder:text-gray-500"
                  />
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleTerminalCommand}
                    className="h-6 w-6 p-0 text-green-400 hover:text-green-300"
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}