// src/app/services/moderation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ModerationResult {
  approved: boolean;
  score: number;
  reason?: string;
  category?: string; // 'SAFE' | 'SPAM' | 'HATE_SPEECH' | 'OFFENSIVE'
}

@Injectable({ providedIn: 'root' })
export class ModerationService {

  private apiUrl = 'http://localhost:8080/api/moderation';

  // Pré-filtre local rapide (avant appel réseau)
  private readonly forbiddenWords = [
    'insulte', 'haine', 'spam', 'idiot', 'nul'
    // ajoute tes mots selon ton contexte
  ];

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Vérification locale instantanée
  containsForbiddenWords(text: string): boolean {
    const lower = text.toLowerCase();
    return this.forbiddenWords.some(w => lower.includes(w));
  }

  // Appel Spring Boot → IA (OpenAI / Perspective API)
  analyze(content: string): Observable<ModerationResult> {
    return this.http.post<ModerationResult>(
      `${this.apiUrl}/analyze`,
      { content },
      { headers: this.getHeaders() }
    ).pipe(
      // En cas d'erreur réseau → on laisse passer (fail open)
      catchError(() => of({ approved: true, score: 0, category: 'SAFE' }))
    );
  }
}