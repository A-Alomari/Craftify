import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  user_id: number;

  @Column({ name: 'subtotal', type: 'real' })
  subtotal: number;

  @Column({ name: 'shipping_cost', type: 'real', default: 0 })
  shipping_cost: number;

  @Column({ name: 'discount_amount', type: 'real', default: 0 })
  discount_amount: number;

  @Column({ name: 'total_amount', type: 'real' })
  total_amount: number;

  @Column({ name: 'coupon_code', type: 'text', nullable: true })
  coupon_code: string | null;

  @Column({ name: 'status', type: 'text', default: 'pending' })
  status: string;

  @Column({ name: 'payment_method', type: 'text' })
  payment_method: string;

  @Column({ name: 'payment_status', type: 'text', default: 'pending' })
  payment_status: string;

  @Column({ name: 'transaction_ref', type: 'text', nullable: true })
  transaction_ref: string | null;

  @Column({ name: 'shipping_address', type: 'text', nullable: true })
  shipping_address: string | null;

  @Column({ name: 'shipping_building', type: 'text', nullable: true })
  shipping_building: string | null;

  @Column({ name: 'shipping_city', type: 'text', nullable: true })
  shipping_city: string | null;

  @Column({ name: 'shipping_postal', type: 'text', nullable: true })
  shipping_postal: string | null;

  @Column({ name: 'shipping_country', type: 'text', nullable: true })
  shipping_country: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @ManyToOne('User', 'orders', { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @OneToMany('OrderItem', 'order')
  items: any[];

  @OneToOne('Shipment', 'order')
  shipment: any;
}
