import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('bids')
export class Bid {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'auction_id', type: 'integer' })
  auction_id: number;

  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  user_id: number;

  @Column({ name: 'amount', type: 'real' })
  amount: number;

  @Column({ name: 'is_winning', type: 'integer', default: 0 })
  is_winning: number;

  @Column({ name: 'bid_time', type: 'datetime' })
  bid_time: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @ManyToOne('Auction', 'bids', { nullable: false })
  @JoinColumn({ name: 'auction_id' })
  auction: any;

  @ManyToOne('User', 'bids', { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: any;
}
