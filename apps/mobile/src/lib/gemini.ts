import { GEMINI_API_KEY, GEMINI_MODEL_ID } from '../config';

/**
 * Minimal Gemini REST client with function-calling support.
 *
 * No SDK — fetch is available in RN/Expo and this is the only network call in
 * the app, so a single small file beats a dependency. The only thing that
 * ever leaves the device here is what `coachTools.ts` hands it: already-
 * computed aggregates (category totals, a goal projection, a SIP verdict),
 * never a raw transaction or account number.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GenerateContentResponse {
  candidates?: Array<{
    content?: { role?: string; parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  error?: { message?: string };
}

/** One call to the API. Throws with a readable message on any failure. */
export async function generateContent(
  contents: GeminiContent[],
  systemInstruction: string,
  tools: GeminiFunctionDeclaration[],
): Promise<GeminiContent> {
  if (!GEMINI_API_KEY) {
    throw new Error('No Gemini API key configured. Set EXPO_PUBLIC_GEMINI_API_KEY in apps/mobile/.env.');
  }

  const res = await fetch(`${API_BASE}/${GEMINI_MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      ...(tools.length > 0 ? { tools: [{ function_declarations: tools }] } : {}),
    }),
  });

  const json: GenerateContentResponse = await res.json();

  if (!res.ok) {
    throw new Error(json.error?.message ?? `Gemini request failed (${res.status}).`);
  }

  const content = json.candidates?.[0]?.content;
  if (!content?.parts) {
    throw new Error('Gemini returned no content.');
  }

  return { role: 'model', parts: content.parts };
}

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Record<string, unknown>;

/**
 * Runs one user turn to completion: sends the message, and if Gemini asks to
 * call a tool, executes it locally and feeds the result back — up to a small
 * depth limit — until it returns plain text.
 *
 * Grounding, not chat: the model never invents a number, it narrates numbers
 * `toolExecutor` already computed from the on-device engine.
 */
export async function runCoachTurn(
  history: GeminiContent[],
  userText: string,
  systemInstruction: string,
  tools: GeminiFunctionDeclaration[],
  toolExecutor: ToolExecutor,
  maxToolRounds = 4,
): Promise<{ reply: string; history: GeminiContent[] }> {
  const contents: GeminiContent[] = [...history, { role: 'user', parts: [{ text: userText }] }];

  for (let round = 0; round < maxToolRounds; round++) {
    const modelTurn = await generateContent(contents, systemInstruction, tools);
    contents.push(modelTurn);

    const functionCalls = modelTurn.parts.filter(
      (p): p is { functionCall: { name: string; args: Record<string, unknown> } } => 'functionCall' in p,
    );

    if (functionCalls.length === 0) {
      const text = modelTurn.parts
        .map((p) => ('text' in p ? p.text : ''))
        .join('')
        .trim();
      return { reply: text || "I couldn't work that out — try rephrasing.", history: contents };
    }

    const responseParts: GeminiPart[] = functionCalls.map((fc) => {
      let response: Record<string, unknown>;
      try {
        response = toolExecutor(fc.functionCall.name, fc.functionCall.args ?? {});
      } catch (err) {
        response = { error: err instanceof Error ? err.message : 'Tool failed.' };
      }
      return { functionResponse: { name: fc.functionCall.name, response } };
    });

    contents.push({ role: 'user', parts: responseParts });
  }

  return {
    reply: "That took more steps than I could keep up with — try asking something more specific.",
    history: contents,
  };
}
