import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { OrganizationProblemGrantScope } from './organization-problem-grants.repository.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationProblemGrantDto {
  @ApiProperty({ enum: ['ORGANIZATION', 'GLOBAL_CONTESTS'] })
  @IsIn(['ORGANIZATION', 'GLOBAL_CONTESTS'])
  scope!: OrganizationProblemGrantScope;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Bắt buộc với scope ORGANIZATION; UUID minh họa không đại diện tổ chức có thật.',
  })
  @IsOptional()
  @IsUUID('4')
  granteeOrganizationId?: string | null;
}
