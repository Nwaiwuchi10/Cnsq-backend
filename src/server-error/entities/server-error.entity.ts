import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('server_errors')
export class ServerError {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  stack: string;

  @Column({ nullable: true })
  path: string;

  @Column({ nullable: true })
  method: string;

  @Column({ nullable: true })
  statusCode: number;

  @Column({ nullable: true })
  staffId: number; // To track if a specific user triggered it

  @CreateDateColumn()
  timestamp: Date;
}
