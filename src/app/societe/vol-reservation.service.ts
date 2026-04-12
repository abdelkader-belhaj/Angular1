import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface VolRequest {
  numero: string;
  depart: string;
  arrivee: string;
  dateDepart: string;
  heureDepart: string;
  prix: number;
  places: number;
}

export interface VolResponse {
  id: number;
  societeNom: string;
  numero: string;
  depart: string;
  arrivee: string;
  dateDepart: string;
  heureDepart: string;
  prix: number;
  places: number;
}

export interface ReservationResponse {
  id: number;
  reference: string;
  touristeEmail: string;
  volAller: VolResponse;
  volRetour?: VolResponse;
  typeBillet: string;
  nbPassagers: number;
  prixTotal: number;
  dateReservation: string;
  statutPaiement: string;
  statutReservation: string;
}

@Injectable({ providedIn: 'root' })
export class VolReservationService {
  private base = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── VOLS ──────────────────────────────────────────
  getMesVols(): Observable<VolResponse[]> {
    return this.http.get<VolResponse[]>(`${this.base}/vols/mes-vols`, { headers: this.headers() });
  }

  createVol(req: VolRequest): Observable<VolResponse> {
    return this.http.post<VolResponse>(`${this.base}/vols`, req, { headers: this.headers() });
  }

  updateVol(id: number, req: VolRequest): Observable<VolResponse> {
    return this.http.put<VolResponse>(`${this.base}/vols/${id}`, req, { headers: this.headers() });
  }

  deleteVol(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/vols/${id}`, { headers: this.headers() });
  }

  // ── RÉSERVATIONS ──────────────────────────────────
  getToutesReservations(): Observable<ReservationResponse[]> {
    return this.http.get<ReservationResponse[]>(`${this.base}/reservations/toutes`, { headers: this.headers() });
  }

  modifierStatutReservation(id: number, statut: string): Observable<ReservationResponse> {
    return this.http.put<ReservationResponse>(
      `${this.base}/reservations/${id}/statut?statut=${statut}`,
      {},
      { headers: this.headers() }
    );
  }

  supprimerReservation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/reservations/admin/${id}`, { headers: this.headers() });
  }

  confirmerRemboursement(id: number): Observable<ReservationResponse> {
    return this.http.put<ReservationResponse>(
      `${this.base}/annulations/${id}/confirmer-remboursement`,
      {},
      { headers: this.headers() }
    );
  }
}