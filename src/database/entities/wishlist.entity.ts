import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('wishlist')
@Unique(['user_id', 'product_id'])
export class Wishlist {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  user_id: number;

  @Index()
  @Column({ name: 'product_id', type: 'integer' })
  product_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @ManyToOne('User', 'wishlistItems', { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @ManyToOne('Product', 'wishlistItems', { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: any;
}
