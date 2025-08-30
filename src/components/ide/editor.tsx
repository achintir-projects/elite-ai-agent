"use client"
import { useState, useCallback, useEffect } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Save, Copy, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface EditorProps {
  file: {
    id: string
    name: string
    content: string
    language?: string
    modified?: boolean
  } | null
  onFileUpdate?: (fileId: string, content: string) => void
  onFileSave?: (fileId: string) => void
}

export function Editor({ file, onFileUpdate, onFileSave }: EditorProps) {
  const [content, setContent] = useState("")
  const [isModified, setIsModified] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (file) {
      setContent(file.content)
      setIsModified(false)
    }
  }, [file])

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    setIsModified(true)
    onFileUpdate?.(file?.id || "", newContent)
  }, [file?.id, onFileUpdate])

  const handleSave = useCallback(() => {
    if (file) {
      onFileSave?.(file.id)
      setIsModified(false)
      toast({
        title: "Success",
        description: "File saved successfully"
      })
    }
  }, [file, onFileSave, toast])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content)
    toast({
      title: "Success",
      description: "Content copied to clipboard"
    })
  }, [content, toast])

  const handleDownload = useCallback(() => {
    if (!file) return
    
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
    
    toast({
      title: "Success",
      description: "File downloaded successfully"
    })
  }, [file, content, toast])

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/50">
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">No file selected</p>
          <p className="text-sm">Select a file from the explorer to start editing</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Editor header */}
      <div className="border-b border-border bg-background p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-sm">{file.name}</h3>
          {file.language && (
            <span className="text-xs bg-muted px-2 py-1 rounded">
              {file.language}
            </span>
          )}
          {(isModified || file.modified) && (
            <span className="text-xs text-yellow-600">Modified</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8"
          >
            <Copy className="w-4 h-4 mr-1" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="h-8"
          >
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isModified && !file.modified}
            className="h-8"
          >
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
        </div>
      </div>
      
      {/* Editor content */}
      <div className="flex-1 p-4">
        <Textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="w-full h-full resize-none font-mono text-sm leading-relaxed"
          placeholder="Start typing..."
          spellCheck={false}
        />
      </div>
    </div>
  )
}