import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Public endpoints that personalise their response: a missing or invalid token means "anonymous".
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = { id: string }>(_error: unknown, user: TUser | false): TUser {
    return (user || null) as TUser;
  }
}
