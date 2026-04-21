import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'artisan_id', type: 'integer' })
  artisan_id: number;

  @Index()
  @Column({ name: 'category_id', type: 'integer', nullable: true })
  category_id: number | null;

  @Column({ name: 'name', type: 'text' })
  name: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'price', type: 'real' })
  price: number;

  @Column({ name: 'compare_price', type: 'real', nullable: true })
  compare_price: number | null;

  @Column({ name: 'stock', type: 'integer', default: 0 })
  stock: number;

  @Column({ name: 'images', type: 'text', nullable: true })
  images: string | null;

  @Column({ name: 'tags', type: 'text', nullable: true })
  tags: string | null;

  @Column({ name: 'weight', type: 'real', nullable: true })
  weight: number | null;

  @Column({ name: 'length_cm', type: 'real', nullable: true })
  length_cm: number | null;

  @Column({ name: 'width_cm', type: 'real', nullable: true })
  width_cm: number | null;

  @Column({ name: 'height_cm', type: 'real', nullable: true })
  height_cm: number | null;

  @Column({ name: 'featured', type: 'integer', default: 0 })
  featured: number;

  @Column({ name: 'status', type: 'text', default: 'pending' })
  status: string;

  @Column({ name: 'is_active', type: 'integer', default: 1 })
  is_active: number;

  @Column({ name: 'views', type: 'integer', default: 0 })
  views: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @ManyToOne('User', 'products', { nullable: false })
  @JoinColumn({ name: 'artisan_id' })
  artisan: any;

  @ManyToOne('Category', 'products', { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: any | null;

  @OneToMany('CartItem', 'product')
  cartItems: any[];

  @OneToMany('OrderItem', 'product')
  orderItems: any[];

  @OneToMany('Review', 'product')
  reviews: any[];

  @OneToMany('Wishlist', 'product')
  wishlistItems: any[];

  @OneToMany('Auction', 'product')
  auctions: any[];
}
