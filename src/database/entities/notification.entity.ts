import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  user_id: number;

  @Column({ name: 'type', type: 'text', default: 'general' })
  type: string;

  @Column({ name: 'title', type: 'text' })
  title: string;

  @Column({ name: 'message', type: 'text' })
  message: string;

  @Column({ name: 'link', type: 'text', nullable: true })
  link: string | null;

  @Column({ name: 'is_read', type: 'integer', default: 0 })
  is_read: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @ManyToOne('User', 'notifications', { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: any;
}
