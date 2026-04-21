import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('newsletter_subscriptions')
export class NewsletterSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'email', type: 'text', unique: true })
  email: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
