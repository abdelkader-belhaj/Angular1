// src/app/features/transport/core/services/matching.service.ts
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Matching, MatchingNotification, Course } from '../models';

@Injectable({ providedIn: 'root' })
export class MatchingService {
  // Flux des notifications de matching reçues via WebSocket
  // Alimenté par WebsocketService → components s'y abonnent
  private matchingNotificationSubject = new Subject<MatchingNotification>();
  public matchingNotification$ =
    this.matchingNotificationSubject.asObservable();

  constructor(private api: ApiService) {}

  private normalizeMatching(raw: any): Matching {
    const demande =
      raw?.demande ?? raw?.demandeCourse ?? raw?.courseRequest ?? null;
    const chauffeur = raw?.chauffeur ?? raw?.driver ?? null;

    return {
      ...raw,
      idMatching: raw?.idMatching ?? raw?.id ?? 0,
      demande,
      chauffeur,
      statut: raw?.statut ?? raw?.status ?? 'PROPOSED',
    } as Matching;
  }

  private extractMatchingList(payload: any): Matching[] {
    if (Array.isArray(payload)) {
      return payload.map((m) => this.normalizeMatching(m));
    }

    const data = payload?.data;
    if (Array.isArray(data)) {
      return data.map((m: any) => this.normalizeMatching(m));
    }

    const content = payload?.content;
    if (Array.isArray(content)) {
      return content.map((m: any) => this.normalizeMatching(m));
    }

    return [];
  }

  private markAsScopedToChauffeur(matchings: Matching[]): Matching[] {
    return matchings.map((m) => ({
      ...m,
      __scopedToChauffeur: true,
    })) as Matching[];
  }

  // ==================== CRUD ====================

  addMatching(matching: Partial<Matching>): Observable<Matching> {
    return this.api.post<Matching>('/matchings', matching);
  }

  getMatchingById(id: number): Observable<Matching> {
    return this.api.get<Matching>(`/matchings/${id}`);
  }

  getAllMatchings(): Observable<Matching[]> {
    return this.api
      .get<any>('/matchings')
      .pipe(map((payload) => this.extractMatchingList(payload)));
  }

  getMatchingsByChauffeur(chauffeurId: number): Observable<Matching[]> {
    return this.api.get<any>(`/matchings/chauffeur/${chauffeurId}/cards`).pipe(
      catchError(() =>
        this.api.get<any>(`/matchings/chauffeur/${chauffeurId}`),
      ),
      map((payload) =>
        this.markAsScopedToChauffeur(this.extractMatchingList(payload)),
      ),
    );
  }

  updateMatching(
    id: number,
    matching: Partial<Matching>,
  ): Observable<Matching> {
    return this.api.put<Matching>(`/matchings/${id}`, {
      ...matching,
      idMatching: id,
    });
  }

  deleteMatching(id: number): Observable<void> {
    return this.api.delete<void>(`/matchings/${id}`);
  }

  // ==================== WORKFLOW ====================

  // PUT /hypercloud/matchings/{id}/accepter
  // Retourne la Course créée (pas le Matching)
  acceptMatching(matchingId: number): Observable<Course> {
    return this.api.put<Course>(`/matchings/${matchingId}/accepter`, {});
  }

  // PUT /hypercloud/matchings/{id}/rejeter
  rejectMatching(matchingId: number): Observable<Matching> {
    return this.api.put<Matching>(`/matchings/${matchingId}/rejeter`, {});
  }

  // ==================== NOTIFICATION LOCAL (depuis WS) ====================
  // Appelé par WebsocketService quand il reçoit un message de type MATCHING

  pushMatchingNotification(notification: MatchingNotification): void {
    this.matchingNotificationSubject.next(notification);
  }
}
