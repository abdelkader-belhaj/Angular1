// src/app/features/transport/core/services/paiement.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ApiService } from './api.service';
import { PaiementTransport, WalletTransaction } from '../models';

// Le WalletController utilise /api/wallet (hors préfixe /hypercloud)
// → on l'appelle directement via HttpClient avec l'URL complète
const WALLET_URL = 'http://localhost:8080/api/wallet';

@Injectable({ providedIn: 'root' })
export class PaiementService {
  constructor(
    private api: ApiService,
    private http: HttpClient, // pour le /api/wallet hors-préfixe
  ) {}

  // ==================== PAIEMENTS (/hypercloud/paiements) ====================

  addPaiement(
    paiement: Partial<PaiementTransport>,
  ): Observable<PaiementTransport> {
    return this.api.post<PaiementTransport>('/paiements', paiement);
  }

  getPaiementById(id: number): Observable<PaiementTransport> {
    return this.api.get<PaiementTransport>(`/paiements/${id}`);
  }

  getAllPaiements(): Observable<PaiementTransport[]> {
    return this.api.get<PaiementTransport[]>('/paiements');
  }

  // PUT /hypercloud/paiements/{id}/completer
  completePaiement(id: number): Observable<PaiementTransport> {
    return this.api.put<PaiementTransport>(`/paiements/${id}/completer`, {});
  }

  // PUT /hypercloud/paiements/{id}/rembourser
  refundPaiement(id: number): Observable<PaiementTransport> {
    return this.api.put<PaiementTransport>(`/paiements/${id}/rembourser`, {});
  }

  // GET /hypercloud/paiements/plateforme/solde
  getPlateformeSolde(): Observable<number> {
    return this.api.get<number>('/paiements/plateforme/solde');
  }

  // ==================== WALLET (/api/wallet — préfixe différent) ====================
  // Ces endpoints sont sous /api/wallet, PAS sous /hypercloud
  // → on passe par HttpClient directement

  private walletHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }

  // GET /api/wallet/chauffeur/{chauffeurId}/transactions
  getChauffeurTransactions(
    chauffeurId: number,
  ): Observable<WalletTransaction[]> {
    return this.http.get<WalletTransaction[]>(
      `${WALLET_URL}/chauffeur/${chauffeurId}/transactions`,
      { headers: this.walletHeaders() },
    );
  }

  // GET /api/wallet/agence/{agenceId}/transactions
  getAgenceTransactions(agenceId: number): Observable<WalletTransaction[]> {
    return this.http.get<WalletTransaction[]>(
      `${WALLET_URL}/agence/${agenceId}/transactions`,
      { headers: this.walletHeaders() },
    );
  }

  // GET /api/wallet/recent?limit=20
  getRecentTransactions(limit: number = 20): Observable<WalletTransaction[]> {
    return this.http.get<WalletTransaction[]>(
      `${WALLET_URL}/recent?limit=${limit}`,
      { headers: this.walletHeaders() },
    );
  }
}
