// src/app/features/transport/core/services/message-transport.service.ts
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from './api.service';
import { ChatMessageDTO } from '../models';

@Injectable({ providedIn: 'root' })
export class MessageTransportService {
  private messageHistorySubject = new BehaviorSubject<ChatMessageDTO[]>([]);
  public messageHistory$ = this.messageHistorySubject.asObservable();

  constructor(private api: ApiService) {}

  /**
   * Récupère l'historique des messages d'une course
   */
  getChatHistory(courseId: number): Observable<ChatMessageDTO[]> {
    return this.api.get<ChatMessageDTO[]>(`/courses/${courseId}/messages`).pipe(
      tap((messages) => {
        console.log('[CHAT] Historique reçu:', messages.length, 'messages');
        this.messageHistorySubject.next(messages);
      }),
      catchError((err) => {
        console.error('[CHAT] Erreur récupération historique:', err);
        return of([]);
      }),
    );
  }

  /**
   * Envoie un message via REST (fallback WebSocket)
   */
  sendMessageViaRest(
    courseId: number,
    senderId: number,
    contenu: string,
  ): Observable<ChatMessageDTO> {
    const payload = {
      senderId,
      contenu,
    };

    return this.api
      .post<ChatMessageDTO>(`/courses/${courseId}/messages`, payload)
      .pipe(
        tap((msg) => {
          console.log('[CHAT] Message envoyé via REST:', msg);
          this.addMessageToHistory(msg);
        }),
        catchError((err) => {
          console.error('[CHAT] Erreur envoi message REST:', err);
          throw err;
        }),
      );
  }

  /**
   * Reçoit un message via WebSocket (appelé par websocket.service)
   */
  onMessageReceived(message: ChatMessageDTO): void {
    console.log('[CHAT] Message reçu via WebSocket:', message);
    this.addMessageToHistory(message);
  }

  /**
   * Ajoute un message à l'historique local
   */
  private addMessageToHistory(message: ChatMessageDTO): void {
    const current = this.messageHistorySubject.value;
    this.messageHistorySubject.next([...current, message]);
  }

  /**
   * Marque un message comme lu
   */
  markAsRead(messageId: number): Observable<void> {
    return this.api.post<void>(`/messages/${messageId}/read`, {}).pipe(
      tap(() => console.log('[CHAT] Message marqué comme lu:', messageId)),
      catchError((err) => {
        console.warn('[CHAT] Erreur marquage message lu:', err);
        return of(void 0);
      }),
    );
  }

  /**
   * Réinitialise l'historique
   */
  clearHistory(): void {
    this.messageHistorySubject.next([]);
  }
}
