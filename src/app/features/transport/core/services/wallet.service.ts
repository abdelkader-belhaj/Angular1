// src/app/features/transport/core/services/wallet.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from '../../../../services/auth.service';
import { WalletTransaction } from '../models';

const WALLET_URL = 'http://localhost:8080/api/wallet';

@Injectable({ providedIn: 'root' })
export class WalletService {
  constructor(
    private api: ApiService,
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  private walletHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  // Historique chauffeur
  getChauffeurTransactions(
    chauffeurId: number,
  ): Observable<WalletTransaction[]> {
    return this.http
      .get<
        WalletTransaction[]
      >(`${WALLET_URL}/chauffeur/${chauffeurId}/transactions`, { headers: this.walletHeaders() })
      .pipe(
        catchError((error) => {
          const status = Number(error?.status ?? 0);
          const userId = Number(this.authService.getCurrentUser()?.id ?? 0);
          const canFallback =
            (status === 400 || status === 404) &&
            Number.isFinite(userId) &&
            userId > 0;

          if (!canFallback) {
            return throwError(() => error);
          }

          return this.http.get<WalletTransaction[]>(
            `${WALLET_URL}/chauffeur/utilisateur/${userId}/transactions`,
            { headers: this.walletHeaders() },
          );
        }),
      );
  }

  // Historique agence
  getAgenceTransactions(agenceId: number): Observable<WalletTransaction[]> {
    return this.http.get<WalletTransaction[]>(
      `${WALLET_URL}/agence/${agenceId}/transactions`,
      { headers: this.walletHeaders() },
    );
  }

  getRecentTransactions(limit: number = 20): Observable<WalletTransaction[]> {
    return this.http.get<WalletTransaction[]>(
      `${WALLET_URL}/recent?limit=${limit}`,
      { headers: this.walletHeaders() },
    );
  }
}
