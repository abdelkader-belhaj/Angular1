// src/app/features/transport/core/services/demande-course.service.ts
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { DemandeCourse, DemandeStatus } from '../models';

export interface EstimatePriceRequest {
  departLatitude: number;
  departLongitude: number;
  arriveeLatitude: number;
  arriveeLongitude: number;
  typeVehiculeDemande: string;
}

export interface EstimatePriceResponse {
  prixEstimeCalcule: number;
  distanceKm: number;
  dureeEstimeeMinutes: number;
}

export interface DemandePreauthResponse {
  demandeId: number;
  authorized: boolean;
  holdAmount: number;
  authorizationRef?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class DemandeCourseService {
  private demandeActiveSubject = new BehaviorSubject<DemandeCourse | null>(
    null,
  );
  public demandeActive$ = this.demandeActiveSubject.asObservable();

  constructor(private api: ApiService) {}

  private firstFiniteNumber(...values: Array<unknown>): number | undefined {
    for (const value of values) {
      const numericValue = Number(value);
      if (value != null && Number.isFinite(numericValue)) {
        return numericValue;
      }
    }

    return undefined;
  }

  private normalizeCourse(rawCourse: any): any {
    if (!rawCourse) {
      return rawCourse;
    }

    const course = { ...rawCourse };
    if (course.idCourse == null && course.id != null) {
      course.idCourse = course.id;
    }

    return course;
  }

  private unwrapDemandePayload(payload: any): any {
    if (payload == null) {
      return payload;
    }

    if (payload.demande) {
      return payload.demande;
    }

    if (payload.data?.demande) {
      return payload.data.demande;
    }

    if (payload.data && !Array.isArray(payload.data)) {
      return payload.data;
    }

    return payload;
  }

  private normalizeDemandeList(payload: any): DemandeCourse[] {
    if (Array.isArray(payload)) {
      return payload.map((d) => this.normalizeDemande(d));
    }

    if (Array.isArray(payload?.data)) {
      return payload.data.map((d: any) => this.normalizeDemande(d));
    }

    if (Array.isArray(payload?.content)) {
      return payload.content.map((d: any) => this.normalizeDemande(d));
    }

    return [];
  }

  /** Unifie `id` / `idDemande` et le cours imbriqué renvoyé par Spring. */
  private normalizeDemande(raw: any): DemandeCourse {
    const unwrapped = this.unwrapDemandePayload(raw);
    if (unwrapped == null) return unwrapped;

    const id = unwrapped.idDemande ?? unwrapped.id ?? unwrapped.id_demande;
    const course = this.normalizeCourse(unwrapped.course ?? raw?.course);
    const prixEstime = this.firstFiniteNumber(
      unwrapped.prixEstime,
      unwrapped.prixEstimeCalcule,
      raw?.prixEstime,
      raw?.prixEstimeCalcule,
      raw?.estimatedPrice,
      raw?.montant,
      course?.prixEstime,
    );

    return {
      ...unwrapped,
      idDemande: id,
      id,
      prixEstime: prixEstime ?? unwrapped.prixEstime,
      course,
    };
  }

  // ==================== CRUD ====================
  // POST /hypercloud/demandes-courses
  // → transportationBookingService.createBookingRequest()
  // → crée la demande + calcule OSRM + passe en PENDING

  createDemande(demande: Partial<DemandeCourse>): Observable<DemandeCourse> {
    return this.api.post<DemandeCourse>('/demandes-courses', demande).pipe(
      map((d) => this.normalizeDemande(d)),
      tap((d) => this.demandeActiveSubject.next(d)),
    );
  }

  estimatePrice(
    payload: EstimatePriceRequest,
  ): Observable<EstimatePriceResponse> {
    return this.api
      .post<any>('/demandes-courses/estimate', payload)
      .pipe(map((response) => response?.data ?? response));
  }

  getDemandeById(id: number): Observable<DemandeCourse> {
    return this.api.get<any>(`/demandes-courses/${id}`).pipe(
      map((d) => this.normalizeDemande(d)),
      tap((d) => this.demandeActiveSubject.next(d)),
    );
  }

  getAllDemandes(): Observable<DemandeCourse[]> {
    return this.api
      .get<any>('/demandes-courses')
      .pipe(map((payload) => this.normalizeDemandeList(payload)));
  }

  // GET /hypercloud/demandes-courses/client/{clientId}
  getDemandesByClient(clientId: number): Observable<DemandeCourse[]> {
    return this.api
      .get<any>(`/demandes-courses/client/${clientId}`)
      .pipe(map((payload) => this.normalizeDemandeList(payload)));
  }

  // GET /hypercloud/demandes-courses/statut/{statut}
  getDemandesByStatut(statut: DemandeStatus): Observable<DemandeCourse[]> {
    return this.api
      .get<any>(`/demandes-courses/statut/${statut}`)
      .pipe(map((payload) => this.normalizeDemandeList(payload)));
  }

  deleteDemande(id: number): Observable<void> {
    return this.api.delete<void>(`/demandes-courses/${id}`);
  }

  // ==================== WORKFLOW ====================

  // PUT /hypercloud/demandes-courses/{id}/matching
  // → lance le broadcast aux chauffeurs disponibles
  startMatching(demandeId: number): Observable<DemandeCourse> {
    return this.api
      .put<any>(`/demandes-courses/${demandeId}/matching`, {})
      .pipe(
        catchError(() =>
          this.api.put<any>(
            `/demandes-courses/${demandeId}/start-matching`,
            {},
          ),
        ),
      )
      .pipe(
        map((d) => this.normalizeDemande(d)),
        tap((d) => this.demandeActiveSubject.next(d)),
      );
  }

  preAuthorizePayment(
    demandeId: number,
    holdAmount: number,
    paymentMethodRef?: string,
  ): Observable<DemandePreauthResponse> {
    return this.api.post<DemandePreauthResponse>(
      `/demandes-courses/${demandeId}/paiement/preautoriser`,
      {
        holdAmount,
        paymentMethodRef: paymentMethodRef ?? 'CARD',
      },
    );
  }

  preAuthorizePenalty(
    demandeId: number,
    holdAmount?: number,
    paymentMethodRef?: string,
  ): Observable<DemandePreauthResponse> {
    return this.api.post<DemandePreauthResponse>(
      `/demandes-courses/${demandeId}/paiement/preautoriser-penalty`,
      {
        holdAmount,
        paymentMethodRef: paymentMethodRef ?? 'CARD',
      },
    );
  }

  // PUT /hypercloud/demandes-courses/{id}/statut/{statut}
  updateStatut(
    demandeId: number,
    statut: DemandeStatus,
  ): Observable<DemandeCourse> {
    return this.api
      .put<DemandeCourse>(`/demandes-courses/${demandeId}/statut/${statut}`, {})
      .pipe(
        map((d) => this.normalizeDemande(d)),
        tap((d) => this.demandeActiveSubject.next(d)),
      );
  }

  confirmAcceptedByClient(demandeId: number): Observable<DemandeCourse> {
    return this.api
      .put<any>(`/demandes-courses/${demandeId}/confirmer-client`, {})
      .pipe(
        map((d) => this.normalizeDemande(d)),
        tap((d) => this.demandeActiveSubject.next(d)),
      );
  }

  cancelAcceptedByClient(demandeId: number): Observable<DemandeCourse> {
    return this.api
      .put<any>(`/demandes-courses/${demandeId}/confirmer-client/annuler`, {})
      .pipe(
        map((d) => this.normalizeDemande(d)),
        tap((d) => this.demandeActiveSubject.next(d)),
      );
  }

  // ==================== HELPERS ====================

  getDemandeActive(): DemandeCourse | null {
    return this.demandeActiveSubject.value;
  }

  clearDemandeActive(): void {
    this.demandeActiveSubject.next(null);
  }
}
