import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('auctions')
export class Auction {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'product_id', type: 'integer', nullable: true })
  product_id: number | null;

  @Index()
  @Column({ name: 'artisan_id', type: 'integer' })
  artisan_id: number;

  @Column({ name: 'title', type: 'text' })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'images', type: 'text', nullable: true })
  images: string | null;

  @Column({ name: 'starting_price', type: 'real' })
  starting_price: number;

  @Column({ name: 'starting_bid', type: 'real', nullable: true })
  starting_bid: number | null;

  @Column({ name: 'reserve_price', type: 'real', nullable: true })
  reserve_price: number | null;

  @Column({ name: 'current_highest_bid', type: 'real', nullable: true })
  current_highest_bid: number | null;

  @Column({ name: 'bid_increment', type: 'real', default: 1 })
  bid_increment: number;

  @Column({ name: 'winner_id', type: 'integer', nullable: true })
  winner_id: number | null;

  @Column({ name: 'highest_bidder_id', type: 'integer', nullable: true })
  highest_bidder_id: number | null;

  @Column({ name: 'start_time', type: 'datetime' })
  start_time: Date;

  @Column({ name: 'end_time', type: 'datetime' })
  end_time: Date;

  @Column({ name: 'status', type: 'text', default: 'pending' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @ManyToOne('Product', 'auctions', { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: any | null;

  @ManyToOne('User', 'auctions', { nullable: false })
  @JoinColumn({ name: 'artisan_id' })
  artisan: any;

  @ManyToOne('User', { nullable: true })
  @JoinColumn({ name: 'winner_id' })
  winner: any | null;

  @ManyToOne('User', { nullable: true })
  @JoinColumn({ name: 'highest_bidder_id' })
  highestBidder: any | null;

  @OneToMany('Bid', 'auction')
  bids: any[];
}
