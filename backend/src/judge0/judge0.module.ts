import { Module } from '@nestjs/common';
import { Judge0Service } from './judge0.service.js';

// Internal integration only: exposes no HTTP controller.
@Module({
  providers: [Judge0Service],
  exports: [Judge0Service],
})
export class Judge0Module {}
