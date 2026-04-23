import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ReservationRequest,
  ReservationResponse,
  PaiementRequest,
  QrCodeVolResponse
} from '../models/reservation.model';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly base = 'http://localhost:8080/api/reservations';
  private readonly annulBase = 'http://localhost:8080/api/annulations';
  private readonly qrBase = 'http://localhost:8080/api/qrcodes';

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

  annuler(id: number): Observable<ReservationResponse> {
    return this.http.post<ReservationResponse>(`${this.annulBase}/${id}`, {});
  }

  supprimerAvantPaiement(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getQrCode(reservationId: number): Observable<QrCodeVolResponse> {
    return this.http.get<QrCodeVolResponse>(
      `${this.qrBase}/reservation/${reservationId}`
    );
  }

  getHotelRecommendations(destination: string): Observable<any[]> {
    return this.http.get<any[]>(`http://localhost:8080/api/hotels/recommandations?destination=${destination}`);
  }

  getOffres(): Observable<any[]> {
    return this.http.get<any[]>(`http://localhost:8080/api/offres`);
  }

  creerOffre(offre: any): Observable<any> {
    return this.http.post<any>(`http://localhost:8080/api/offres`, offre);
  }
}