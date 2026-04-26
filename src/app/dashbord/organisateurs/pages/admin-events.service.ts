import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EventActivityResponse {
  id: number;
  title: string;
  description: string;
  price: number;
  capacity: number;
  availableSeats: number;
  startDate: string;
  endDate: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  moderatedAt?: string;
  moderatedByEmail?: string;
  moderationReason?: string;
  cancellationReason?: string;
  categoryId: number;
  categoryName: string;
  organizerId: number;
  organizerName: string;
}

export interface EventRejectRequest {
  reason?: string;
}

export interface EventCancelRequest {
  reason?: string;
}

export interface AdminEventStats {
  totalEvents: number;
  draftCount: number;
  publishedCount: number;
  rejectedCount: number;
  cancelledCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminEventsService {
  private readonly apiUrl = 'http://localhost:8080/api/events';

  constructor(private http: HttpClient) {}

  // Récupérer tous les événements (pour admin)
  getAllEvents(): Observable<EventActivityResponse[]> {
    return this.http.get<EventActivityResponse[]>(`${this.apiUrl}/all`);
  }

  // Récupérer les événements par statut
  getEventsByStatus(status: string): Observable<EventActivityResponse[]> {
    return this.http.get<EventActivityResponse[]>(`${this.apiUrl}/status/${status}`);
  }

  // Publier un événement (ADMIN)
  publishEvent(id: number): Observable<EventActivityResponse> {
    return this.http.post<EventActivityResponse>(`${this.apiUrl}/${id}/publish`, null);
  }

  // Rejeter un événement (ADMIN)
  rejectEvent(id: number, payload: EventRejectRequest): Observable<EventActivityResponse> {
    return this.http.post<EventActivityResponse>(`${this.apiUrl}/${id}/reject`, payload);
  }

  // Annuler un événement (ADMIN/ORGANISATEUR)
  cancelEvent(id: number, payload?: EventCancelRequest): Observable<EventActivityResponse> {
    return this.http.post<EventActivityResponse>(`${this.apiUrl}/${id}/cancel`, payload ?? null);
  }

  // Obtenir les statistiques d'événements
  getEventStats(): Observable<AdminEventStats> {
    return this.http.get<any>(`${this.apiUrl}/stats`);
  }

  // Supprimer un événement (ADMIN)
  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
