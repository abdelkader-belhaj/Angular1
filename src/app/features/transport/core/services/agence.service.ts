// src/app/features/transport/core/services/agence.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, map, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from './api.service';
import { AgenceLocation } from '../models'; // à créer plus tard si besoin

@Injectable({ providedIn: 'root' })
export class AgenceService {
  constructor(private api: ApiService) {}

  createAgence(payload: {
    nomAgence: string;
    telephone?: string;
    adresse?: string;
    utilisateur: { id: number };
  }): Observable<AgenceLocation> {
    return this.api.post<AgenceLocation>('/agences-location', payload);
  }

  getAgenceById(id: number): Observable<any> {
    return this.api.get(`/agences-location/${id}`);
  }

  getAgenceByUtilisateurId(utilisateurId: number): Observable<any> {
    return this.api.get(`/agences-location/utilisateur/${utilisateurId}`);
  }

  getAllAgences(): Observable<any[]> {
    return this.api.get<any[]>('/agences-location');
  }

  resolveAgenceIdByUserId(userId: number): Observable<number | null> {
    return this.getAgenceByUtilisateurId(userId).pipe(
      map((agence) => Number(agence?.idAgence ?? 0) || null),
      catchError((error) => {
        if (this.isServerUnavailableError(error)) {
          return throwError(() => error);
        }

        return this.getAllAgences().pipe(
          map((agences) => {
            const current = agences.find((a) => {
              const ownerId = Number(
                a?.utilisateur?.id ??
                  a?.utilisateurId ??
                  a?.id_utilisateur ??
                  0,
              );
              return ownerId === userId;
            });

            const agenceId = Number(current?.idAgence ?? 0);
            return Number.isFinite(agenceId) && agenceId > 0 ? agenceId : null;
          }),
          catchError(() => of(null)),
        );
      }),
    );
  }

  hasAgenceProfile(userId: number): Observable<boolean> {
    return this.resolveAgenceIdByUserId(userId).pipe(map((id) => !!id));
  }

  private isServerUnavailableError(error: unknown): boolean {
    if (error instanceof HttpErrorResponse) {
      return error.status === 0;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('serveur inaccessible') ||
        message.includes('unknown error') ||
        message.includes('err_connection_refused')
      );
    }

    return false;
  }
}
