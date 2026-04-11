import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ReservationRequest,
  ReservationResponse,
  PaiementRequest
} from '../models/reservation.model';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly base = 'http://localhost:8080/api/reservations';
  private readonly annulBase = 'http://localhost:8080/api/annulations';

  constructor(private http: HttpClient) {}

  creer(req: ReservationRequest): Observable<ReservationResponse> {
    return this.http.post<ReservationResponse>(this.base, req);
  }

  mesReservations(): Observable<ReservationResponse[]> {
    return this.http.get<ReservationResponse[]>(`${this.base}/mes-reservations`);
  }

  payer(req: PaiementRequest): Observable<ReservationResponse> {
    return this.http.post<ReservationResponse>(`${this.base}/payer`, req);
  }

  // Annuler après paiement (remboursement)
  annuler(id: number): Observable<ReservationResponse> {
    return this.http.post<ReservationResponse>(`${this.annulBase}/${id}`, {});
  }

  // Supprimer avant paiement (DELETE /api/reservations/{id})
  supprimerAvantPaiement(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}