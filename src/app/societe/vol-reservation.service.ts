import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EscaleRequest {
  ville: string;
  duree: string;
}

export interface VolRequest {
  numero: string;
  depart: string;
  arrivee: string;
  dateDepart: string;
  heureDepart: string;
  prix: number;
  places: number;
  escales: EscaleRequest[];
  offreId?: number | null;
  retard?: number;
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
  escales?: EscaleRequest[];
  offre?: { id: number, code: string, pourcentage: number, actif?: boolean, dateDebut?: string, dateFin?: string };
  retard?: number;
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
  prixInitial: number; // ← NOUVEAU
  dateReservation: string;
  statutPaiement: string;
  statutReservation: string;
  bonusApplique?: boolean;
  remiseBonus?: number;
  offre?: { code: string; pourcentage: number };
}

export interface Offre {
  id?: number;
  code: string;
  pourcentage: number;
  dateDebut: string;
  dateFin: string;
  actif: boolean;
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

  updateRetard(id: number, minutes: number): Observable<VolResponse> {
    return this.http.put<VolResponse>(`${this.base}/vols/${id}/retard`, minutes, { headers: this.headers() });
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

  supprimerReservation(id: number): Observable<ReservationResponse> {
    return this.http.delete<ReservationResponse>(`${this.base}/reservations/admin/${id}`, { headers: this.headers() });
  }

  confirmerRemboursement(id: number): Observable<ReservationResponse> {
    return this.http.put<ReservationResponse>(
      `${this.base}/annulations/${id}/confirmer-remboursement`,
      {},
      { headers: this.headers() }
    );
  }

  // ── OFFRES ────────────────────────────────────────
  getOffres(): Observable<Offre[]> {
    return this.http.get<Offre[]>(`${this.base}/offres`, { headers: this.headers() });
  }

  createOffre(offre: Offre): Observable<Offre> {
    return this.http.post<Offre>(`${this.base}/offres`, offre, { headers: this.headers() });
  }

  updateOffre(id: number, offre: Offre): Observable<Offre> {
    return this.http.put<Offre>(`${this.base}/offres/${id}`, offre, { headers: this.headers() });
  }

  deleteOffre(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/offres/${id}`, { headers: this.headers() });
  }
}