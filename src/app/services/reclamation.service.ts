import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ReclamationCreateRequest,
  ReclamationResponse,
  UnreadCountResponse
} from '../models/reclamation.model';

@Injectable({ providedIn: 'root' })
export class ReclamationService {
  private readonly base = 'http://localhost:8080/api/reclamations';

  constructor(private readonly http: HttpClient) {}

  creer(req: ReclamationCreateRequest): Observable<ReclamationResponse> {
    return this.http.post<ReclamationResponse>(this.base, req);
  }

  mesReclamations(): Observable<ReclamationResponse[]> {
    return this.http.get<ReclamationResponse[]>(`${this.base}/mes`);
  }

  unreadCount(): Observable<UnreadCountResponse> {
    return this.http.get<UnreadCountResponse>(`${this.base}/mes/unread-count`);
  }

  marquerLu(id: number): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/lu`, {});
  }

  // ==========================
  //  SOCIETE
  // ==========================
  toutes(): Observable<ReclamationResponse[]> {
    return this.http.get<ReclamationResponse[]>(this.base);
  }

  repondre(id: number, reponse: string): Observable<ReclamationResponse> {
    return this.http.put<ReclamationResponse>(`${this.base}/${id}/reponse`, { reponse });
  }

  modifier(id: number, payload: { priorite: string; sujet: string }): Observable<ReclamationResponse> {
    return this.http.put<ReclamationResponse>(`${this.base}/${id}`, payload);
  }
}

