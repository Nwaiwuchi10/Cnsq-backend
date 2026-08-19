import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Ticket } from './ticket.entity';

@Entity('ticket_activities')
export class TicketActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string; // The comment text or activity description

  @Column({ default: false })
  isSystemActivity: boolean; // True if it's a system generated message (e.g. "Status changed to Completed")

  @Column('simple-array', { nullable: true })
  attachments: string[];

  // Relationships
  @ManyToOne(() => Ticket, (ticket) => ticket.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticketId' })
  ticket: Ticket;

  @Column({ nullable: true })
  ticketId: string;

  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({ name: 'authorId' })
  author: Staff;

  @Column({ nullable: true })
  authorId: number;

  @CreateDateColumn()
  createdAt: Date;
}
