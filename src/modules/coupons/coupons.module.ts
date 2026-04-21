import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Coupon } from '../../database/entities/coupon.entity';
import { Order } from '../../database/entities/order.entity';

import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';

/**
 * CouponsModule
 *
 * Encapsulates all coupon-related concerns:
 *   - CouponsService  — business logic, validation, discount calculation
 *   - CouponsController — admin JSON API for CRUD
 *
 * Exports CouponsService so CartModule and OrdersModule can inject it
 * without re-importing the full module infrastructure.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Coupon, Order]),
  ],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
