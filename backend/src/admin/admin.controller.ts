import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AddJudge0LanguageDto } from './dto/admin-language.dto.js';
import { AdminProblemDto, AdminProblemStatusDto } from './dto/admin-problem.dto.js';
import { AdminTestCaseDto } from './dto/admin-test-case.dto.js';
import { ListAdminProblemsQueryDto } from './dto/list-admin-problems-query.dto.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminService } from './admin.service.js';

type AdminRequest = Request & { user: { id: string; role: 'ADMIN' } };

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('catalog')
  async catalog() {
    const [tags, languages] = await Promise.all([
      this.admin.listTags(),
      this.admin.listLanguages(),
    ]);
    return { tags, languages };
  }

  @Get('languages/judge0')
  judge0Languages() {
    return this.admin.listJudge0Languages();
  }

  @Post('languages')
  @HttpCode(HttpStatus.OK)
  addLanguage(@Body() dto: AddJudge0LanguageDto) {
    return this.admin.addJudge0Language(dto.judge0LanguageId);
  }

  @Get('problems')
  listProblems(@Query() query: ListAdminProblemsQueryDto) {
    return this.admin.listProblems(query);
  }

  @Post('problems')
  createProblem(@Body() input: AdminProblemDto, @Req() request: AdminRequest) {
    return this.admin.saveProblem(input, request.user.id);
  }

  @Get('problems/:id')
  getProblem(@Param('id') id: string) {
    return this.admin.getProblem(id);
  }

  @Patch('problems/:id')
  updateProblem(
    @Param('id') id: string,
    @Body() input: AdminProblemDto,
    @Req() request: AdminRequest,
  ) {
    return this.admin.saveProblem(input, request.user.id, id);
  }

  @Patch('problems/:id/status')
  setProblemStatus(@Param('id') id: string, @Body() input: AdminProblemStatusDto) {
    return this.admin.setProblemStatus(id, input.status);
  }

  @Delete('problems/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProblem(@Param('id') id: string) {
    return this.admin.deleteProblem(id);
  }

  @Get('problems/:id/test-cases')
  listTestCases(@Param('id') id: string) {
    return this.admin.listTestCases(id);
  }

  @Post('problems/:id/test-cases')
  createTestCase(@Param('id') problemId: string, @Body() input: AdminTestCaseDto) {
    return this.admin.saveTestCase(problemId, input);
  }

  @Post('problems/:id/test-cases/distribute-points')
  distributeTestCasePoints(@Param('id') problemId: string) {
    return this.admin.distributeTestCasePoints(problemId);
  }

  @Patch('problems/:id/test-cases/:caseId')
  updateTestCase(
    @Param('id') problemId: string,
    @Param('caseId') caseId: string,
    @Body() input: AdminTestCaseDto,
  ) {
    return this.admin.saveTestCase(problemId, input, caseId);
  }

  @Delete('problems/:id/test-cases/:caseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTestCase(@Param('id') problemId: string, @Param('caseId') caseId: string) {
    return this.admin.deleteTestCase(problemId, caseId);
  }
}
