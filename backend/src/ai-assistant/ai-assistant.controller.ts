import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiOperation,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';
import {
  AiAssistantAuthGuard,
  type AiAssistantRequest,
} from './ai-assistant-auth.guard.js';
import {
  AiAssistantChatRequestDto,
  AiAssistantChatResponseDto,
} from './ai-assistant.dto.js';
import { AiAssistantService } from './ai-assistant.service.js';
import { AiAssistantRateLimitException } from './ai-assistant.rate-limit.js';

@ApiTags('UTH AI Assistant')
@DocumentControllerOperations()
@Controller('ai-assistant')
@UseGuards(AiAssistantAuthGuard)
export class AiAssistantController {
  constructor(private readonly assistant: AiAssistantService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi câu hỏi cho UTH AI Assistant',
    description:
      'Không bắt buộc đăng nhập. Bearer access token hợp lệ (nếu có) được dùng làm ngữ cảnh người dùng; Bearer token không hợp lệ bị từ chối.',
    security: [{ bearer: [] }, {}],
  })
  @ApiOkResponse({ type: AiAssistantChatResponseDto })
  @ApiBadRequestResponse({ description: 'Message không hợp lệ.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer access token không hợp lệ hoặc đã hết hạn.',
  })
  @ApiTooManyRequestsResponse({
    description:
      '429 body có code riêng cho từng giới hạn và retryAfterSeconds khi tính được.',
    headers: {
      'Retry-After': {
        description: 'Số giây tối thiểu cần chờ trước khi thử lại.',
        schema: { type: 'integer' },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description:
      'Tính năng đang tắt, chưa cấu hình hoặc provider tạm thời không khả dụng.',
  })
  chat(
    @Body() input: AiAssistantChatRequestDto,
    @Req() request: AiAssistantRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AiAssistantChatResponseDto> {
    return this.assistant
      .chat(
        request.aiAssistantPrincipal,
        input.message,
        request.socket.remoteAddress,
        input.conversationContext,
      )
      .catch((error: unknown) => {
        if (error instanceof AiAssistantRateLimitException) {
          response.setHeader('Retry-After', error.retryAfterSeconds);
        }
        throw error;
      });
  }
}
