import { GoogleGenAI } from '@google/genai';
import { settings } from '../config/settings.ts';
import { type JarvisMood, getJarvisSystemInstruction } from '../config/prompts.ts';
import { getGeminiToolDeclarations, executeToolCall, allTools } from '../tools/index.ts';
import type { ToolContext } from '../tools/types.ts';

export interface GenerateResult {
  text: string;
  provider: 'groq' | 'gemini' | 'nvidia' | 'offline';
  mood: JarvisMood;
  toolCallsExecuted: Array<{ name: string; args: any; result: any }>;
}

export class JarvisLLM {
  private getEffectiveProvider(): 'groq' | 'gemini' | 'nvidia' | 'offline' {
    if (settings.activeProvider === 'groq' && settings.groqApiKey) return 'groq';
    if (settings.activeProvider === 'gemini' && settings.geminiApiKey) return 'gemini';
    if (settings.activeProvider === 'nvidia' && settings.nvidiaApiKey) return 'nvidia';

    // Auto-detect
    if (settings.groqApiKey) return 'groq';
    if (settings.geminiApiKey) return 'gemini';
    if (settings.nvidiaApiKey) return 'nvidia';

    return 'offline';
  }

  isConfigured(): boolean {
    return this.getEffectiveProvider() !== 'offline';
  }

  getActiveProviderName(): string {
    return this.getEffectiveProvider();
  }

  async processTurn(
    userPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: ToolContext,
    mood: JarvisMood = 'calm'
  ): Promise<GenerateResult> {
    const provider = this.getEffectiveProvider();

    if (provider === 'offline') {
      return {
        text: "Neural processing offline. Please configure your Groq, Gemini, or NVIDIA API key in settings.",
        provider: 'offline',
        mood,
        toolCallsExecuted: [],
      };
    }

    if (provider === 'groq') {
      return await this.processWithOpenAICompatible({
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: settings.groqApiKey,
        model: 'llama-3.3-70b-versatile',
        providerName: 'groq',
        userPrompt,
        history,
        context,
        mood,
      });
    }

    if (provider === 'nvidia') {
      return await this.processWithOpenAICompatible({
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        apiKey: settings.nvidiaApiKey,
        model: 'meta/llama-3.1-70b-instruct',
        providerName: 'nvidia',
        userPrompt,
        history,
        context,
        mood,
      });
    }

    // Default: Gemini
    return await this.processWithGemini(userPrompt, history, context, mood);
  }

  // --- GEMINI HANDLER ---
  private async processWithGemini(
    userPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: ToolContext,
    mood: JarvisMood = 'calm'
  ): Promise<GenerateResult> {
    const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
    const contents: any[] = [];

    for (const h of history) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    });

    const tools = getGeminiToolDeclarations();
    const toolCallsExecuted: Array<{ name: string; args: any; result: any }> = [];

    let maxSteps = 5;
    let finalText = '';

    while (maxSteps > 0) {
      maxSteps--;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: {
            parts: [{ text: getJarvisSystemInstruction(mood) }],
          },
          tools: tools as any,
          temperature: 0.3,
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate || !candidate.content) {
        finalText = "No response received from the core model.";
        break;
      }

      const functionCalls: any[] = [];
      const textParts: string[] = [];

      for (const part of candidate.content.parts || []) {
        if ((part as any).functionCall) {
          functionCalls.push((part as any).functionCall);
        } else if (part.text) {
          textParts.push(part.text);
        }
      }

      if (functionCalls.length > 0) {
        contents.push(candidate.content);
        const functionResponses: any[] = [];
        for (const fc of functionCalls) {
          const result = await executeToolCall(fc.name, fc.args || {}, context);
          toolCallsExecuted.push({ name: fc.name, args: fc.args, result });
          functionResponses.push({
            functionResponse: {
              name: fc.name,
              response: { output: result },
            },
          });
        }
        contents.push({ role: 'user', parts: functionResponses });
      } else {
        finalText = textParts.join('\n').trim();
        break;
      }
    }

    return {
      text: finalText || "Directive completed.",
      provider: 'gemini',
      mood,
      toolCallsExecuted,
    };
  }

  // --- OPENAI-COMPATIBLE HANDLER (GROQ / NVIDIA) ---
  private async processWithOpenAICompatible(opts: {
    baseUrl: string;
    apiKey: string;
    model: string;
    providerName: 'groq' | 'nvidia';
    userPrompt: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    context: ToolContext;
    mood: JarvisMood;
  }): Promise<GenerateResult> {
    const messages: any[] = [
      { role: 'system', content: getJarvisSystemInstruction(opts.mood) },
    ];

    for (const h of opts.history) {
      messages.push({ role: h.role, content: h.content });
    }
    messages.push({ role: 'user', content: opts.userPrompt });

    // Format tools for OpenAI
    const openAiTools = allTools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: t.parameters.properties,
          required: t.parameters.required || [],
        },
      },
    }));

    const toolCallsExecuted: Array<{ name: string; args: any; result: any }> = [];
    let maxSteps = 5;
    let finalText = '';

    while (maxSteps > 0) {
      maxSteps--;

      const res = await fetch(`${opts.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          messages,
          tools: openAiTools,
          tool_choice: 'auto',
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`[${opts.providerName.toUpperCase()}] API request failed: ${res.status} ${errorText}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice || !choice.message) {
        finalText = "No response from neural provider.";
        break;
      }

      const msg = choice.message;
      messages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch {}

          const result = await executeToolCall(tc.function.name, parsedArgs, opts.context);
          toolCallsExecuted.push({
            name: tc.function.name,
            args: parsedArgs,
            result,
          });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
      } else {
        finalText = msg.content || '';
        break;
      }
    }

    return {
      text: finalText.trim() || "Directive completed.",
      provider: opts.providerName,
      mood: opts.mood,
      toolCallsExecuted,
    };
  }
}
