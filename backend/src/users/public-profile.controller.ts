import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicProfileService } from './public-profile.service.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';

@ApiTags('Users')
@DocumentControllerOperations()
@Controller('users')
export class PublicProfileController {
  constructor(private readonly profiles: PublicProfileService) {}

  @Get('id/:id')
  @ApiOperation({ summary: 'Xem hồ sơ công khai theo user ID' })
  getById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.profiles.getById(id);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Xem hồ sơ công khai theo username' })
  getByUsername(@Param('username') username: string) {
    return this.profiles.getByUsername(username);
  }
}