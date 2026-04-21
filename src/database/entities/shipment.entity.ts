import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'order_id', type: 'integer', unique: true })
  order_id: number;

  @Index()
  @Column({ name: 'tracking_number', type: 'text', unique: true })
  tracking_number: string;

  @Column({ name: 'carrier', type: 'text', default: 'Craftify Express' })
  carrier: string;

  @Column({ name: 'status', type: 'text', default: 'pending' })
  status: string;

  @Column({ name: 'estimated_delivery', type: 'datetime', nullable: true })
  estimated_delivery: Date | null;

  @Column({ name: 'shipped_at', type: 'datetime', nullable: true })
  shipped_at: Date | null;

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  delivered_at: Date | null;

  @Column({ name: 'last_update', type: 'datetime', nullable: true })
  last_update: Date | null;

  @Column({ name: 'history', type: 'text', nullable: true })
  history: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @OneToOne('Order', 'shipment', { nullable: false })
  @JoinColumn({ name: 'order_id' })
  order: any;
}
