import { Logger, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { AI_PROVIDER, ProviderError, type AIProvider } from './ai-provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';

/**
 * AI module — architecture §4.
 *
 * Owns the provider abstraction and the adapters. Every LLM, vision and
 * embedding call in the system goes through here; nothing else imports a
 * vendor SDK.
 *
 * The binding is config-driven so that closing D-09 is a change to
 * `LLM_PROVIDER`, not a code change in seventeen call sites.
 */

/**
 * Stands in when no provider is configured.
 *
 * D-09/D-10/D-11 are open, so a fresh clone has no `LLM_PROVIDER`. The API
 * must still boot — every non-AI endpoint has to stay developable — but a
 * call that reaches a provider must fail loudly rather than return something
 * plausible. Silent degradation here would be indistinguishable from a
 * working tutor during development and catastrophic in front of a student.
 */
class UnconfiguredProvider implements AIProvider {
  readonly name = 'unconfigured';
  readonly capabilities = { chat: false, streaming: false, vision: false, embedding: false };

  private fail(): never {
    throw new ProviderError(
      'No AI provider is configured. LLM_PROVIDER is unset, and D-09 is still ' +
        'open — run `pnpm --filter @ai-tutor/eval eval:chat` to decide it, then ' +
        'set LLM_PROVIDER and LLM_API_KEY.',
      'upstream',
    );
  }

  chat(): never {
    this.fail();
  }
  streamChat(): never {
    this.fail();
  }
  analyzeImage(): never {
    this.fail();
  }
  embed(): never {
    this.fail();
  }
}

const aiProviderFactory: Provider = {
  provide: AI_PROVIDER,
  inject: [ConfigService, AnthropicProvider],
  useFactory: (configService: ConfigService, anthropic: AnthropicProvider): AIProvider => {
    const logger = new Logger('AiModule');
    const { provider } = configService.getOrThrow<AppConfig>('app').ai;

    switch (provider) {
      case 'anthropic':
        logger.log(`AI provider: ${anthropic.name}`);
        return anthropic;

      default:
        logger.warn(
          'No AI provider configured (LLM_PROVIDER is unset). AI endpoints will ' +
            'fail with a clear error until D-09 is closed.',
        );
        return new UnconfiguredProvider();
    }
  },
};

@Module({
  providers: [AnthropicProvider, aiProviderFactory],
  exports: [AI_PROVIDER],
})
export class AiModule {}
