import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { EnqueueUppercaseDto } from './dto/enqueue-uppercase.dto.js';
import { DemoQueueService } from './demo-queue.service.js';

// Authenticated so anonymous clients cannot fill the queue.
@ApiTags('Demo queue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('demo-queue')
export class DemoQueueController {
  constructor(private readonly demoQueue: DemoQueueService) {}

  @Post('uppercase')
  @HttpCode(HttpStatus.ACCEPTED)
  enqueue(@Body() dto: EnqueueUppercaseDto) {
    return this.demoQueue.enqueueUppercase(dto.text);
  }

  @Get('jobs/:jobId')
  getStatus(@Param('jobId', new ParseUUIDPipe()) jobId: string) {
    return this.demoQueue.getStatus(jobId);
  }
}
