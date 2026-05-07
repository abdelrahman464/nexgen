import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import {
  CreateInvoiceDto,
  CreateMarketerRatingDto,
  InvoiceQueryDto,
  ItemAnalyticsQueryDto,
  ModifyInvitationKeysDto,
  ModifyProfitableItemsDto,
  PaymentDetailsDto,
  ProfitCalculationDto,
  StartMarketingDto,
  UpdateInvoiceStatusDto,
} from './dto/marketing-revenue.dto';
import { InstructorProfitsService } from './instructor-profits.service';
import { MarketingAnalyticsService } from './marketing-analytics.service';
import { MarketingInvoicesService } from './marketing-invoices.service';
import { MarketingService } from './marketing.service';
import { RatingLeaderboardService } from './rating-leaderboard.service';

@Controller('marketingAnalytics')
export class MarketingAnalyticsController {
  constructor(private readonly analytics: MarketingAnalyticsService) {}

  @Get('total')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getMyTotal(@CurrentUser() user: any, @Query() query: Record<string, any>, @Req() req: Request) {
    return this.analytics.getTotalSalesAnalytics(undefined, user, query, req.locale);
  }

  @Get('total/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getTotal(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any, @Query() query: Record<string, any>, @Req() req: Request) {
    return this.analytics.getTotalSalesAnalytics(id, user, query, req.locale);
  }

  @Get('item')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getItem(@Query() query: ItemAnalyticsQueryDto, @CurrentUser() user: any) {
    return this.analytics.getItemAnalytics(undefined, query, user);
  }

  @Get('item/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getItemById(@Param('id', ParseObjectIdPipe) id: string, @Query() query: ItemAnalyticsQueryDto, @CurrentUser() user: any) {
    return this.analytics.getItemAnalytics(id, query, user);
  }

  @Get('getInvitationsAnalytics/:marketerId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getInvitations(@Param('marketerId', ParseObjectIdPipe) marketerId: string, @Query() query: Record<string, any>) {
    return this.analytics.getInvitationsAnalytics(marketerId, query);
  }

  @Put('incrementSignUpClicks/:invitationKey')
  incrementSignUpClicks(@Param('invitationKey') invitationKey: string) {
    return this.analytics.incrementSignUpClicks(invitationKey);
  }
}

@Controller('marketing')
@UseGuards(JwtAuthGuard)
export class MarketingController {
  constructor(
    private readonly marketing: MarketingService,
    private readonly instructorProfits: InstructorProfitsService,
  ) {}

  @Get('getInstructorAnalytics')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  getMyInstructorAnalytics(@CurrentUser() user: any) {
    return this.instructorProfits.getInstructorAnalytics(undefined, user);
  }

  @Get('getInstructorAnalytics/:id')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  getInstructorAnalytics(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.instructorProfits.getInstructorAnalytics(id, user);
  }

  @Get('getMarketLog/:id')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  getMarketLog(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.marketing.getMarketLog(id, user, req.locale);
  }

  @Get('getMyMarketLog')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  getMyMarketLog(@CurrentUser() user: any, @Req() req: Request) {
    return this.marketing.getMarketLog(undefined, user, req.locale);
  }

  @Get('getMarketerChildren/:id')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  getMarketerChildren(@Param('id', ParseObjectIdPipe) id: string, @Req() req: Request) {
    return this.marketing.getMarketerChildren(id, req.locale);
  }

  @Patch('updateMarketLogProfitsCalculationMethod/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateProfitCalculation(@Param('id', ParseObjectIdPipe) id: string, @Body() body: ProfitCalculationDto) {
    return this.marketing.updateProfitCalculation(id, body);
  }

  @Put('modifyInvitationKeys/:id')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  modifyInvitationKeys(@Param('id', ParseObjectIdPipe) id: string, @Body() body: ModifyInvitationKeysDto) {
    return this.marketing.modifyInvitationKeys(id, body);
  }

  @Put('setPaymentDetails/:id')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  setPaymentDetails(@Param('id', ParseObjectIdPipe) id: string, @Body() body: PaymentDetailsDto, @Query('type') type?: string) {
    return this.marketing.setPaymentDetails(id, body, type);
  }

  @Put('calculateProfitsManual')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  calculateProfitsManual(@Body('details') details: Record<string, any>) {
    return this.marketing.calculateProfitsManual(details);
  }

  @Put('withdrawMoney/:id')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  createInvoice(@Param('id', ParseObjectIdPipe) id: string, @Body() body: CreateInvoiceDto, @Query('type') type?: string) {
    return this.marketing.createInvoice(id, body, type);
  }

  @Put('modifyProfitableItems/:id')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  modifyProfitableItems(@Param('id', ParseObjectIdPipe) id: string, @Body() body: ModifyProfitableItemsDto) {
    return this.marketing.modifyProfitableItems(id, body);
  }

  @Put('startMarketing/:userId')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  startMarketing(@Param('userId', ParseObjectIdPipe) userId: string, @Body() body: StartMarketingDto, @CurrentUser() user: any) {
    return this.marketing.startMarketing(userId, body, user);
  }

  @Get('getProfitableItemsByType')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  getProfitableItemsByType(@CurrentUser() user: any, @Query('type') type: string, @Req() req: Request) {
    return this.marketing.getProfitableItemsByType(user, type, req.locale);
  }
}

@Controller('instructorProfits')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('user', 'admin')
export class InstructorProfitsController {
  constructor(private readonly instructorProfits: InstructorProfitsService) {}

  @Get('courseAnalytics/:itemId')
  getCourseAnalytics(@Param('itemId', ParseObjectIdPipe) itemId: string, @Query() query: Record<string, any>) {
    return this.instructorProfits.getCourseAnalytics(itemId, query);
  }

  @Get('total')
  getMyTotal(@CurrentUser() user: any, @Query() query: Record<string, any>, @Req() req: Request) {
    return this.instructorProfits.getTotalSalesAnalytics(undefined, user, query, req.locale);
  }

  @Get('total/:id')
  getTotal(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any, @Query() query: Record<string, any>, @Req() req: Request) {
    return this.instructorProfits.getTotalSalesAnalytics(id, user, query, req.locale);
  }

  @Get('instructorAnalytics')
  getMine(@CurrentUser() user: any) {
    return this.instructorProfits.getInstructorAnalytics(undefined, user);
  }

  @Get('instructorAnalytics/:id')
  getOne(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.instructorProfits.getInstructorAnalytics(id, user);
  }

  @Get('salesAnalytics')
  getMySales(@CurrentUser() user: any) {
    return this.instructorProfits.getSalesAnalytics(undefined, user);
  }

  @Get('salesAnalytics/:id')
  getSales(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.instructorProfits.getSalesAnalytics(id, user);
  }
}

@Controller('marketingInvoices')
@UseGuards(JwtAuthGuard)
export class MarketingInvoicesController {
  constructor(private readonly invoices: MarketingInvoicesService) {}

  @Get()
  getDefault(@Query() query: InvoiceQueryDto, @Req() req: Request) {
    return this.invoices.getAllRequestedInvoices('pending', query, req.locale);
  }

  @Get('one/:id')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  getOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.invoices.getRequestedInvoice(id);
  }

  @Put('updateInvoiceStatus/:id')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin')
  updateStatus(@Param('id', ParseObjectIdPipe) id: string, @Query() query: InvoiceQueryDto, @Body() body: UpdateInvoiceStatusDto) {
    return this.invoices.updateInvoiceStatus(id, query, body);
  }

  @Get(':status')
  getByStatus(@Param('status') status: string, @Query() query: InvoiceQueryDto, @Req() req: Request) {
    return this.invoices.getAllRequestedInvoices(status, query, req.locale);
  }
}

@Controller('marketerRating')
export class MarketerRatingController {
  constructor(private readonly rating: RatingLeaderboardService) {}

  @Get()
  getAll(@Query() query: Record<string, any>) {
    return this.rating.getRatings(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  create(@Body() body: CreateMarketerRatingDto, @CurrentUser() user: any) {
    return this.rating.createRating(body, user);
  }

  @Get(':id')
  getOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.rating.getRating(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.rating.deleteRating(id);
  }
}

@Controller('leaderBoard')
export class LeaderBoardController {
  constructor(private readonly rating: RatingLeaderboardService) {}

  @Get()
  getLeaderBoard() {
    return this.rating.getLeaderBoard();
  }
}
