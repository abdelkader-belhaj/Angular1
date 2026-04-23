import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface BackendNotification {
  id: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}

/** Notification locale (réclamations, hors backend) */
export interface LocalClientNotification {
  id: string;
  clientId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationClientService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/notifications`;
  private readonly http = inject(HttpClient);
  private readonly localKey = 'client_local_notifications';

  public notificationsUpdated$ = new Subject<void>();

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  // ─── Backend notifications (réservations, logements) ───────────────────────

  getMyNotifications(): Observable<BackendNotification[]> {
    return this.http.get<BackendNotification[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  markAsRead(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/read`, {}, { headers: this.getHeaders() }).pipe(
      tap(() => this.notificationsUpdated$.next())
    );
  }

  deleteNotification(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      tap(() => this.notificationsUpdated$.next())
    );
  }

  // ─── Local notifications (réclamations — localStorage) ─────────────────────

  addLocalNotification(clientId: number, message: string): void {
    const all = this.getLocalAll();
    const notif: LocalClientNotification = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clientId,
      message,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    all.unshift(notif);
    localStorage.setItem(this.localKey, JSON.stringify(all.slice(0, 100)));
    this.notificationsUpdated$.next();
  }

  getLocalNotifications(clientId: number): LocalClientNotification[] {
    return this.getLocalAll().filter(n => n.clientId === clientId);
  }

  markLocalAsRead(id: string, clientId: number): void {
    const all = this.getLocalAll();
    const n = all.find(x => x.id === id && x.clientId === clientId);
    if (n) {
      n.isRead = true;
      localStorage.setItem(this.localKey, JSON.stringify(all));
      this.notificationsUpdated$.next();
    }
  }

  deleteLocalNotification(id: string, clientId: number): void {
    const filtered = this.getLocalAll().filter(x => !(x.id === id && x.clientId === clientId));
    localStorage.setItem(this.localKey, JSON.stringify(filtered));
    this.notificationsUpdated$.next();
  }

  getLocalUnreadCount(clientId: number): number {
    return this.getLocalNotifications(clientId).filter(n => !n.isRead).length;
  }

  private getLocalAll(): LocalClientNotification[] {
    try {
      const raw = localStorage.getItem(this.localKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
}
