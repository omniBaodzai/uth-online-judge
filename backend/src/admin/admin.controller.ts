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
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PROBLEM_PDF_MAX_BYTES } from '../problems/problem-pdf-storage.service.js';
import { AddJudge0LanguageDto } from './dto/admin-language.dto.js';
import { AdminProblemDto, AdminProblemStatusDto } from './dto/admin-problem.dto.js';
import { AdminSolutionDto } from './dto/admin-solution.dto.js';
import { AdminTestCaseCollectionDto } from './dto/admin-test-case.dto.js';
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

  @Post('problems/:id/pdf')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('pdf', { limits: { fileSize: PROBLEM_PDF_MAX_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  uploadPdf(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.admin.uploadStatementPdf(id, file?.buffer);
  }

  @Delete('problems/:id/pdf')
  removePdf(@Param('id') id: string) {
    return this.admin.removeStatementPdf(id);
  }

  @Get('problems/:id/solution')
  getSolution(@Param('id') id: string) {
    return this.admin.getSolution(id);
  }

  @Put('problems/:id/solution')
  saveSolution(
    @Param('id') id: string,
    @Body() input: AdminSolutionDto,
    @Req() request: AdminRequest,
  ) {
    return this.admin.saveSolution(id, request.user.id, input);
  }

  @Get('problems/:id/test-cases')
  listTestCases(@Param('id') id: string) {
    return this.admin.listTestCases(id);
  }

  @Put('problems/:id/test-cases')
  replaceTestCases(
    @Param('id') problemId: string,
    @Body() input: AdminTestCaseCollectionDto,
  ) {
    return this.admin.replaceTestCases(problemId, input.expectedRevision, input.testCases);
  }
}
