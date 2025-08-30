import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json()
    
    if (!command) {
      return NextResponse.json(
        { error: 'Command is required' },
        { status: 400 }
      )
    }

    // Basic security check - prevent dangerous commands
    const dangerousCommands = ['rm -rf', 'sudo', 'chmod 777', '>', '>>', '|']
    const isDangerous = dangerousCommands.some(dangerous => command.includes(dangerous))
    
    if (isDangerous) {
      return NextResponse.json(
        { error: 'Command not allowed for security reasons' },
        { status: 403 }
      )
    }

    // Execute the command with timeout
    try {
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 10000,
        cwd: process.cwd()
      })

      return NextResponse.json({
        success: true,
        output: stdout,
        error: stderr
      })

    } catch (execError: any) {
      return NextResponse.json({
        success: false,
        error: execError.message || 'Command execution failed'
      })
    }

  } catch (error) {
    console.error('Terminal execution error:', error)
    return NextResponse.json(
      { error: 'Failed to execute command' },
      { status: 500 }
    )
  }
}