import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { CeoMessagingCenter } from './ceo-messaging-center.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

@Entity('ceo_messaging_center_reads')
@Unique(['ceoMessage', 'staff'])
export class CeoMessagingCenterRead {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CeoMessagingCenter, { onDelete: 'CASCADE' })
  ceoMessage: CeoMessagingCenter;

  @ManyToOne(() => Staff, { onDelete: 'CASCADE' })
  staff: Staff;

  @CreateDateColumn()
  readAt: Date;
}
