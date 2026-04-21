import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'sender_id', type: 'integer' })
  sender_id: number;

  @Index()
  @Column({ name: 'receiver_id', type: 'integer' })
  receiver_id: number;

  @Column({ name: 'subject', type: 'text', nullable: true })
  subject: string | null;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  parent_id: number | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  image_url: string | null;

  @Column({ name: 'is_read', type: 'integer', default: 0 })
  is_read: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @ManyToOne('User', 'sentMessages', { nullable: false })
  @JoinColumn({ name: 'sender_id' })
  sender: any;

  @ManyToOne('User', 'receivedMessages', { nullable: false })
  @JoinColumn({ name: 'receiver_id' })
  receiver: any;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Message | null;
}
