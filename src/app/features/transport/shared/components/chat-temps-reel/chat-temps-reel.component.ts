import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil, switchMap, map } from 'rxjs/operators';
import { MessageTransportService } from '../../../core/services/message-transport.service';
import { WebsocketService } from '../../../core/services/websocket.service';
import { ChatMessageDTO } from '../../../core/models';
import { AuthService } from '../../../../../services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  ChatTranslationService,
  TranslationLanguageCode,
} from '../../../core/services/chat-translation.service';
import { SpeechToTextService } from '../../../core/services/speech-to-text.service';
import {
  TextToSpeechService,
  TtsLanguageCode,
} from '../../../core/services/text-to-speech.service';

@Component({
  selector: 'app-chat-temps-reel',
  templateUrl: './chat-temps-reel.component.html',
  styleUrl: './chat-temps-reel.component.css',
})
export class ChatTempsReelComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @Input() courseId!: number;
  @Input() recipientName: string = 'Chauffeur';
  @Input() recipientRole: 'CLIENT' | 'CHAUFFEUR' = 'CHAUFFEUR';

  @ViewChild('messagesContainer') messagesContainer?: ElementRef;

  messages: ChatMessageDTO[] = [];
  newMessageText = '';
  isSending = false;
  isLoading = false;
  isSpeechToTextSupported = false;
  isSpeechListening = false;
  speechInterimText = '';
  speechErrorMessage = '';

  selectedSttLanguage: 'en' | 'fr' | 'ar' = 'fr';
  selectedTargetLang: TranslationLanguageCode = 'fra_Latn';
  readonly languageOptions: Array<{
    code: TranslationLanguageCode;
    label: string;
  }> = [
    { code: 'fra_Latn', label: 'Français' },
    { code: 'eng_Latn', label: 'English' },
    { code: 'ara_Arab', label: 'العربية' },
  ];
  translatingKeys = new Set<string>();
  translatedTextByKey: Record<string, string> = {};
  translationErrorByKey: Record<string, string> = {};
  detectedLangByKey: Record<string, TranslationLanguageCode> = {};

  currentUserId: number | null = null;
  currentUserRole: 'CLIENT' | 'CHAUFFEUR' | null = null;

  private destroy$ = new Subject<void>();
  private shouldScroll = true;
  private speakingMessageKey: string | null = null;

  constructor(
    private messageService: MessageTransportService,
    private websocketService: WebsocketService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private translationService: ChatTranslationService,
    private speechToTextService: SpeechToTextService,
    private textToSpeechService: TextToSpeechService,
  ) {}

  ngOnInit(): void {
    this.selectedTargetLang = this.getDefaultTargetLangFromBrowser();
    console.log('[CHAT][TR] Langue cible par défaut:', this.selectedTargetLang);
    this.setupSpeechToText();
    this.loadCurrentUser();
    this.loadChatHistory();
    this.setupWebSocketListener();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.speechToTextService.abort();
    this.textToSpeechService.stop();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Charge l'utilisateur actuel
   */
  private loadCurrentUser(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUserId = user.id ?? null;
      this.currentUserRole = (user.role?.toUpperCase() as any) ?? null;
    }
  }

  /**
   * Récupère l'historique des messages
   */
  private loadChatHistory(): void {
    if (!this.courseId) {
      console.warn('[CHAT] courseId not provided');
      return;
    }

    this.isLoading = true;
    this.messageService
      .getChatHistory(this.courseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (messages) => {
          console.log('[CHAT] Historique chargé:', messages.length, 'messages');
          this.messages = messages;
          this.isLoading = false;
          this.shouldScroll = true;
        },
        error: (err) => {
          console.error('[CHAT] Erreur chargement historique:', err);
          this.isLoading = false;
        },
      });
  }

  /**
   * Configure l'écoute WebSocket pour les nouveaux messages
   */
  private setupWebSocketListener(): void {
    if (!this.courseId) {
      console.warn('[CHAT] courseId not provided for WebSocket');
      return;
    }

    // S'abonne au topic WebSocket pour cette course
    this.websocketService.subscribe(
      `/topic/course/${this.courseId}/chat`,
      (msg) => {
        try {
          const messageData = JSON.parse(msg.body);
          console.log('[CHAT] Message WebSocket reçu:', messageData);
          this.messageService.onMessageReceived(messageData);
          this.messages.push(messageData);
          this.shouldScroll = true;
        } catch (e) {
          console.error('[CHAT] Erreur parsing WebSocket message:', e);
        }
      },
    );
  }

  /**
   * Envoie un message
   */
  sendMessage(): void {
    if (this.isSpeechListening) {
      this.stopSpeechToText();
    }

    if (!this.newMessageText.trim()) {
      return;
    }

    if (!this.currentUserId) {
      this.notificationService.error('Erreur', 'Utilisateur non authentifié');
      return;
    }

    if (!this.courseId) {
      this.notificationService.error('Erreur', 'Course non trouvée');
      return;
    }

    this.isSending = true;
    const messageContent = this.newMessageText.trim();
    this.newMessageText = '';

    console.log('[CHAT] Envoi message:', {
      courseId: this.courseId,
      senderId: this.currentUserId,
      contenu: messageContent,
    });

    this.messageService
      .sendMessageViaRest(this.courseId, this.currentUserId, messageContent)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sentMessage) => {
          console.log('[CHAT] Message envoyé avec succès:', sentMessage);
          this.isSending = false;
          this.shouldScroll = true;
        },
        error: (err) => {
          console.error('[CHAT] Erreur envoi message:', err);
          this.isSending = false;
          this.newMessageText = messageContent; // Restaure le message
          this.notificationService.error(
            'Erreur',
            "Impossible d'envoyer le message.",
          );
        },
      });
  }

  /**
   * Détermine si le message vient de l'utilisateur actuel
   */
  isCurrentUserMessage(message: ChatMessageDTO): boolean {
    return message.senderId === this.currentUserId;
  }

  getMessageKey(message: ChatMessageDTO, index: number): string {
    if (message.id) {
      return `id-${message.id}`;
    }

    const stamp = message.dateEnvoi || 'no-date';
    return `idx-${index}-${message.senderId}-${stamp}-${message.contenu}`;
  }

  getTranslationStateKey(
    message: ChatMessageDTO,
    index: number,
    targetLang: TranslationLanguageCode = this.selectedTargetLang,
  ): string {
    return `${this.getMessageKey(message, index)}::${targetLang}`;
  }

  isTranslating(message: ChatMessageDTO, index: number): boolean {
    return this.translatingKeys.has(
      this.getTranslationStateKey(message, index),
    );
  }

  hasTranslation(message: ChatMessageDTO, index: number): boolean {
    return !!this.translatedTextByKey[
      this.getTranslationStateKey(message, index)
    ];
  }

  getTranslatedText(message: ChatMessageDTO, index: number): string {
    return (
      this.translatedTextByKey[this.getTranslationStateKey(message, index)] ||
      ''
    );
  }

  getTranslationError(message: ChatMessageDTO, index: number): string {
    return (
      this.translationErrorByKey[this.getTranslationStateKey(message, index)] ||
      ''
    );
  }

  getDetectedLanguageBadge(message: ChatMessageDTO, index: number): string {
    const code =
      this.detectedLangByKey[this.getTranslationStateKey(message, index)];
    if (!code) {
      return '';
    }

    return this.getLanguageLabel(code);
  }

  canTranslateMessage(message: ChatMessageDTO, index: number): boolean {
    if (this.isTranslating(message, index)) {
      return false;
    }

    const content = String(message.contenu || '').trim();
    if (!content) {
      return false;
    }

    const inferred = this.inferMessageLang(content);
    return inferred !== this.selectedTargetLang;
  }

  getTranslateButtonLabel(message: ChatMessageDTO, index: number): string {
    if (this.isTranslating(message, index)) {
      return 'Traduction...';
    }

    const content = String(message.contenu || '').trim();
    const inferred = this.inferMessageLang(content);
    if (content && inferred === this.selectedTargetLang) {
      return 'Déjà dans cette langue';
    }

    return 'Traduire';
  }

  isSpeakingMessage(message: ChatMessageDTO, index: number): boolean {
    return this.speakingMessageKey === this.getMessageKey(message, index);
  }

  getSpeakButtonLabel(message: ChatMessageDTO, index: number): string {
    return this.isSpeakingMessage(message, index) ? 'Arrêter audio' : 'Écouter';
  }

  speakMessage(message: ChatMessageDTO, index: number): void {
    const key = this.getMessageKey(message, index);

    if (this.speakingMessageKey === key) {
      this.textToSpeechService.stop();
      this.speakingMessageKey = null;
      return;
    }

    const translated = this.getTranslatedText(message, index).trim();
    const original = String(message.contenu || '').trim();
    const textToSpeak = translated || original;

    if (!textToSpeak) {
      this.notificationService.warning('Audio', 'Aucun texte à lire.');
      return;
    }

    this.speakingMessageKey = key;

    // If translation exists, use target language. Otherwise, detect language from original text.
    const detectionOrLang$ = translated
      ? new Observable<string>((observer) => {
          observer.next(this.mapToTtsLanguage(this.selectedTargetLang));
          observer.complete();
        })
      : this.textToSpeechService
          .detectLanguage(original)
          .pipe(map((result) => result.tts_language));

    detectionOrLang$
      .pipe(
        takeUntil(this.destroy$),
        switchMap((ttsLang) =>
          this.textToSpeechService.synthesize({
            text: textToSpeak,
            language: ttsLang as TtsLanguageCode,
            speed: 1.0,
          }),
        ),
      )
      .subscribe({
        next: async (audioBlob) => {
          try {
            await this.textToSpeechService.playBlob(audioBlob);
          } catch (error) {
            console.error('[CHAT][TTS] Lecture impossible:', error);
            this.notificationService.warning(
              'Audio',
              "Impossible de lire l'audio.",
            );
          } finally {
            if (this.speakingMessageKey === key) {
              this.speakingMessageKey = null;
            }
          }
        },
        error: (err) => {
          console.error('[CHAT][TTS] Erreur synthèse/détection:', err);
          this.speakingMessageKey = null;
          this.notificationService.warning(
            'Audio',
            'Synthèse vocale indisponible.',
          );
        },
      });
  }

  translateMessage(message: ChatMessageDTO, index: number): void {
    const content = String(message.contenu || '').trim();
    if (!content) {
      console.warn('[CHAT][TR] Message vide, traduction ignoree.', {
        index,
        message,
      });
      return;
    }

    if (!this.canTranslateMessage(message, index)) {
      const inferred = this.inferMessageLang(content);
      console.info('[CHAT][TR] Skip frontend (meme langue)', {
        inferred,
        target: this.selectedTargetLang,
      });
      this.notificationService.info(
        'Traduction',
        'Ce message semble déjà dans la langue cible.',
      );
      return;
    }

    const key = this.getTranslationStateKey(message, index);
    console.log('[CHAT][TR] Clic Traduire', {
      key,
      index,
      messageId: message.id,
      targetLang: this.selectedTargetLang,
      sourceHint: 'auto',
      preview: content.slice(0, 80),
    });

    this.translatingKeys.add(key);
    delete this.translationErrorByKey[key];
    this.notificationService.info(
      'Traduction',
      'Traduction en cours... Merci de patienter.',
    );

    this.translationService
      .translate({
        text: content,
        source_lang: 'auto',
        target_lang: this.selectedTargetLang,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.translatedTextByKey[key] = result.translated_text || '';
          const detected =
            (result.detected_source_lang as
              | TranslationLanguageCode
              | undefined) ||
            (result.source_lang as TranslationLanguageCode | undefined);
          if (detected) {
            this.detectedLangByKey[key] = detected;
          }
          this.translatingKeys.delete(key);
          console.log('[CHAT][TR] Traduction OK', {
            key,
            sourceLang: result.source_lang,
            detectedSourceLang: result.detected_source_lang,
            targetLang: result.target_lang,
            skipped: result.skipped,
            reason: result.reason,
            elapsedMs: result.elapsed_ms,
            translatedPreview: String(result.translated_text || '').slice(
              0,
              100,
            ),
          });
          if (result.skipped && result.reason === 'same_language') {
            this.notificationService.info(
              'Traduction',
              'Même langue détectée. Aucun changement nécessaire.',
            );
          } else {
            this.notificationService.success(
              'Traduction',
              'Traduction terminée.',
            );
          }
        },
        error: (err) => {
          console.error('[CHAT] Erreur traduction:', err);
          this.translationErrorByKey[key] =
            err?.error?.error || err?.message || 'Traduction indisponible.';
          this.translatingKeys.delete(key);
          this.notificationService.warning(
            'Traduction',
            'La traduction a échoué pour ce message.',
          );
        },
      });
  }

  /**
   * Formatte la date du message
   */
  formatTime(dateString?: string): string {
    if (!dateString) {
      return '';
    }

    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Scroll vers le dernier message
   */
  private scrollToBottom(): void {
    if (this.messagesContainer) {
      setTimeout(() => {
        const element = this.messagesContainer?.nativeElement;
        if (element) {
          element.scrollTop = element.scrollHeight;
        }
      }, 0);
    }
  }

  /**
   * Gère l'envoi avec Enter
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  toggleSpeechToText(): void {
    if (!this.isSpeechToTextSupported) {
      this.notificationService.warning(
        'Micro',
        'Reconnaissance vocale non supportee par ce navigateur.',
      );
      return;
    }

    if (this.isSpeechListening) {
      this.stopSpeechToText();
      return;
    }

    this.speechErrorMessage = '';
    const started = this.speechToTextService.start(this.getSpeechLocale());
    if (!started) {
      this.notificationService.warning(
        'Micro',
        'Impossible de demarrer la reconnaissance vocale.',
      );
    }
  }

  stopSpeechToText(): void {
    this.speechToTextService.stop();
  }

  getSpeechButtonLabel(): string {
    if (!this.isSpeechToTextSupported) {
      return 'Micro indisponible';
    }

    return this.isSpeechListening ? 'Arreter micro' : 'Parler';
  }

  getSpeechStatusLabel(): string {
    if (!this.isSpeechToTextSupported) {
      return 'STT non supporte';
    }

    if (this.isSpeechListening) {
      return 'Ecoute active';
    }

    return 'Micro pret';
  }

  private getDefaultTargetLangFromBrowser(): TranslationLanguageCode {
    const browserLang = String(navigator?.language || '').toLowerCase();
    if (browserLang.startsWith('ar')) {
      return 'ara_Arab';
    }

    if (browserLang.startsWith('en')) {
      return 'eng_Latn';
    }

    return 'fra_Latn';
  }

  private setupSpeechToText(): void {
    this.isSpeechToTextSupported = this.speechToTextService.isSupported();

    this.speechToTextService
      .listeningChanges()
      .pipe(takeUntil(this.destroy$))
      .subscribe((isListening) => {
        this.isSpeechListening = isListening;
      });

    this.speechToTextService
      .interimTextChanges()
      .pipe(takeUntil(this.destroy$))
      .subscribe((text) => {
        this.speechInterimText = text;
      });

    this.speechToTextService
      .finalTranscriptChanges()
      .pipe(takeUntil(this.destroy$))
      .subscribe((text) => {
        this.appendTranscriptToMessage(text);
      });

    this.speechToTextService
      .errors()
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        this.speechErrorMessage = message;
        if (message) {
          this.notificationService.warning('Micro', message);
        }
      });
  }

  private appendTranscriptToMessage(transcript: string): void {
    const cleanTranscript = String(transcript || '').trim();
    if (!cleanTranscript) {
      return;
    }

    const prefix = this.newMessageText.trim() ? ' ' : '';
    this.newMessageText = `${this.newMessageText}${prefix}${cleanTranscript}`;
  }

  private getSpeechLocale(): string {
    switch (this.selectedSttLanguage) {
      case 'en':
        return 'en-US';
      case 'ar':
        return 'ar-JO';
      case 'fr':
      default:
        return 'fr-FR';
    }
  }

  private inferMessageLang(text: string): TranslationLanguageCode {
    const sample = ` ${String(text || '').toLowerCase()} `;

    if (/[\u0600-\u06FF]/.test(sample)) {
      return 'ara_Arab';
    }

    const frMarkers = [
      ' le ',
      ' la ',
      ' les ',
      ' des ',
      ' est ',
      ' et ',
      ' merci ',
      ' bonjour ',
    ];
    const enMarkers = [
      ' the ',
      ' and ',
      ' is ',
      ' are ',
      ' thank ',
      ' hello ',
      ' you ',
    ];

    const frHits = frMarkers.filter((m) => sample.includes(m)).length;
    const enHits = enMarkers.filter((m) => sample.includes(m)).length;

    if (frHits > enHits) {
      return 'fra_Latn';
    }

    if (enHits > frHits) {
      return 'eng_Latn';
    }

    return 'eng_Latn';
  }

  private getLanguageLabel(code: TranslationLanguageCode): string {
    return (
      this.languageOptions.find((opt) => opt.code === code)?.label ||
      String(code)
    );
  }

  private mapToTtsLanguage(code: TranslationLanguageCode): TtsLanguageCode {
    switch (code) {
      case 'ara_Arab':
        return 'ar';
      case 'eng_Latn':
        return 'en';
      case 'fra_Latn':
      default:
        return 'fr';
    }
  }
}
