import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { AdminGuard } from '../../common/guards/roles.guard';

/**
 * CouponsController
 *
 * JSON API for coupon CRUD.  All endpoints require the AdminGuard.
 * Artisan-scoped coupon management (for artisan dashboards) is handled
 * by the ArtisanModule's controller which calls CouponsService directly.
 *
 * Routes:
 *   GET    /coupons           — list all (with optional filters)
 *   GET    /coupons/stats     — aggregate stats
 *   GET    /coupons/:id       — get by id
 *   POST   /coupons           — create
 *   PATCH  /coupons/:id       — update
 *   DELETE /coupons/:id       — delete
 *   PATCH  /coupons/:id/toggle — toggle active state
 */
@Controller('coupons')
@UseGuards(AdminGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  async findAll(
    @Query('active') active?: string,
    @Query('scope') scope?: string,
    @Query('artisan_id') artisanId?: string,
    @Query('created_by') createdBy?: string,
  ) {
    return this.couponsService.findAll({
      active:
        active !== undefined ? active === '1' || active === 'true' : undefined,
      scope,
      artisan_id: artisanId ? Number(artisanId) : undefined,
      created_by: createdBy ? Number(createdBy) : undefined,
    });
  }

  @Get('stats')
  async getStats() {
    return this.couponsService.getStats();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const coupon = await this.couponsService.findById(id);
    if (!coupon) {
      return { error: 'Coupon not found' };
    }
    return coupon;
  }

  @Post()
  async create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.couponsService.delete(id);
  }

  @Patch(':id/toggle')
  async toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.couponsService.toggleActive(id);
  }
}
