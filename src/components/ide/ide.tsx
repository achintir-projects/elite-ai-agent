"use client"
import { useState, useCallback } from "react"
import { FileExplorer } from "./file-explorer"
import { Editor } from "./editor"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { useToast } from "@/hooks/use-toast"

interface FileItem {
  id: string
  name: string
  content: string
  language?: string
  modified?: boolean
}

export function IDE() {
  const [files, setFiles] = useState<FileItem[]>([
    {
      id: "1",
      name: "index.ts",
      content: `// Welcome to the Z.ai IDE!
// This is a sample TypeScript file.

function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));`,
      language: "TypeScript",
      modified: false
    },
    {
      id: "2", 
      name: "README.md",
      content: `# Z.ai IDE

A modern, web-based integrated development environment built with Next.js and TypeScript.

## Features

- File explorer with create, rename, delete operations
- Syntax highlighting
- Real-time editing
- File download capabilities
- Responsive design

## Getting Started

1. Create a new file using the "New File" button
2. Click on any file to open it in the editor
3. Edit the content and save your changes
4. Use the context menu to rename, delete, or download files

Happy coding! 🚀`,
      language: "Markdown",
      modified: false
    }
  ])
  
  const [activeFile, setActiveFile] = useState<string | null>("1")
  const { toast } = useToast()

  const handleFileSelect = useCallback((fileId: string) => {
    setActiveFile(fileId)
  }, [])

  const handleFileCreate = useCallback((name: string, content: string) => {
    const newFile: FileItem = {
      id: Date.now().toString(),
      name,
      content,
      language: name.split('.').pop()?.toUpperCase() || "Text",
      modified: false
    }
    
    setFiles(prev => [...prev, newFile])
    setActiveFile(newFile.id)
  }, [])

  const handleFileDelete = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId))
    if (activeFile === fileId) {
      setActiveFile(files.length > 1 ? files[0].id : null)
    }
  }, [activeFile, files])

  const handleFileRename = useCallback((fileId: string, newName: string) => {
    setFiles(prev => 
      prev.map(file => 
        file.id === fileId 
          ? { 
              ...file, 
              name: newName,
              language: newName.split('.').pop()?.toUpperCase() || "Text"
            }
          : file
      )
    )
  }, [])

  const handleFileUpdate = useCallback((fileId: string, content: string) => {
    setFiles(prev => 
      prev.map(file => 
        file.id === fileId 
          ? { ...file, content, modified: true }
          : file
      )
    )
  }, [])

  const handleFileSave = useCallback((fileId: string) => {
    setFiles(prev => 
      prev.map(file => 
        file.id === fileId 
          ? { ...file, modified: false }
          : file
      )
    )
  }, [])

  const activeFileData = files.find(file => file.id === activeFile) || null

  return (
    <div className="h-screen bg-background">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <FileExplorer
            files={files}
            activeFile={activeFile}
            onFileSelect={handleFileSelect}
            onFileCreate={handleFileCreate}
            onFileDelete={handleFileDelete}
            onFileRename={handleFileRename}
          />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={75}>
          <Editor
            file={activeFileData}
            onFileUpdate={handleFileUpdate}
            onFileSave={handleFileSave}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}