import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class HeroContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;


  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column()
  tag: string;

  @Column()
  link: string;

  @Column()
  imageUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
