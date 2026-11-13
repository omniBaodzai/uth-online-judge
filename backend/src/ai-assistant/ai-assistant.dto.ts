import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AiAssistantScope } from './ai-assistant.types.js';

export const AI_ASSISTANT_MAX_MESSAGE_LENGTH = 3_000;
export const AI_ASSISTANT_MAX_CONTEXT_TOKEN_LENGTH = 2_048;

export class AiAssistantChatRequestDto {
  @ApiProperty({
    description: 'Câu hỏi về cách sử dụng UTH Online Judge.',
    maxLength: AI_ASSISTANT_MAX_MESSAGE_LENGTH,
    example: 'Làm sao để nộp bài trên UTH Online Judge?',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(AI_ASSISTANT_MAX_MESSAGE_LENGTH)
  message!: string;

  @ApiPropertyOptional({
    description:
      'Signed, short-lived context for follow-up questions; contains no conversation text.',
    maxLength: AI_ASSISTANT_MAX_CONTEXT_TOKEN_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(AI_ASSISTANT_MAX_CONTEXT_TOKEN_LENGTH)
  conversationContext?: string;
}

export class AiAssistantChatResponseDto {
  @ApiProperty({ enum: AiAssistantScope })
  @IsEnum(AiAssistantScope)
  scope!: AiAssistantScope;

  @ApiProperty({ description: 'Trả lời hoặc thông báo từ chối/làm rõ.' })
  @IsString()
  answer!: string;

  @ApiPropertyOptional({
    description: 'Short-lived signed context for a relevant follow-up question.',
    maxLength: AI_ASSISTANT_MAX_CONTEXT_TOKEN_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(AI_ASSISTANT_MAX_CONTEXT_TOKEN_LENGTH)
  conversationContext?: string;
}
