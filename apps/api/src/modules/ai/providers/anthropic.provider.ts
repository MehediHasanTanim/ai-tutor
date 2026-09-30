/**
 * Claude adapter — the first implementation of the architecture §4 interface.
 *
 * First, not chosen: D-09 is still open and is decided by `packages/eval`
 * against measured Bangla quality. This exists so the rest of the system can
 * be built against a real provider while that measurement happens, and so
 * that swapping in the winner is a second file rather than a refactor.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import configuration from '../../../config/configuration';
import {
  ProviderError,
  type AIProvider,
  type ChatChunk,
  type ChatRequest,
  type EmbeddingRequest,
  type EmbeddingResult,
  type ImageAnalysis,
  type ImageAnalysisRequest,
  type ProviderResult,
  type ProviderUsage,
} from '../ai-provider.interface';

@Injectable()
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';

  /**
   * No embedding support. Anthropic does not serve an embedding model, so
   * D-11 will be a different vendor — which is exactly why the interface
   * declares capabilities rather than assuming one provider does everything.
   */
  readonly capabilities = { chat: true, streaming: true, vision: true, embedding: false };

  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic;
  private readonly chatModel: string;

  constructor(
    @Inject(configuration.KEY)
    config: ConfigType<typeof configuration>,
  ) {
    // A bare client resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an
    // `ant auth login` profile — an unset env var does not mean no credentials.
    this.client = config.ai.apiKey ? new Anthropic({ apiKey: config.ai.apiKey }) : new Anthropic();

    this.chatModel = config.ai.chatModel || 'claude-opus-5-5';
  }

  async chat(request: ChatRequest): Promise<ProviderResult<string>> {
    const startedAt = Date.now();

    try {
      // Streams even for the buffered path: a long answer on a non-streaming
      // request can exceed the SDK's HTTP timeout.
      const stream = this.client.messages.stream({
        model: this.chatModel,
        max_tokens: request.maxTokens ?? 4096,
        output_config: { effort: request.effort ?? 'medium' },
        system: request.systemPrompt,
        messages: request.messages,
      });

      const message = await stream.finalMessage();

      if (message.stop_reason === 'refusal') {
        throw new ProviderError(
          `declined: ${message.stop_details?.category ?? 'unspecified'}`,
          'refusal',
        );
      }

      return {
        data: textOf(message),
        usage: this.usageFrom(message, startedAt),
      };
    } catch (error) {
      throw this.translate(error);
    }
  }

  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const startedAt = Date.now();

    const stream = this.client.messages.stream({
      model: this.chatModel,
      max_tokens: request.maxTokens ?? 4096,
      output_config: { effort: request.effort ?? 'medium' },
      system: request.systemPrompt,
      messages: request.messages,
    });

    try {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta' &&
          event.delta.text
        ) {
          yield { delta: event.delta.text, done: false };
        }
      }

      const message = await stream.finalMessage();

      if (message.stop_reason === 'refusal') {
        throw new ProviderError(
          `declined: ${message.stop_details?.category ?? 'unspecified'}`,
          'refusal',
        );
      }

      // Usage arrives only at the end, which is why it is optional on the
      // chunk type and present exactly once.
      yield { delta: '', usage: this.usageFrom(message, startedAt), done: true };
    } catch (error) {
      throw this.translate(error);
    }
  }

  async analyzeImage(request: ImageAnalysisRequest): Promise<ProviderResult<ImageAnalysis>> {
    const startedAt = Date.now();

    try {
      const stream = this.client.messages.stream({
        model: this.chatModel,
        max_tokens: request.maxTokens ?? 2048,
        output_config: { effort: 'high' },
        system: request.systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: request.mediaType,
                  data: request.imageBase64,
                },
              },
              { type: 'text', text: request.userPrompt ?? 'Read the question in this image.' },
            ],
          },
        ],
      });

      const message = await stream.finalMessage();

      if (message.stop_reason === 'refusal') {
        throw new ProviderError('image request declined', 'refusal');
      }

      return {
        data: parseImageAnalysis(textOf(message)),
        usage: this.usageFrom(message, startedAt),
      };
    } catch (error) {
      throw this.translate(error);
    }
  }

  async embed(_request: EmbeddingRequest): Promise<ProviderResult<EmbeddingResult>> {
    throw new ProviderError(
      'Anthropic does not serve an embedding model. D-11 requires a separate ' +
        'provider — register one and route embedding calls to it.',
      'upstream',
    );
  }

  private usageFrom(message: Anthropic.Message, startedAt: number): ProviderUsage {
    return {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cachedInputTokens: message.usage.cache_read_input_tokens ?? 0,
      model: message.model,
      latencyMs: Date.now() - startedAt,
    };
  }

  /** Maps SDK errors onto the kinds the caller can act on. */
  private translate(error: unknown): ProviderError {
    if (error instanceof ProviderError) return error;

    if (error instanceof Anthropic.RateLimitError) {
      return new ProviderError('provider rate limit', 'rate_limit', { cause: error });
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return new ProviderError('provider timed out', 'timeout', { cause: error });
    }
    if (error instanceof Anthropic.APIError) {
      return new ProviderError(`provider error ${error.status}`, 'upstream', { cause: error });
    }

    this.logger.error(`Unrecognised provider failure: ${String(error)}`);
    return new ProviderError('provider failed', 'upstream', { cause: error });
  }
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

/**
 * Parses the vision contract from `packages/prompts`.
 *
 * Tolerant of a code fence because models add them despite the instruction
 * not to, and a fence is not a reason to fail a student's photo. Anything
 * else malformed is a genuine contract violation and throws.
 */
export function parseImageAnalysis(raw: string): ImageAnalysis {
  const text = raw.trim();

  const candidates = [
    text,
    /```(?:json)?\s*([\s\S]*?)```/u.exec(text)?.[1]?.trim(),
    sliceOutermostObject(text),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<ImageAnalysis>;
      if (typeof parsed.extracted_question !== 'string') continue;

      return {
        extracted_question: parsed.extracted_question,
        detected_language: parsed.detected_language ?? 'mixed',
        // A missing confidence is treated as unusable rather than perfect —
        // the failure has to land on the safe side of the retake threshold.
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        retake_reason: parsed.retake_reason ?? null,
        subject: parsed.subject ?? null,
        chapter_guess: parsed.chapter_guess ?? null,
        other_questions_visible: parsed.other_questions_visible ?? [],
        answer: parsed.answer ?? null,
      };
    } catch {
      continue;
    }
  }

  throw new ProviderError('vision response was not valid JSON', 'invalid_response');
}

function sliceOutermostObject(text: string): string | undefined {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start !== -1 && end > start ? text.slice(start, end + 1) : undefined;
}
