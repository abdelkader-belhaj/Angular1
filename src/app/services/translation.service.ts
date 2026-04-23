import { Injectable } from '@angular/core';
import { HttpClient, HttpParams} from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TranslationService {

  readonly languages = [
    { code: 'en', label: '🇬🇧 English' },
    { code: 'fr', label: '🇫🇷 Français' },
    { code: 'ar', label: '🇸🇦 العربية' },
    { code: 'de', label: '🇩🇪 Deutsch' },
    { code: 'es', label: '🇪🇸 Español' },
    { code: 'it', label: '🇮🇹 Italiano' },
    { code: 'zh', label: '🇨🇳 中文' },
    { code: 'ja', label: '🇯🇵 日本語' },
    { code: 'ru', label: '🇷🇺 Русский' },
  ];

  constructor(private http: HttpClient) {}

 translate(text: string, sourceLang: string, targetLang: string): Observable<string> {
  const params = new HttpParams()
    .set('text', text)
    .set('sourceLang', sourceLang)
    .set('targetLang', targetLang);

  return this.http.get<{ translated: string }>(
    'http://localhost:8080/api/translate',
    { params }
  ).pipe(
    map(res => res.translated)
  );
}
}