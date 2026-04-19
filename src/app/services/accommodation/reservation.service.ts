import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReservationRequest {
  idLogement: number;
  dateDebut: string;
  dateFin: string;
  nbPersonnes: number;
  prixFinalNegocie?: number;
}

export interface ReservationResponse {
  idReservation: number;
  idLogement: number;
  nomLogement: string;
  villeLogement: string;
  idClient: number;
  nomClient: string;
  dateDebut: string;
  dateFin: string;
  nbPersonnes: number;
  prixTotal: string;
  statut: string;
  dateReservation: string;
  canCancelOrModify?: boolean;
  capaciteLogement?: number;
  smartLockCode?: string;
  archived?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/reservations`;
  private readonly pythonApiUrl = 'http://localhost:8000/negotiate';

  constructor(private readonly http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  createReservation(payload: ReservationRequest): Observable<ReservationResponse> {
    return this.http.post<ReservationResponse>(this.apiUrl, payload, { headers: this.getHeaders() });
  }

  negotiateWithAI(logement_id: number, original_price: number, proposed_price: number, offer_count: number = 1): Observable<any> {
    const payload = { logement_id, original_price, proposed_price, offer_count };
    // Call python directly. No Auth token needed for python API.
    return this.http.post<any>(this.pythonApiUrl, payload);
  }

  getAllReservations(): Observable<ReservationResponse[]> {
    return this.http.get<ReservationResponse[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  getReservationsByHebergeur(idHebergeur: number): Observable<ReservationResponse[]> {
    return this.http.get<ReservationResponse[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  updateReservationStatus(idReservation: number, action: 'confirmer' | 'annuler'): Observable<ReservationResponse> {
    return this.http.patch<ReservationResponse>(`${this.apiUrl}/${idReservation}/${action}`, {}, { headers: this.getHeaders() });
  }

  updateReservationDetails(idReservation: number, payload: ReservationRequest): Observable<ReservationResponse> {
    return this.http.put<ReservationResponse>(`${this.apiUrl}/${idReservation}/modifier`, payload, { headers: this.getHeaders() });
  }

  deleteReservation(idReservation: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idReservation}`, { headers: this.getHeaders() });
  }

  archiveReservation(idReservation: number): Observable<ReservationResponse> {
    return this.http.patch<ReservationResponse>(`${this.apiUrl}/${idReservation}/archiver`, {}, { headers: this.getHeaders() });
  }

  unarchiveReservation(idReservation: number): Observable<ReservationResponse> {
    return this.http.patch<ReservationResponse>(`${this.apiUrl}/${idReservation}/desarchiver`, {}, { headers: this.getHeaders() });
  }
}

