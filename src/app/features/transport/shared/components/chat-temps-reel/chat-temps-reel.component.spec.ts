import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatTempsReelComponent } from './chat-temps-reel.component';
import { MessageTransportService } from '../../../core/services/message-transport.service';
import { WebsocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../../../services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ChatTranslationService } from '../../../core/services/chat-translation.service';
import { SpeechToTextService } from '../../../core/services/speech-to-text.service';
import { TextToSpeechService } from '../../../core/services/text-to-speech.service';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';

describe('ChatTempsReelComponent', () => {
  let component: ChatTempsReelComponent;
  let fixture: ComponentFixture<ChatTempsReelComponent>;
  let messageService: jasmine.SpyObj<MessageTransportService>;
  let websocketService: jasmine.SpyObj<WebsocketService>;
  let authService: jasmine.SpyObj<AuthService>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let translationService: jasmine.SpyObj<ChatTranslationService>;
  let speechToTextService: jasmine.SpyObj<SpeechToTextService>;
  let textToSpeechService: jasmine.SpyObj<TextToSpeechService>;

  beforeEach(async () => {
    const messageServiceSpy = jasmine.createSpyObj('MessageTransportService', [
      'getChatHistory',
      'sendMessageViaRest',
      'onMessageReceived',
      'clearHistory',
    ]);

    const websocketServiceSpy = jasmine.createSpyObj('WebsocketService', [
      'subscribe',
    ]);

    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'getCurrentUser',
    ]);

    const notificationServiceSpy = jasmine.createSpyObj('NotificationService', [
      'success',
      'error',
      'warning',
      'info',
    ]);

    const translationServiceSpy = jasmine.createSpyObj(
      'ChatTranslationService',
      ['translate'],
    );
    translationServiceSpy.translate.and.returnValue(
      of({
        translated_text: 'Bonjour',
        source_lang: 'eng_Latn',
        target_lang: 'fra_Latn',
      } as any),
    );

    const speechToTextServiceSpy = jasmine.createSpyObj('SpeechToTextService', [
      'isSupported',
      'start',
      'stop',
      'abort',
      'listeningChanges',
      'interimTextChanges',
      'finalTranscriptChanges',
      'errors',
    ]);
    speechToTextServiceSpy.isSupported.and.returnValue(true);
    speechToTextServiceSpy.start.and.returnValue(true);
    speechToTextServiceSpy.listeningChanges.and.returnValue(of(false));
    speechToTextServiceSpy.interimTextChanges.and.returnValue(of(''));
    speechToTextServiceSpy.finalTranscriptChanges.and.returnValue(of(''));
    speechToTextServiceSpy.errors.and.returnValue(of(''));

    const textToSpeechServiceSpy = jasmine.createSpyObj('TextToSpeechService', [
      'synthesize',
      'playBlob',
      'stop',
    ]);
    textToSpeechServiceSpy.synthesize.and.returnValue(of(new Blob()));
    textToSpeechServiceSpy.playBlob.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      declarations: [ChatTempsReelComponent],
      imports: [FormsModule],
      providers: [
        { provide: MessageTransportService, useValue: messageServiceSpy },
        { provide: WebsocketService, useValue: websocketServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: NotificationService, useValue: notificationServiceSpy },
        { provide: ChatTranslationService, useValue: translationServiceSpy },
        { provide: SpeechToTextService, useValue: speechToTextServiceSpy },
        { provide: TextToSpeechService, useValue: textToSpeechServiceSpy },
      ],
    }).compileComponents();

    messageService = TestBed.inject(
      MessageTransportService,
    ) as jasmine.SpyObj<MessageTransportService>;
    websocketService = TestBed.inject(
      WebsocketService,
    ) as jasmine.SpyObj<WebsocketService>;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    notificationService = TestBed.inject(
      NotificationService,
    ) as jasmine.SpyObj<NotificationService>;
    translationService = TestBed.inject(
      ChatTranslationService,
    ) as jasmine.SpyObj<ChatTranslationService>;
    speechToTextService = TestBed.inject(
      SpeechToTextService,
    ) as jasmine.SpyObj<SpeechToTextService>;
    textToSpeechService = TestBed.inject(
      TextToSpeechService,
    ) as jasmine.SpyObj<TextToSpeechService>;

    fixture = TestBed.createComponent(ChatTempsReelComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(translationService).toBeTruthy();
    expect(speechToTextService).toBeTruthy();
    expect(textToSpeechService).toBeTruthy();
  });

  it('should load chat history on init', () => {
    component.courseId = 123;
    messageService.getChatHistory.and.returnValue(
      of([
        {
          senderId: 1,
          contenu: 'Hello',
          dateEnvoi: '2026-04-10T12:00:00',
        } as any,
      ]),
    );
    authService.getCurrentUser.and.returnValue({
      id: 2,
      role: 'CLIENT',
    } as any);

    fixture.detectChanges();

    expect(messageService.getChatHistory).toHaveBeenCalledWith(123);
    expect(component.messages.length).toBe(1);
  });

  it('should send message successfully', (done) => {
    component.courseId = 123;
    component.currentUserId = 1;
    component.newMessageText = 'Test message';

    messageService.sendMessageViaRest.and.returnValue(
      of({
        senderId: 1,
        contenu: 'Test message',
        dateEnvoi: '2026-04-10T12:00:00',
      } as any),
    );

    component.sendMessage();

    setTimeout(() => {
      expect(messageService.sendMessageViaRest).toHaveBeenCalledWith(
        123,
        1,
        'Test message',
      );
      expect(component.newMessageText).toBe('');
      expect(component.isSending).toBe(false);
      done();
    }, 100);
  });

  it('should prevent empty message send', () => {
    component.newMessageText = '   ';
    component.sendMessage();

    expect(messageService.sendMessageViaRest).not.toHaveBeenCalled();
  });

  it('should identify own messages correctly', () => {
    component.currentUserId = 1;

    const ownMessage = {
      senderId: 1,
      contenu: 'My message',
    } as any;

    const otherMessage = {
      senderId: 2,
      contenu: 'Other message',
    } as any;

    expect(component.isCurrentUserMessage(ownMessage)).toBe(true);
    expect(component.isCurrentUserMessage(otherMessage)).toBe(false);
  });

  it('should format time correctly', () => {
    const time = component.formatTime('2026-04-10T14:30:25');
    expect(time).toContain(':');
  });

  it('should handle send button Enter key', () => {
    spyOn(component, 'sendMessage');
    component.newMessageText = 'Test';

    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    spyOn(event, 'preventDefault');

    component.onKeyDown(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.sendMessage).toHaveBeenCalled();
  });

  it('should not send on Shift+Enter', () => {
    spyOn(component, 'sendMessage');

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
    });
    component.onKeyDown(event);

    expect(component.sendMessage).not.toHaveBeenCalled();
  });

  it('should handle send error gracefully', () => {
    component.courseId = 123;
    component.currentUserId = 1;
    component.newMessageText = 'Test';

    messageService.sendMessageViaRest.and.returnValue(
      throwError(() => new Error('Send failed')),
    );

    component.sendMessage();

    expect(notificationService.error).toHaveBeenCalledWith(
      'Erreur',
      "Impossible d'envoyer le message.",
    );
  });
});
