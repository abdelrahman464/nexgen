import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CommerceAccessService } from './commerce-access.service';
import { CommerceService } from './commerce.service';
import { CheckoutCouponDto, CreateUserSubscriptionDto, PurchaseForUserDto } from './dto/commerce.dto';
import { PaymentProviderService } from './payment-provider.service';

@Controller('userSubscriptions')
export class UserSubscriptionsController {
  constructor(private readonly commerce: CommerceService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getMine(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.commerce.getMySubscriptions(query, user);
  }

  @Post(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  addSubscriber(@Param('id', ParseObjectIdPipe) id: string, @Body() body: CreateUserSubscriptionDto) {
    return this.commerce.addSubscriber(id, body);
  }
}

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly access: CommerceAccessService,
    private readonly payments: PaymentProviderService,
  ) {}

  @Put('purchaseForUser')
  purchaseForUser(@Body() body: PurchaseForUserDto) {
    return this.commerce.purchaseForUser(body);
  }

  @Put('createUnPaidOrder/:id')
  @UseGuards(JwtAuthGuard)
  createUnPaidOrder(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.commerce.createUnPaidOrder(id, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getOrders(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.commerce.getOrders(query, user);
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  statistics(@Query() query: Record<string, any>) {
    return this.commerce.getOrderStatistics(query);
  }

  @Get('byMonth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  byMonth(@Query() query: Record<string, any>) {
    return this.commerce.getOrdersByMonth(query);
  }

  @Post('plisio/payment/callback')
  plisioPaymentCallback(@Query() query: Record<string, any>, @Res() res: Response) {
    return this.payments.handlePlisioCallback(query, res);
  }

  @Put('plisio/courseCheckout/:courseId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  async plisioCourse(@Param('courseId', ParseObjectIdPipe) courseId: string, @Body() body: CheckoutCouponDto, @CurrentUser() user: any) {
    await this.access.assertNoRecentPaidOrder(user._id);
    return this.payments.createPlisioCheckout({ type: 'course', id: courseId, paramName: 'courseId' }, user, body);
  }

  @Put('plisio/coursePackageCheckout/:coursePackageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  async plisioCoursePackage(@Param('coursePackageId', ParseObjectIdPipe) coursePackageId: string, @Body() body: CheckoutCouponDto, @CurrentUser() user: any) {
    await this.access.assertNoRecentPaidOrder(user._id);
    return this.payments.createPlisioCheckout({ type: 'coursePackage', id: coursePackageId, paramName: 'coursePackageId' }, user, body);
  }

  @Put('plisio/packageCheckout/:packageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  async plisioPackage(@Param('packageId', ParseObjectIdPipe) packageId: string, @Body() body: CheckoutCouponDto, @CurrentUser() user: any) {
    await this.access.assertNoRecentPaidOrder(user._id);
    return this.payments.createPlisioCheckout({ type: 'package', id: packageId, paramName: 'packageId' }, user, body);
  }

  @Post('webhook/plisio')
  plisioWebhook(@Req() req: Request, @Res() res: Response) {
    return this.payments.handlePlisioWebhook(req, res);
  }

  @Get('lahza/payment/callback')
  lahzaPaymentCallback(@Query() query: Record<string, any>, @Req() req: Request, @Res() res: Response) {
    return this.payments.handleLahzaCallback(query, req.locale, res);
  }

  @Put('lahza/courseCheckout/:courseId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  async lahzaCourse(@Param('courseId', ParseObjectIdPipe) courseId: string, @Body() body: CheckoutCouponDto, @CurrentUser() user: any) {
    await this.access.assertNoRecentPaidOrder(user._id);
    return this.payments.createLahzaCheckout({ type: 'course', id: courseId, paramName: 'courseId' }, user, body);
  }

  @Put('lahza/coursePackageCheckout/:coursePackageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  async lahzaCoursePackage(@Param('coursePackageId', ParseObjectIdPipe) coursePackageId: string, @Body() body: CheckoutCouponDto, @CurrentUser() user: any) {
    await this.access.assertNoRecentPaidOrder(user._id);
    return this.payments.createLahzaCheckout({ type: 'coursePackage', id: coursePackageId, paramName: 'coursePackageId' }, user, body);
  }

  @Put('lahza/packageCheckout/:packageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  async lahzaPackage(@Param('packageId', ParseObjectIdPipe) packageId: string, @Body() body: CheckoutCouponDto, @CurrentUser() user: any) {
    await this.access.assertNoRecentPaidOrder(user._id);
    return this.payments.createLahzaCheckout({ type: 'package', id: packageId, paramName: 'packageId' }, user, body);
  }

  @Post('webhook/lahza')
  lahzaWebhook(@Req() req: Request, @Res() res: Response) {
    return this.payments.handleLahzaWebhook(req, res);
  }

  @Put('stripe/courseCheckout/:courseId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  async stripeCourse(@Param('courseId', ParseObjectIdPipe) courseId: string, @Body() body: CheckoutCouponDto, @CurrentUser() user: any, @Req() req: Request) {
    await this.access.assertNoRecentPaidOrder(user._id);
    return this.payments.createStripeCheckout({ type: 'course', id: courseId, paramName: 'courseId' }, user, body, req.locale);
  }

  @Put('stripe/coursePackageCheckout/:coursePackageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  async stripeCoursePackage(@Param('coursePackageId', ParseObjectIdPipe) coursePackageId: string, @Body() body: CheckoutCouponDto, @CurrentUser() user: any, @Req() req: Request) {
    await this.access.assertNoRecentPaidOrder(user._id);
    return this.payments.createStripeCheckout({ type: 'coursePackage', id: coursePackageId, paramName: 'coursePackageId' }, user, body, req.locale);
  }

  @Put('stripe/packageCheckout/:packageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  async stripePackage(@Param('packageId', ParseObjectIdPipe) packageId: string, @Body() body: CheckoutCouponDto, @CurrentUser() user: any, @Req() req: Request) {
    await this.access.assertNoRecentPaidOrder(user._id);
    return this.payments.createStripeCheckout({ type: 'package', id: packageId, paramName: 'packageId' }, user, body, req.locale);
  }

  @Post('webhook/stripe')
  stripeWebhook(@Req() req: Request, @Res() res: Response) {
    return this.payments.handleStripeWebhook(req, res);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  getOrder(@Param('id', ParseObjectIdPipe) id: string) {
    return this.commerce.getOrder(id);
  }
}
