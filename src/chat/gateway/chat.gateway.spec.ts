jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from '../chat.service';
import { StaffRegisterService } from 'src/staff-register/staff-register.service';
import { MemberActivityService } from 'src/member-activity/member-activity.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/Message.entity';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let staffService: StaffRegisterService;
  let activityService: MemberActivityService;

  const mockConvRepo = {
    findOne: jest.fn(),
  };
  const mockMsgRepo = {};
  const mockChatService = {
    getAllConversationTotalUnreadCountForUser: jest.fn(),
  };
  const mockStaffService = {
    updateOnlineStatus: jest.fn(),
  };
  const mockActivityService = {
    logActivity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: getRepositoryToken(Conversation), useValue: mockConvRepo },
        { provide: getRepositoryToken(Message), useValue: mockMsgRepo },
        { provide: ChatService, useValue: mockChatService },
        { provide: StaffRegisterService, useValue: mockStaffService },
        { provide: MemberActivityService, useValue: mockActivityService },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    staffService = module.get<StaffRegisterService>(StaffRegisterService);
    activityService = module.get<MemberActivityService>(MemberActivityService);
    
    // Mock the server
    gateway.server = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    } as any;
    
    process.env.JWT_SECRET = 'test-secret';
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should update status and log activity on first connection', async () => {
      const userId = 1;
      const token = jwt.sign({ staffId: userId }, 'test-secret');
      const mockSocket = {
        id: 'socket-1',
        handshake: { query: { token } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(mockSocket);

      expect(staffService.updateOnlineStatus).toHaveBeenCalledWith(userId, true);
      expect(activityService.logActivity).toHaveBeenCalledWith(userId, 'Staff went Online');
      expect(gateway.server.emit).toHaveBeenCalledWith('staff:online', { userId });
    });

    it('should NOT update status on subsequent connections from same user', async () => {
      const userId = 1;
      const token = jwt.sign({ staffId: userId }, 'test-secret');
      
      const socket1 = {
        id: 'socket-1',
        handshake: { query: { token } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      const socket2 = {
        id: 'socket-2',
        handshake: { query: { token } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(socket1);
      jest.clearAllMocks();
      
      await gateway.handleConnection(socket2);

      expect(staffService.updateOnlineStatus).not.toHaveBeenCalled();
      expect(activityService.logActivity).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should update status and log activity on last disconnection', async () => {
      const userId = 1;
      const token = jwt.sign({ staffId: userId }, 'test-secret');
      const mockSocket = {
        id: 'socket-1',
        handshake: { query: { token } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      // Connect first
      await gateway.handleConnection(mockSocket);
      jest.clearAllMocks();

      // Disconnect
      await gateway.handleDisconnect(mockSocket);

      expect(staffService.updateOnlineStatus).toHaveBeenCalledWith(userId, false);
      expect(activityService.logActivity).toHaveBeenCalledWith(userId, 'Staff went Offline');
      expect(gateway.server.emit).toHaveBeenCalledWith('staff:offline', { userId });
    });

    it('should NOT update status if user still has other active sockets', async () => {
      const userId = 1;
      const token = jwt.sign({ staffId: userId }, 'test-secret');
      
      const socket1 = {
        id: 'socket-1',
        handshake: { query: { token } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      const socket2 = {
        id: 'socket-2',
        handshake: { query: { token } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(socket1);
      await gateway.handleConnection(socket2);
      jest.clearAllMocks();
      
      await gateway.handleDisconnect(socket1);

      expect(staffService.updateOnlineStatus).not.toHaveBeenCalled();
      expect(activityService.logActivity).not.toHaveBeenCalled();
    });
  });
});
