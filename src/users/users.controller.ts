import { Body, Controller, Delete, Get, Next, Param, Post, Put, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { TokenService } from '../common/services/token.service';
import { createMulterOptions } from '../common/upload/upload.helper';
import { ChangePasswordDto, CreateUserDto, UpdateMeDto, UpdateUserDto } from './dto/user.dto';
import { UserUploadFiles, UsersService } from './users.service';
import { EmailMarketingQueryDto } from '../marketing-revenue/dto/marketing-revenue.dto';

const userUploadFields = [
  { name: 'profileImg', maxCount: 1 },
  { name: 'coverImg', maxCount: 1 },
  { name: 'signatureImage', maxCount: 1 },
  { name: 'idDocuments', maxCount: 3 },
];

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  @Get('Instructors')
  getInstructors(@Query() query: Record<string, any>) {
    return this.users.listInstructors(query);
  }

  @Get('adminAndInstructor')
  @UseGuards(JwtAuthGuard)
  getAdminsAndInstructors(@Query() query: Record<string, any>) {
    return this.users.listAdminsAndInstructors(query);
  }

  @Put('active/:id')
  @UseGuards(JwtAuthGuard)
  active(@Param('id', ParseObjectIdPipe) id: string) {
    return this.users.setActive(id, true);
  }

  @Delete('active/:id')
  @UseGuards(JwtAuthGuard)
  unActive(@Param('id', ParseObjectIdPipe) id: string) {
    return this.users.setActive(id, false);
  }

  @Put('changeMyPassword')
  @UseGuards(JwtAuthGuard)
  changeMyPassword(@Body() body: ChangePasswordDto, @CurrentUser() user: any) {
    return this.users.updateLoggedUserPassword(user, body, (id) => this.tokens.generateToken(id));
  }

  @Put('changeMyData')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor(userUploadFields, createMulterOptions()))
  changeMyData(
    @Body() body: UpdateMeDto,
    @CurrentUser() user: any,
    @UploadedFiles() files?: UserUploadFiles,
  ) {
    return this.users.updateLoggedUserData(user, body, files);
  }

  @Put('moveOneUserToAnother')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  moveOneUserToAnother(@Body() body: Record<string, any>) {
    return this.users.moveOneUserToAnother(body);
  }

  @Post('email-marketing/query')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  queryEmailMarketingUsers(@Body() body: EmailMarketingQueryDto) {
    return this.users.queryEmailMarketingUsers(body);
  }

  @Get('instructors/withBelongings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAllInstructorsWithBelongings() {
    return this.users.getAllInstructorsWithBelongings();
  }

  @Put('push-notifications')
  passPushNotificationsToLegacy(@Next() next: Function) {
    return next();
  }

  @Put('changePassword/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  changeUserPassword(@Param('id', ParseObjectIdPipe) id: string, @Body() body: ChangePasswordDto) {
    return this.users.changeUserPassword(id, body);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAll(@Query() query: Record<string, any>) {
    return this.users.listUsers(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileFieldsInterceptor(userUploadFields, createMulterOptions()))
  create(@Body() body: CreateUserDto, @UploadedFiles() files?: UserUploadFiles) {
    return this.users.createUser(body, files);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getOne(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.users.getUser(id, user);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileFieldsInterceptor(userUploadFields, createMulterOptions()))
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateUserDto, @UploadedFiles() files?: UserUploadFiles) {
    return this.users.updateUser(id, body, files);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.users.deleteUser(id);
  }
}
