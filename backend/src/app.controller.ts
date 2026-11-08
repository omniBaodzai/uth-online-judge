import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { DocumentControllerOperations } from './swagger/document-controller-operations.decorator.js';

@ApiTags('System')
@DocumentControllerOperations()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return this.appService.getHealth();
  }
}
