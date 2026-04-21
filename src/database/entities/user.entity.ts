import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  Index,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'text' })
  name: string;

  @Index()
  @Column({ name: 'email', type: 'text', unique: true })
  email: string;

  @Column({ name: 'password', type: 'text' })
  password: string;

  @Column({ name: 'role', type: 'text', default: 'customer' })
  role: string;

  @Column({ name: 'status', type: 'text', default: 'active' })
  status: string;

  @Column({ name: 'phone', type: 'text', nullable: true })
  phone: string | null;

  @Column({ name: 'avatar', type: 'text', nullable: true })
  avatar: string | null;

  @Column({ name: 'shipping_address', type: 'text', nullable: true })
  shipping_address: string | null;

  @Column({ name: 'building', type: 'text', nullable: true })
  building: string | null;

  @Column({ name: 'city', type: 'text', nullable: true })
  city: string | null;

  @Column({ name: 'postal_code', type: 'text', nullable: true })
  postal_code: string | null;

  @Column({ name: 'country', type: 'text', default: 'Bahrain' })
  country: string;

  @Column({ name: 'dob', type: 'text', nullable: true })
  dob: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @OneToOne('ArtisanProfile', 'user')
  artisanProfile: any;

  @OneToMany('CartItem', 'user')
  cartItems: any[];

  @OneToMany('Order', 'user')
  orders: any[];

  @OneToMany('Bid', 'user')
  bids: any[];

  @OneToMany('Review', 'user')
  reviews: any[];

  @OneToMany('Notification', 'user')
  notifications: any[];

  @OneToMany('Message', 'sender')
  sentMessages: any[];

  @OneToMany('Message', 'receiver')
  receivedMessages: any[];

  @OneToMany('Wishlist', 'user')
  wishlistItems: any[];
}
