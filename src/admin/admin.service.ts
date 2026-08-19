import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Admin } from './entities/admin.entity';
import { JwtService } from '@nestjs/jwt';
import { AdminLoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private readonly AuthRepository: Repository<Admin>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}
  async create(createAdminDto: CreateAdminDto) {
    const { email } = createAdminDto;
    const userExist = await this.AuthRepository.findOne({
      where: { email },
    });
    if (userExist) {
      throw new BadRequestException('Email Already in use');
    }
    const newUser = this.AuthRepository.create(createAdminDto);
    await this.AuthRepository.save(newUser);
    const token = await this.generateJWT(newUser);

    // Return user data and token
    return {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      isAdmin: newUser.isAdmin,
      token,
    };
  }
  async login(loginDto: AdminLoginDto) {
    const { email, password } = loginDto;
    const user = await this.AuthRepository.findOne({ where: { email } });
    if (!user) throw new NotFoundException('Invalid email ');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid password');

    const token = await this.generateJWT(user);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.isAdmin,
      token,
    };
  }
  async promoteStaffToAdmin(staffId: number, userId: string) {
    const admin = await this.AuthRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!admin || admin.isAdmin !== true)
      throw new NotFoundException('Only Admins are Authorized to perform task');

    const staff = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff not found');

    // check if already admin
    const exists = await this.AuthRepository.findOne({
      where: { email: staff.email },
    });
    if (exists) throw new BadRequestException('This staff is already an admin');

    // Create new Admin using staff details
    const newAdmin = this.AuthRepository.create({
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      password: staff.password, // staff password (already hashed)
      staff: staff,
    });

    await this.AuthRepository.save(newAdmin);

    const token = this.generateJWT(newAdmin);
    return {
      id: newAdmin.id,
      email: newAdmin.email,
      firstName: newAdmin.firstName,
      lastName: newAdmin.lastName,
      isAdmin: newAdmin.isAdmin,
      token,
    };
  }
  async generateJWT(user: Admin) {
    const payload = {
      userId: user.id,
      email: user.email,
    };
    return this.jwtService.sign(payload, { expiresIn: '365d' });
  }
  //
  async findAllwithoutpagination(): Promise<Admin[]> {
    return this.AuthRepository.find({
      order: { id: 'DESC' },
    });
  }
  async findAll(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<{ data: Admin[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    const where = search
      ? [
          { firstName: ILike(`%${search}%`) },
          { lastName: ILike(`%${search}%`) },
          { email: ILike(`%${search}%`) },
        ]
      : {};

    const [data, total] = await this.AuthRepository.findAndCount({
      where,
      order: { id: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }
  async findOne(id: number): Promise<Admin> {
    const admin = await this.AuthRepository.findOne({
      where: { id },
    });
    if (!admin) throw new NotFoundException(`Admin with ID ${id} not found`);
    return admin;
  }

  update(id: number, updateAdminDto: UpdateAdminDto) {
    return `This action updates a #${id} admin`;
  }

  async remove(id: number, userId: string): Promise<{ message: string }> {
    const admin = await this.AuthRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!admin || admin.isAdmin !== true)
      throw new NotFoundException('Only Admins are Authorized to perform task');

    const department = await this.findOne(id);
    await this.AuthRepository.remove(department);

    return {
      message: `Admin with id ${id} has been successfully deleted`,
    };
  }

  async toggleCeoStatus(staffId: number, adminId: number) {
    const admin = await this.AuthRepository.findOne({
      where: { id: adminId },
    });
    if (!admin || !admin.isAdmin) {
      throw new UnauthorizedException(
        'Only admins are authorized to toggle CEO status',
      );
    }

    const staff = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff not found');

    const ceoEmail = this.configService.get<string>('ceoEmail');
    if (!ceoEmail) {
      throw new BadRequestException(
        'CEO_EMAIL is not configured in environment variables',
      );
    }

    if (staff.email !== ceoEmail) {
      throw new BadRequestException(
        `Only the staff with email ${ceoEmail} can be promoted to CEO`,
      );
    }

    // Toggle CEO status
    staff.isCeo = !staff.isCeo;

    if (staff.isCeo) {
      // If we are making this staff CEO, ensure all others are demoted
      await this.staffRepo.update({ isCeo: true }, { isCeo: false });
    }

    await this.staffRepo.save(staff);

    return {
      message: `Staff ${staff.firstName} ${staff.lastName} CEO status updated to ${staff.isCeo}`,
      isCeo: staff.isCeo,
    };
  }
}
