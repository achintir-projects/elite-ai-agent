import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: NextRequest) {
  try {
    const { action, code } = await request.json()
    
    if (!action || !code) {
      return NextResponse.json(
        { error: 'Action and code are required' },
        { status: 400 }
      )
    }

    const zai = await ZAI.create()
    
    let systemPrompt = ''
    let userPrompt = ''

    switch (action) {
      case 'explain':
        systemPrompt = 'You are an expert code explainer. Analyze the provided code and explain what it does in clear, concise terms.'
        userPrompt = `Please explain this code:\n\n${code}`
        break
      case 'find-bugs':
        systemPrompt = 'You are an expert bug hunter. Analyze the provided code and identify any potential bugs, security issues, or improvements needed.'
        userPrompt = `Please find bugs and issues in this code:\n\n${code}`
        break
      case 'security-scan':
        systemPrompt = 'You are a security expert. Analyze the provided code for security vulnerabilities and suggest fixes.'
        userPrompt = `Please perform a security analysis of this code:\n\n${code}`
        break
      case 'optimize':
        systemPrompt = 'You are a performance optimization expert. Analyze the provided code and suggest optimizations for better performance.'
        userPrompt = `Please optimize this code for better performance:\n\n${code}`
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.5
    })

    const analysis = completion.choices[0]?.message?.content || ''

    return NextResponse.json({
      success: true,
      action,
      analysis: analysis.trim()
    })

  } catch (error) {
    console.error('AI analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze code' },
      { status: 500 }
    )
  }
}