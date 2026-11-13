import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import {
  AI_ASSISTANT_CONFIG,
  type AiAssistantConfig,
} from './ai-assistant.config.js';
import {
  AiAssistantGuestIdentity,
  type AiAssistantPrincipal,
} from './ai-assistant.guest-identity.js';

export type AiAssistantRequest = Request & {
  user?: { id: string; role?: string };
  aiAssistantPrincipal?: AiAssistantPrincipal;
};

@Injectable()
export class AiAssistantAuthGuard extends AuthGuard('jwt') {
  constructor(
    @Inject(AI_ASSISTANT_CONFIG)
    private readonly config: AiAssistantConfig,
    private readonly guestIdentity: AiAssistantGuestIdentity,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<AiAssistantRequest>();
    const authorization = request.headers.authorization;

    if (authorization === undefined) {
      request.aiAssistantPrincipal = this.config.enabled
        ? this.guestIdentity.resolve(
            request,
            http.getResponse<Response>(),
          )
        : undefined;
      return true;
    }

    if (
      typeof authorization !== 'string' ||
      !/^Bearer\s+\S+$/i.test(authorization)
    ) {
      throw new UnauthorizedException();
    }

    const canProceed = await super.canActivate(context);
    if (!request.user || typeof request.user.id !== 'string') {
      throw new UnauthorizedException();
    }
    request.aiAssistantPrincipal = {
      kind: 'user',
      id: request.user.id,
    };
    return canProceed === true;
  }
}
