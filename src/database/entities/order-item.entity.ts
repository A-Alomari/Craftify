import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'order_id', type: 'integer' })
  order_id: number;

  @Index()
  @Column({ name: 'product_id', type: 'integer' })
  product_id: number;

  @Column({ name: 'artisan_id', type: 'integer', nullable: true })
  artisan_id: number | null;

  @Column({ name: 'quantity', type: 'integer' })
  quantity: number;

  @Column({ name: 'unit_price', type: 'real' })
  unit_price: number;

  @Column({ name: 'total_price', type: 'real' })
  total_price: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @ManyToOne('Order', 'items', { nullable: false })
  @JoinColumn({ name: 'order_id' })
  order: any;

  @ManyToOne('Product', 'orderItems', { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @ManyToOne('User', { nullable: true })
  @JoinColumn({ name: 'artisan_id' })
  artisan: any | null;
}
