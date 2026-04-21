import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('password_resets')
export class PasswordReset {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  user_id: number;

  @Index()
  @Column({ name: 'token', type: 'text' })
  token: string;

  @Column({ name: 'used', type: 'integer', default: 0 })
  used: number;

  /**
   * Stored as an ISO-8601 string (e.g. "2025-01-01T12:00:00.000Z").
   * Kept as text so that the AuthService can do lexicographic ISO comparisons
   * identically to the legacy Express code.
   */
  @Column({ name: 'expires_at', type: 'text' })
  expires_at: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @ManyToOne('User', { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: any;
}
