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

@Injectable({
  providedIn: 'root'
})
export class NotificationClientService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/notifications`;
  private readonly http = inject(HttpClient);
  
  public notificationsUpdated$ = new Subject<void>();

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

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
}
