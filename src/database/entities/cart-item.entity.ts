import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'integer', nullable: true })
  user_id: number | null;

  @Index()
  @Column({ name: 'session_id', type: 'text', nullable: true })
  session_id: string | null;

  @Index()
  @Column({ name: 'product_id', type: 'integer' })
  product_id: number;

  @Column({ name: 'quantity', type: 'integer', default: 1 })
  quantity: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @ManyToOne('User', 'cartItems', { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: any | null;

  @ManyToOne('Product', 'cartItems', { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: any;
}
