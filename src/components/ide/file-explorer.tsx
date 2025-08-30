"use client"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Folder, 
  FileText, 
  Plus, 
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit2,
  MoreVertical,
  Download
} from "lucide-react"
import { useState, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface FileItem {
  id: string
  name: string
  content: string
  language?: string
  modified?: boolean
}

interface FileExplorerProps {
  files: FileItem[]
  activeFile: string | null
  onFileSelect: (fileId: string) => void
  onFileCreate?: (name: string, content: string) => void
  onFileDelete?: (fileId: string) => void
  onFileRename?: (fileId: string, newName: string) => void
}

export function FileExplorer({ 
  files, 
  activeFile, 
  onFileSelect, 
  onFileCreate,
  onFileDelete,
  onFileRename 
}: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [renamingFile, setRenamingFile] = useState<string | null>(null)
  const [newFileName, setNewFileName] = useState("")
  const [isCreatingFile, setIsCreatingFile] = useState(false)
  const [newFileInput, setNewFileInput] = useState("")
  const { toast } = useToast()

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }, [])

  const handleRename = useCallback((fileId: string) => {
    if (!newFileName.trim()) {
      toast({
        title: "Error",
        description: "File name cannot be empty",
        variant: "destructive"
      })
      return
    }
    
    onFileRename?.(fileId, newFileName.trim())
    setRenamingFile(null)
    setNewFileName("")
    
    toast({
      title: "Success",
      description: "File renamed successfully"
    })
  }, [newFileName, onFileRename, toast])

  const handleDelete = useCallback((fileId: string) => {
    onFileDelete?.(fileId)
    toast({
      title: "Success",
      description: "File deleted successfully"
    })
  }, [onFileDelete, toast])

  const handleCreateFile = useCallback(() => {
    if (!newFileInput.trim()) {
      toast({
        title: "Error",
        description: "File name cannot be empty",
        variant: "destructive"
      })
      return
    }
    
    onFileCreate?.(newFileInput.trim(), "")
    setIsCreatingFile(false)
    setNewFileInput("")
    
    toast({
      title: "Success",
      description: "File created successfully"
    })
  }, [newFileInput, onFileCreate, toast])

  const startRenaming = useCallback((fileId: string, currentName: string) => {
    setRenamingFile(fileId)
    setNewFileName(currentName)
  }, [])

  return (
    <div className="w-64 bg-background border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold text-sm">Explorer</h2>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => setIsCreatingFile(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          New File
        </Button>
        
        {isCreatingFile && (
          <div className="mt-2 flex gap-2">
            <Input
              placeholder="File name"
              value={newFileInput}
              onChange={(e) => setNewFileInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFile()
                if (e.key === "Escape") setIsCreatingFile(false)
              }}
              className="h-8"
              autoFocus
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCreatingFile(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Root folder */}
          <div className="mb-2">
            <div
              className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
              onClick={() => toggleFolder("root")}
            >
              {expandedFolders.has("root") ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <Folder className="w-4 h-4" />
              <span className="text-sm">Project Files</span>
            </div>
            
            {expandedFolders.has("root") && (
              <div className="ml-6">
                {files.map((file) => (
                  <div key={file.id} className="relative group">
                    <div
                      className={`flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer ${
                        activeFile === file.id ? "bg-accent" : ""
                      }`}
                      onClick={() => onFileSelect(file.id)}
                    >
                      <FileText className="w-4 h-4" />
                      
                      {renamingFile === file.id ? (
                        <div className="flex gap-2 flex-1">
                          <Input
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(file.id)
                              if (e.key === "Escape") {
                                setRenamingFile(null)
                                setNewFileName("")
                              }
                            }}
                            className="h-6 text-xs"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleRename(file.id)}
                          >
                            ✓
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm flex-1 truncate">
                            {file.name}
                            {file.modified && (
                              <span className="text-yellow-500 ml-1">•</span>
                            )}
                          </span>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                              >
                                <MoreVertical className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startRenaming(file.id, file.name)
                                }}
                              >
                                <Edit2 className="w-4 h-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(file.id)
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Handle download functionality
                                  const blob = new Blob([file.content], { type: "text/plain" })
                                  const url = URL.createObjectURL(blob)
                                  const a = document.createElement("a")
                                  a.href = url
                                  a.download = file.name
                                  a.click()
                                  URL.revokeObjectURL(url)
                                }}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}