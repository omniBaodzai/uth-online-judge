import { Module } from '@nestjs/common';
import { ProblemsController } from './problems.controller.js';

@Module({ controllers: [ProblemsController] })
export class ProblemsModule {}
