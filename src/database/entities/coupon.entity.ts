import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'code', type: 'text', unique: true })
  code: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'discount_type', type: 'text' })
  discount_type: string;

  @Column({ name: 'discount_value', type: 'real' })
  discount_value: number;

  @Column({ name: 'min_purchase', type: 'real', default: 0 })
  min_purchase: number;

  @Column({ name: 'max_discount', type: 'real', nullable: true })
  max_discount: number | null;

  @Column({ name: 'usage_limit', type: 'integer', nullable: true })
  usage_limit: number | null;

  @Column({ name: 'times_used', type: 'integer', default: 0 })
  times_used: number;

  @Column({ name: 'is_active', type: 'integer', default: 1 })
  is_active: number;

  @Column({ name: 'scope', type: 'text', default: 'global' })
  scope: string;

  @Column({ name: 'artisan_id', type: 'integer', nullable: true })
  artisan_id: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  created_by: number | null;

  @Column({ name: 'valid_from', type: 'datetime', nullable: true })
  valid_from: Date | null;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  valid_until: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Legacy column aliases for backward compatibility
  @Column({ name: 'type', type: 'text', nullable: true, select: false })
  type: string | null;

  @Column({ name: 'value', type: 'real', nullable: true, select: false })
  value: number | null;

  @Column({ name: 'min_order', type: 'real', nullable: true, select: false })
  min_order: number | null;

  @Column({ name: 'max_uses', type: 'integer', nullable: true, select: false })
  max_uses: number | null;

  @Column({ name: 'used_count', type: 'integer', nullable: true, select: false })
  used_count: number | null;

  @Column({ name: 'active', type: 'integer', nullable: true, select: false })
  active: number | null;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true, select: false })
  expires_at: Date | null;

  // Relations
  @ManyToOne('User', { nullable: true })
  @JoinColumn({ name: 'artisan_id' })
  artisan: any | null;

  @ManyToOne('User', { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: any | null;
}
