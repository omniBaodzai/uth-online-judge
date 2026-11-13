import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { AiAssistantAuthGuard } from './ai-assistant-auth.guard.js';
import { AiAssistantChatRequestDto } from './ai-assistant.dto.js';
import { AiAssistantController } from './ai-assistant.controller.js';
import { AiAssistantService } from './ai-assistant.service.js';
import { AiAssistantRateLimitException } from './ai-assistant.rate-limit.js';
import { AiAssistantScope } from './ai-assistant.types.js';

describe('AiAssistantController', () => {
  it('uses HTTP 200 because chat does not create a resource', () => {
    const chatHandler = Object.getOwnPropertyDescriptor(
      AiAssistantController.prototype,
      'chat',
    )?.value;
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, chatHandler)).toBe(
      HttpStatus.OK,
    );
  });

  it('uses the AI-specific optional JWT guard and takes identity only from the guard', async () => {
    const chat = vi.fn().mockResolvedValue({
      scope: AiAssistantScope.UNCERTAIN,
      answer: 'Please ask about a platform feature.',
    });
    const controller = new AiAssistantController({
      chat,
    } as unknown as AiAssistantService);

    await controller.chat(
      { message: 'Where is the settings page?' },
      {
        aiAssistantPrincipal: { kind: 'user', id: 'jwt-user-id' },
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
      {
        setHeader: vi.fn(),
      } as never,
    );

    expect(
      Reflect.getMetadata(GUARDS_METADATA, AiAssistantController),
    ).toContain(AiAssistantAuthGuard);
    expect(chat).toHaveBeenCalledWith(
      { kind: 'user', id: 'jwt-user-id' },
      'Where is the settings page?',
      '127.0.0.1',
      undefined,
    );
  });

  it('sets Retry-After for a rate-limit exception and preserves its typed body', async () => {
    const rateLimitError = new AiAssistantRateLimitException(
      'RATE_LIMIT_MINUTE',
      42,
    );
    const chat = vi.fn().mockRejectedValue(rateLimitError);
    const response = { setHeader: vi.fn() };
    const controller = new AiAssistantController({
      chat,
    } as unknown as AiAssistantService);

    await expect(
      controller.chat(
        { message: 'Where can I find problems?' },
        {
          aiAssistantPrincipal: { kind: 'guest', id: 'guest-id' },
          socket: { remoteAddress: '127.0.0.1' },
        } as never,
        response as never,
      ),
    ).rejects.toBe(rateLimitError);

    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', 42);
    expect(rateLimitError.getResponse()).toMatchObject({
      code: 'RATE_LIMIT_MINUTE',
      retryAfterSeconds: 42,
    });
  });

  it('rejects empty, oversized and unknown request fields', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const metadata = {
      type: 'body' as const,
      metatype: AiAssistantChatRequestDto,
    };

    await expect(
      pipe.transform({ message: ' ' }, metadata),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      pipe.transform({ message: 'a'.repeat(3_001) }, metadata),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      pipe.transform(
        { message: 'How do I register?', extra: 'unexpected' },
        metadata,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      pipe.transform(
        { message: 'How do I register?', conversationContext: 'x'.repeat(2_049) },
        metadata,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
