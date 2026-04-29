import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, timeout } from 'rxjs/operators';

export type TranslationLanguageCode = 'fra_Latn' | 'eng_Latn' | 'ara_Arab';

export interface TranslationRequest {
  text: string;
  source_lang?: TranslationLanguageCode | 'auto';
  target_lang: TranslationLanguageCode;
}

export interface TranslationResponse {
  translated_text: string;
  source_lang: string;
  target_lang: string;
  detected_source_lang?: string;
  skipped?: boolean;
  reason?: string;
  elapsed_ms?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ChatTranslationService {
  private readonly TRANSLATION_API_URL = 'http://127.0.0.1:5001/translate';

  constructor(private readonly http: HttpClient) {}

  translate(payload: TranslationRequest): Observable<TranslationResponse> {
    const startedAt = Date.now();
    console.log('[CHAT][TR][API] Request', {
      url: this.TRANSLATION_API_URL,
      source_lang: payload.source_lang,
      target_lang: payload.target_lang,
      text_length: String(payload.text || '').length,
      preview: String(payload.text || '').slice(0, 80),
    });

    return this.http
      .post<TranslationResponse>(this.TRANSLATION_API_URL, payload)
      .pipe(
        timeout(180000),
        tap({
          next: (response) => {
            console.log('[CHAT][TR][API] Response', {
              elapsed_ms: Date.now() - startedAt,
              source_lang: response.source_lang,
              target_lang: response.target_lang,
              translated_preview: String(response.translated_text || '').slice(
                0,
                80,
              ),
            });
          },
          error: (error) => {
            console.error('[CHAT][TR][API] Error', {
              elapsed_ms: Date.now() - startedAt,
              status: error?.status,
              message: error?.message,
              backend: error?.error,
            });
          },
        }),
      );
  }
}
