import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout, map } from 'rxjs/operators';
import {
  ChatTranslationService,
  TranslationLanguageCode,
} from './chat-translation.service';

export type TtsLanguageCode = 'fr' | 'en' | 'ar';

export interface TtsRequest {
  text: string;
  language: TtsLanguageCode;
  speed?: number;
  speaker_id?: number;
}

export interface LanguageDetectionResult {
  detected_lang: TranslationLanguageCode;
  tts_language: TtsLanguageCode;
  confidence: number;
}

@Injectable({
  providedIn: 'root',
})
export class TextToSpeechService {
  private readonly TTS_API_URL = 'http://127.0.0.1:5002/tts/synthesize';
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly translationService: ChatTranslationService,
  ) {}

  synthesize(payload: TtsRequest): Observable<Blob> {
    return this.http
      .post(this.TTS_API_URL, payload, {
        responseType: 'blob',
      })
      .pipe(timeout(60000));
  }

  /**
   * Detect language of given text using backend translation service
   * Returns detected language and corresponding TTS language code
   */
  detectLanguage(text: string): Observable<LanguageDetectionResult> {
    if (!text || text.trim().length === 0) {
      return new Observable((observer) => {
        observer.next({
          detected_lang: 'eng_Latn',
          tts_language: 'en',
          confidence: 0,
        });
        observer.complete();
      });
    }

    return this.translationService
      .translate({
        text: text.trim(),
        source_lang: 'auto',
        target_lang: 'eng_Latn', // dummy target, we only care about source detection
      })
      .pipe(
        timeout(30000),
        map((response) => {
          const detected = (response.detected_source_lang ||
            response.source_lang) as TranslationLanguageCode;
          const ttsLang = this.mapToTtsLanguage(detected);
          return {
            detected_lang: detected,
            tts_language: ttsLang,
            confidence: 0.95, // Backend detection is reliable
          };
        }),
      );
  }

  async playBlob(blob: Blob): Promise<void> {
    this.stop();

    const objectUrl = URL.createObjectURL(blob);
    this.currentObjectUrl = objectUrl;

    const audio = new Audio(objectUrl);
    this.currentAudio = audio;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
      };

      audio.onended = () => {
        cleanup();
        this.stop();
        resolve();
      };

      audio.onerror = () => {
        cleanup();
        this.stop();
        reject(new Error('Lecture audio impossible.'));
      };

      audio.play().catch((error) => {
        cleanup();
        this.stop();
        reject(error);
      });
    });
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
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
