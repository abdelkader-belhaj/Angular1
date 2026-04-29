import { TestBed } from '@angular/core/testing';
import { MessageTransportService } from './message-transport.service';
import { ApiService } from './api.service';
import { of, throwError } from 'rxjs';

describe('MessageTransportService', () => {
  let service: MessageTransportService;
  let apiService: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    const apiServiceSpy = jasmine.createSpyObj('ApiService', ['get', 'post']);

    TestBed.configureTestingModule({
      providers: [
        MessageTransportService,
        { provide: ApiService, useValue: apiServiceSpy },
      ],
    });

    service = TestBed.inject(MessageTransportService);
    apiService = TestBed.inject(ApiService) as jasmine.SpyObj<ApiService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch chat history', (done) => {
    const mockMessages = [
      {
        id: 1,
        courseId: 123,
        senderId: 1,
        senderRole: 'CLIENT',
        contenu: 'Hello',
        dateEnvoi: '2026-04-10T12:00:00',
        delivered: true,
        isRead: false,
      },
    ];

    apiService.get.and.returnValue(of(mockMessages));

    service.getChatHistory(123).subscribe((messages) => {
      expect(messages).toEqual(mockMessages);
      expect(apiService.get).toHaveBeenCalledWith('/courses/123/messages');
      done();
    });
  });

  it('should handle chat history fetch error', (done) => {
    apiService.get.and.returnValue(
      throwError(() => new Error('Network error')),
    );

    service.getChatHistory(123).subscribe((messages) => {
      expect(messages).toEqual([]);
      done();
    });
  });

  it('should send message via REST', (done) => {
    const mockResponse = {
      id: 999,
      courseId: 123,
      senderId: 1,
      senderRole: 'CLIENT',
      contenu: 'Test message',
      dateEnvoi: '2026-04-10T12:00:00',
      delivered: true,
      isRead: false,
    };

    apiService.post.and.returnValue(of(mockResponse));

    service.sendMessageViaRest(123, 1, 'Test message').subscribe((msg) => {
      expect(msg).toEqual(mockResponse);
      expect(apiService.post).toHaveBeenCalledWith('/courses/123/messages', {
        senderId: 1,
        contenu: 'Test message',
      });
      done();
    });
  });

  it('should add message to history on receive', (done) => {
    const message = {
      id: 1,
      courseId: 123,
      senderId: 1,
      senderRole: 'CHAUFFEUR',
      contenu: 'Received',
      dateEnvoi: '2026-04-10T12:00:00',
    };

    service.messageHistory$.subscribe((history) => {
      if (history.length > 0) {
        expect(history[0]).toEqual(message);
        done();
      }
    });

    service.onMessageReceived(message as any);
  });

  it('should mark message as read', (done) => {
    apiService.post.and.returnValue(of(void 0));

    service.markAsRead(999).subscribe(() => {
      expect(apiService.post).toHaveBeenCalledWith('/messages/999/read', {});
      done();
    });
  });

  it('should clear history', (done) => {
    service.clearHistory();

    service.messageHistory$.subscribe((history) => {
      expect(history).toEqual([]);
      done();
    });
  });
});
