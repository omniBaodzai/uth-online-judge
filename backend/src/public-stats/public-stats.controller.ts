import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicStatsService } from './public-stats.service.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';

@ApiTags('Public')
@DocumentControllerOperations()
@Controller('public')
export class PublicStatsController {
  constructor(private readonly stats: PublicStatsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Lấy số liệu thống kê công khai của nền tảng' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        members: { type: 'integer', example: 1000 },
        problems: { type: 'integer', example: 212 },
        submissions: { type: 'integer', example: 1293 },
      },
      required: ['members', 'problems', 'submissions'],
    },
  })
  getStats() {
    return this.stats.getStats();
  }
}
