/**
 * Claude candidate adapter.
 *
 * Streams every chat call, because time-to-first-token is dimension 7 and you
 * cannot measure it from a buffered response — the whole point of the metric
 * is what the student sees before the answer finishes.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ChatResponse, VisionResponse } from '../types.js';
import type { ModelPricing } from '../metrics/cost.js';
import type { ChatRequest, EvalCandidate, VisionRequest } from './provider.js';

export interface AnthropicCandidateOptions {
  id: string;
  model: string;
  pricing: ModelPricing;
  /** Thinking depth. Sweeping this is part of choosing the candidate. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  apiKey?: string;
}

export class AnthropicCandidate implements EvalCandidate {
  readonly id: string;
  readonly model: string;
  readonly pricing: ModelPricing;
  readonly capabilities = { chat: true, vision: true, embedding: false };

  private readonly client: Anthropic;
  private readonly effort: NonNullable<AnthropicCandidateOptions['effort']>;

  constructor(options: AnthropicCandidateOptions) {
    this.id = options.id;
    this.model = options.model;
    this.pricing = options.pricing;
    this.effort = options.effort ?? 'medium';
    // A bare client resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an
    // `ant auth login` profile — so an unset env var does not mean no creds.
    this.client = options.apiKey ? new Anthropic({ apiKey: options.apiKey }) : new Anthropic();
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startedAt = Date.now();
    let firstTokenAt: number | undefined;

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      output_config: { effort: this.effort },
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userPrompt }],
    });

    stream.on('text', () => {
      firstTokenAt ??= Date.now();
    });

    const message = await stream.finalMessage();
    const finishedAt = Date.now();

    // Safety classifiers can decline; that is a result about the candidate,
    // not a crash. Always check before reading content.
    if (message.stop_reason === 'refusal') {
      return {
        text: '',
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
        latency: {
          timeToFirstTokenMs: (firstTokenAt ?? finishedAt) - startedAt,
          totalMs: finishedAt - startedAt,
        },
        error: `refusal: ${message.stop_details?.category ?? 'unspecified'}`,
      };
    }

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      text,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cachedInputTokens: message.usage.cache_read_input_tokens ?? 0,
      },
      latency: {
        // No text block at all means the answer was empty; fall back to total
        // rather than reporting a zero that would flatter the p95.
        timeToFirstTokenMs: (firstTokenAt ?? finishedAt) - startedAt,
        totalMs: finishedAt - startedAt,
      },
    };
  }

  async vision(request: VisionRequest): Promise<VisionResponse> {
    const startedAt = Date.now();
    let firstTokenAt: number | undefined;

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: request.maxTokens ?? 2048,
      output_config: { effort: this.effort },
      system: request.systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: request.mediaType, data: request.imageBase64 },
            },
            { type: 'text', text: request.userPrompt },
          ],
        },
      ],
    });

    stream.on('text', () => {
      firstTokenAt ??= Date.now();
    });

    const message = await stream.finalMessage();
    const finishedAt = Date.now();

    const latency = {
      timeToFirstTokenMs: (firstTokenAt ?? finishedAt) - startedAt,
      totalMs: finishedAt - startedAt,
    };
    const usage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };

    if (message.stop_reason === 'refusal') {
      return { extractedText: '', usage, latency, error: 'refusal' };
    }

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return { extractedText: text, usage, latency, ...parseConfidence(text) };
  }
}

/**
 * Pulls a self-reported confidence out of the vision response.
 *
 * Architecture §9 requires a confidence value so a low-confidence read
 * becomes a "retake the photo" prompt rather than a wrong answer stated
 * confidently. Whether a candidate can produce a *calibrated* one is exactly
 * what the vision suite measures.
 */
function parseConfidence(text: string): { confidence?: number } {
  const match = /"confidence"\s*:\s*(0?\.\d+|1(?:\.0+)?)/u.exec(text);
  if (!match?.[1]) return {};

  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? { confidence: value } : {};
}
