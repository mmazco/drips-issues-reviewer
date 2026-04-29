import Anthropic from '@anthropic-ai/sdk';

// Single shared client. The SDK is happy to be constructed once at module
// load — it doesn't open connections eagerly.
const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';
const DEFAULT_MAX_TOKENS = 2048;

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not set on the server');
    this.name = 'AnthropicNotConfiguredError';
  }
}

// Run a single-turn completion. Returns the assistant's text content as a
// raw string; parsing JSON / extracting fields is the caller's job because
// each route has its own response contract.
export async function runAgent(opts: {
  system: string;
  userMessage: string;
  maxTokens?: number;
  model?: string;
}): Promise<{ text: string; durationMs: number; model: string }> {
  if (!client) throw new AnthropicNotConfiguredError();

  const start = Date.now();
  const message = await client.messages.create({
    model: opts.model || DEFAULT_MODEL,
    max_tokens: opts.maxTokens || DEFAULT_MAX_TOKENS,
    system: opts.system,
    messages: [{ role: 'user', content: opts.userMessage }],
  });

  // The Messages API returns an array of content blocks. For a non-tool-use
  // call, we expect exactly one text block. Concatenate any others
  // defensively in case the model emits multiple.
  const text = message.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map(c => c.text)
    .join('\n');

  return {
    text,
    durationMs: Date.now() - start,
    model: message.model,
  };
}

// Strip markdown fences and pull out the first JSON object. Matches the
// extractor we used for the Vera proxy so behaviour is identical.
export function extractJson<T>(raw: string): T | { error: string; raw: string } {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        // fall through to error path
      }
    }
    return { error: 'Response was not valid JSON', raw };
  }
}
