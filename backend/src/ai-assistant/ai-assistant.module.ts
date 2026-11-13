import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  AI_ASSISTANT_CONFIG,
  OPENROUTER_FETCH,
  loadAiAssistantConfig,
} from './ai-assistant.config.js';
import { AiAssistantAuthGuard } from './ai-assistant-auth.guard.js';
import { AiAssistantController } from './ai-assistant.controller.js';
import { AiAssistantGuestIdentity } from './ai-assistant.guest-identity.js';
import { AiAssistantOutputPolicy } from './ai-assistant.output-policy.js';
import { AiAssistantRateLimit } from './ai-assistant.rate-limit.js';
import {
  AI_ASSISTANT_REDIS,
  AiAssistantRedisLifecycle,
  createAiAssistantRedisClient,
} from './ai-assistant.redis.js';
import { AiAssistantScopePolicy } from './ai-assistant.scope-policy.js';
import { AiAssistantService } from './ai-assistant.service.js';
import { OpenRouterClient } from './openrouter.client.js';

@Module({
  imports: [AuthModule],
  controllers: [AiAssistantController],
  providers: [
    { provide: AI_ASSISTANT_CONFIG, useFactory: loadAiAssistantConfig },
    { provide: OPENROUTER_FETCH, useValue: globalThis.fetch.bind(globalThis) },
    { provide: AI_ASSISTANT_REDIS, useFactory: createAiAssistantRedisClient },
    AiAssistantRedisLifecycle,
    AiAssistantAuthGuard,
    AiAssistantGuestIdentity,
    AiAssistantRateLimit,
    AiAssistantOutputPolicy,
    AiAssistantScopePolicy,
    OpenRouterClient,
    AiAssistantService,
  ],
})
export class AiAssistantModule {}
