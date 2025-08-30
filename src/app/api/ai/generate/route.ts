import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: NextRequest) {
  try {
    const { prompt, context } = await request.json()
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const zai = await ZAI.create()
    
    // Build the AI prompt with context
    let fullPrompt = prompt
    if (context) {
      fullPrompt = `Context: ${context}\n\nTask: ${prompt}`
    }

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert AI coding assistant. Generate clean, functional code based on the user\'s instructions. Provide only the code output without explanations unless specifically asked for them.'
        },
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    })

    const generatedCode = completion.choices[0]?.message?.content || ''

    return NextResponse.json({
      success: true,
      code: generatedCode.trim()
    })

  } catch (error) {
    console.error('AI generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate code' },
      { status: 500 }
    )
  }
}