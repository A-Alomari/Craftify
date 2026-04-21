import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('artisan_profiles')
export class ArtisanProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'integer', unique: true })
  user_id: number;

  @Column({ name: 'shop_name', type: 'text' })
  shop_name: string;

  @Column({ name: 'bio', type: 'text', nullable: true })
  bio: string | null;

  @Column({ name: 'logo', type: 'text', nullable: true })
  logo: string | null;

  @Column({ name: 'banner', type: 'text', nullable: true })
  banner: string | null;

  @Column({ name: 'profile_image', type: 'text', nullable: true })
  profile_image: string | null;

  @Column({ name: 'banner_image', type: 'text', nullable: true })
  banner_image: string | null;

  @Column({ name: 'location', type: 'text', nullable: true })
  location: string | null;

  @Column({ name: 'phone', type: 'text', nullable: true })
  phone: string | null;

  @Column({ name: 'instagram', type: 'text', nullable: true })
  instagram: string | null;

  @Column({ name: 'facebook', type: 'text', nullable: true })
  facebook: string | null;

  @Column({ name: 'twitter', type: 'text', nullable: true })
  twitter: string | null;

  @Column({ name: 'website', type: 'text', nullable: true })
  website: string | null;

  @Column({ name: 'bank_name', type: 'text', nullable: true })
  bank_name: string | null;

  @Column({ name: 'bank_account', type: 'text', nullable: true })
  bank_account: string | null;

  @Column({ name: 'shipping_methods', type: 'text', nullable: true })
  shipping_methods: string | null;

  @Column({ name: 'return_policy', type: 'text', nullable: true })
  return_policy: string | null;

  @Column({ name: 'is_approved', type: 'integer', default: 0 })
  is_approved: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @OneToOne('User', 'artisanProfile')
  @JoinColumn({ name: 'user_id' })
  user: any;

  @OneToMany('Product', 'artisan')
  products: any[];
}
