import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'product_id', type: 'integer' })
  product_id: number;

  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  user_id: number;

  @Column({ name: 'order_id', type: 'integer', nullable: true })
  order_id: number | null;

  @Column({ name: 'rating', type: 'integer' })
  rating: number;

  @Column({ name: 'title', type: 'text', nullable: true })
  title: string | null;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'helpful_count', type: 'integer', default: 0 })
  helpful_count: number;

  @Column({ name: 'is_approved', type: 'integer', default: 1 })
  is_approved: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @ManyToOne('Product', 'reviews', { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @ManyToOne('User', 'reviews', { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @ManyToOne('Order', { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: any | null;
}
