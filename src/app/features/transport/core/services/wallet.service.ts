// src/app/features/transport/core/services/wallet.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from '../../../../services/auth.service';
import { WalletTransaction } from '../models';

@Injectable({ providedIn: 'root' })
export class WalletService {
  constructor(
    private readonly api: ApiService,
    private readonly http: HttpClient,
    private readonly authService: AuthService,
  ) {}

  /**
   * Base `/api/wallet` sur le même hôte que `/hypercloud` (voir ApiService).
   * Le contrôleur wallet est souvent exposé hors préfixe hypercloud.
   */
  private resolveWalletRoot(): string {
    const apiUrl = this.api.getApiUrl().replace(/\/+$/, '');
    const origin = apiUrl.replace(/\/hypercloud$/i, '');
    return `${origin}/api/wallet`;
  }

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

  /**
   * Accepte un tableau brut ou une enveloppe Spring (content, data, transactions…).
   */
  private normalizeWalletList(payload: unknown): WalletTransaction[] {
    if (Array.isArray(payload)) {
      return payload as WalletTransaction[];
    }
    if (!payload || typeof payload !== 'object') {
      return [];
    }
    const raw = payload as Record<string, unknown>;
    const candidates = [
      raw['content'],
      raw['data'],
      raw['transactions'],
      raw['items'],
      raw['results'],
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate as WalletTransaction[];
      }
    }
    return [];
  }

  private getAgenceTransactionsFromHypercloud(
    agenceId: number,
  ): Observable<WalletTransaction[]> {
    return this.api
      .getLenientJson<unknown>(
        `/wallet/agence/${agenceId}/transactions`,
        undefined,
        [] as unknown[],
      )
      .pipe(
        map((body) => this.normalizeWalletList(body)),
        catchError(() => of([])),
      );
  }

  // Historique chauffeur
  getChauffeurTransactions(
    chauffeurId: number,
  ): Observable<WalletTransaction[]> {
    const root = this.resolveWalletRoot();
    return this.http
      .get<unknown>(`${root}/chauffeur/${chauffeurId}/transactions`, {
        headers: this.walletHeaders(),
      })
      .pipe(
        map((body) => this.normalizeWalletList(body)),
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

          return this.http
            .get<unknown>(`${root}/chauffeur/utilisateur/${userId}/transactions`, {
              headers: this.walletHeaders(),
            })
            .pipe(map((body) => this.normalizeWalletList(body)));
        }),
      );
  }

  // Historique agence
  getAgenceTransactions(agenceId: number): Observable<WalletTransaction[]> {
    const root = this.resolveWalletRoot();
    return this.http
      .get<unknown>(`${root}/agence/${agenceId}/transactions`, {
        headers: this.walletHeaders(),
      })
      .pipe(
        map((body) => this.normalizeWalletList(body)),
        catchError(() => this.getAgenceTransactionsFromHypercloud(agenceId)),
      );
  }

  getRecentTransactions(limit: number = 20): Observable<WalletTransaction[]> {
    const root = this.resolveWalletRoot();
    return this.http
      .get<unknown>(`${root}/recent?limit=${limit}`, {
        headers: this.walletHeaders(),
      })
      .pipe(map((body) => this.normalizeWalletList(body)));
  }
}
