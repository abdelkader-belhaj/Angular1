// src/app/features/transport/core/services/location.service.ts
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, tap, switchMap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { HttpParams } from '@angular/common/http';
import {
  ReservationLocation,
  AgenceLocation,
  VehiculeAgence,
  PaiementMethode,
} from '../models';

export type LocationExtensionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LocationExtensionRequest {
  reservationId: number;
  extraDays: number;
  reason: string;
  requestedAt: string;
  status: LocationExtensionStatus;
  proposedEndDate: string;
  proposedTotalPrice: number;
  proposedDepositAmount: number;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewReason?: string;
}

export interface ReservationQuote {
  days: number;
  dailyRate: number;
  totalPrice: number;
  advanceAmount: number;
  depositAmount: number;
}

export interface EtatDesLieuxPhotoDto {
  url: string;
  type: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly etatDesLieuxPhotosCachePrefix =
    'hypercloud:etat-lieux-photos:';
  private readonly extensionRequestCachePrefix =
    'hypercloud:location-extension:';

  private reservationActiveSubject =
    new BehaviorSubject<ReservationLocation | null>(null);
  public reservationActive$ = this.reservationActiveSubject.asObservable();

  constructor(private api: ApiService) {}

  // ==================== AGENCES ====================
  createAgence(agence: Partial<AgenceLocation>): Observable<AgenceLocation> {
    return this.api.post<AgenceLocation>('/agences-location', agence);
  }

  getAgenceById(id: number): Observable<AgenceLocation> {
    return this.api.get<AgenceLocation>(`/agences-location/${id}`);
  }

  getAllAgences(): Observable<AgenceLocation[]> {
    return this.api.getLenientJson<AgenceLocation[]>('/agences-location');
  }

  resolveAgencyByUserId(userId: number): Observable<AgenceLocation | null> {
    return this.getAllAgences().pipe(
      tap((agences) => {
        console.info('[LOCATION][AGENCE] resolveAgencyByUserId input', {
          expectedUserId: userId,
          agencesCount: agences.length,
          agences: agences.map((agence: any) => ({
            idAgence: agence?.idAgence,
            nomAgence: agence?.nomAgence,
            utilisateurId:
              agence?.utilisateur?.id ??
              agence?.utilisateurId ??
              agence?.idUtilisateur ??
              agence?.id_utilisateur ??
              null,
          })),
        });
      }),
      map((agences) => this.findAgencyByUserId(agences, userId)),
      switchMap((matchedFromAll) => {
        if (matchedFromAll) {
          return of(matchedFromAll);
        }

        return this.getActiveAgences().pipe(
          tap((agences) => {
            console.info('[LOCATION][AGENCE] fallback active agencies', {
              expectedUserId: userId,
              agencesCount: agences.length,
            });
          }),
          map((agences) => this.findAgencyByUserId(agences, userId)),
          switchMap((matchedFromActive) => {
            if (matchedFromActive) {
              return of(matchedFromActive);
            }

            return this.resolveAgencyFromDirectEndpoints(userId);
          }),
          catchError((error) => {
            console.warn(
              '[LOCATION][AGENCE] active agencies fallback failed, trying direct endpoint',
              error,
            );
            return this.resolveAgencyFromDirectEndpoints(userId);
          }),
        );
      }),
      tap((agency) => {
        console.info('[LOCATION][AGENCE] resolveAgencyByUserId result', {
          expectedUserId: userId,
          matchedAgencyId: agency?.idAgence ?? null,
          matchedAgencyName: agency?.nomAgence ?? null,
        });
      }),
    );
  }

  private resolveAgencyFromDirectEndpoints(
    userId: number,
  ): Observable<AgenceLocation | null> {
    const candidates = [
      `/agences-location/utilisateur/${userId}`,
      `/agences/utilisateur/${userId}`,
    ];

    return this.tryResolveAgencyFromPaths(candidates, userId);
  }

  private tryResolveAgencyFromPaths(
    paths: string[],
    userId: number,
  ): Observable<AgenceLocation | null> {
    if (paths.length === 0) {
      return of(null);
    }

    const [path, ...rest] = paths;
    return this.api.getLenientJson<any>(path).pipe(
      map((payload) => this.normalizeAgencyPayload(payload, userId)),
      tap((agency) => {
        console.info('[LOCATION][AGENCE] direct endpoint attempt', {
          path,
          expectedUserId: userId,
          matchedAgencyId: agency?.idAgence ?? null,
        });
      }),
      switchMap((agency) => {
        if (agency) {
          return of(agency);
        }
        return this.tryResolveAgencyFromPaths(rest, userId);
      }),
      catchError((error) => {
        console.warn('[LOCATION][AGENCE] direct endpoint failed', {
          path,
          expectedUserId: userId,
          error,
        });
        return this.tryResolveAgencyFromPaths(rest, userId);
      }),
    );
  }

  private normalizeAgencyPayload(
    payload: any,
    expectedUserId: number,
  ): AgenceLocation | null {
    const rawCandidates = Array.isArray(payload)
      ? payload
      : [payload?.agence ?? payload];

    for (const raw of rawCandidates) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }

      const normalized: AgenceLocation & Record<string, any> = {
        ...(raw as any),
        idAgence:
          raw.idAgence ?? raw.id_agence ?? raw.agenceId ?? raw.id ?? null,
        utilisateur:
          raw.utilisateur && typeof raw.utilisateur === 'object'
            ? raw.utilisateur
            : undefined,
        utilisateurId:
          raw.utilisateurId ??
          raw.idUtilisateur ??
          raw.id_utilisateur ??
          raw.userId ??
          raw.utilisateur?.id ??
          null,
      };

      if (!normalized.utilisateur && normalized['utilisateurId']) {
        normalized.utilisateur = { id: normalized['utilisateurId'] } as any;
      }

      const linked = this.extractAgencyUserId(normalized);
      if (linked && linked === this.toNumericId(expectedUserId)) {
        return normalized;
      }
    }

    return null;
  }

  findAgencyByUserId(
    agences: AgenceLocation[],
    userId: number,
  ): AgenceLocation | null {
    const expectedUserId = this.toNumericId(userId);
    if (!expectedUserId) {
      console.warn('[LOCATION][AGENCE] expected user id invalid', { userId });
      return null;
    }

    for (const agence of agences as Array<
      AgenceLocation & Record<string, any>
    >) {
      const linkedUserId = this.extractAgencyUserId(agence);
      if (linkedUserId && linkedUserId === expectedUserId) {
        return agence;
      }
    }

    console.warn('[LOCATION][AGENCE] no agency matched expected user', {
      expectedUserId,
      candidates: agences.map((agence: any) => ({
        idAgence: agence?.idAgence,
        linkedUserId: this.extractAgencyUserId(agence),
      })),
    });

    return null;
  }

  getActiveAgences(): Observable<AgenceLocation[]> {
    return this.api.getLenientJson<AgenceLocation[]>(
      '/agences-location/actives',
    );
  }

  updateAgence(
    id: number,
    agence: Partial<AgenceLocation>,
  ): Observable<AgenceLocation> {
    return this.api.put<AgenceLocation>(`/agences-location/${id}`, {
      ...agence,
      idAgence: id,
    });
  }

  deleteAgence(id: number): Observable<void> {
    return this.api.delete<void>(`/agences-location/${id}`);
  }

  approveAgence(id: number): Observable<AgenceLocation> {
    return this.api.put<AgenceLocation>(
      `/agences-location/${id}/approuver`,
      {},
    );
  }

  deactivateAgence(id: number): Observable<AgenceLocation> {
    return this.api.put<AgenceLocation>(
      `/agences-location/${id}/desactiver`,
      {},
    );
  }

  // ==================== VÉHICULES D'AGENCE ====================
  addVehiculeAgence(
    vehicule: Partial<VehiculeAgence>,
  ): Observable<VehiculeAgence> {
    return this.api.post<VehiculeAgence>('/vehicules-agence', vehicule);
  }

  getVehiculeAgenceById(id: number): Observable<VehiculeAgence> {
    return this.api
      .get<VehiculeAgence>(`/vehicules-agence/${id}`)
      .pipe(map((v) => this.normalizeVehiculeAgencePhotos(v)));
  }

  getVehiculesByAgence(agenceId: number): Observable<VehiculeAgence[]> {
    return this.api
      .getLenientJson<
        VehiculeAgence[]
      >(`/vehicules-agence/agence/${agenceId}`, undefined, [])
      .pipe(
        map((list) =>
          (list || []).map((v) => this.normalizeVehiculeAgencePhotos(v)),
        ),
      );
  }

  uploadVehiculeAgencePhotos(
    vehiculeId: number,
    files: File[],
  ): Observable<VehiculeAgence> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file, file.name);
    }

    return this.api
      .postMultipart<VehiculeAgence>(
        `/vehicules-agence/${vehiculeId}/photos`,
        formData,
      )
      .pipe(map((v) => this.normalizeVehiculeAgencePhotos(v)));
  }

  removeVehiculeAgencePhoto(
    vehiculeId: number,
    photoUrl: string,
  ): Observable<VehiculeAgence> {
    const params = new HttpParams().set('photoUrl', photoUrl);
    return this.api
      .deleteWithParams<VehiculeAgence>(
        `/vehicules-agence/${vehiculeId}/photos`,
        params,
      )
      .pipe(map((v) => this.normalizeVehiculeAgencePhotos(v)));
  }

  getPublicUploadUrl(path: string): string {
    if (!path) {
      return '';
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
    const withoutPrefix = normalized.startsWith('uploads/')
      ? normalized.slice('uploads/'.length)
      : normalized;

    return `${this.api.getApiUrl()}/uploads/${withoutPrefix}`;
  }

  updateVehiculeAgence(
    id: number,
    vehicule: Partial<VehiculeAgence>,
  ): Observable<VehiculeAgence> {
    return this.api.put<VehiculeAgence>(`/vehicules-agence/${id}`, {
      ...vehicule,
      idVehiculeAgence: id,
    });
  }

  deleteVehiculeAgence(id: number): Observable<void> {
    return this.api.delete<void>(`/vehicules-agence/${id}`);
  }

  buildReservationQuote(
    vehicle: VehiculeAgence,
    dateDebut: string,
    dateFin: string,
  ): ReservationQuote {
    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date(dateDebut);
    const end = new Date(dateFin);
    const days =
      Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
        ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs))
        : 0;

    const explicitDailyRate = Number(vehicle?.prixJour || 0);
    const legacyDailyRateCandidates = [
      Number(vehicle?.prixKm || 0),
      Number(vehicle?.prixMinute || 0) * 60,
      45,
    ].filter((value) => Number.isFinite(value) && value > 0);

    const dailyRate = this.roundCurrency(
      explicitDailyRate > 0
        ? explicitDailyRate
        : legacyDailyRateCandidates.length
          ? Math.max(...legacyDailyRateCandidates)
          : 45,
    );
    const totalPrice = this.roundCurrency(days * dailyRate);
    const advanceAmount = this.roundCurrency(totalPrice * 0.3);
    // Deposit is strictly 10% of vehicle price.
    const vehiclePrice = Number(vehicle?.prixVehicule || 0);
    const depositAmount = this.roundCurrency(
      vehiclePrice > 0 ? vehiclePrice * 0.1 : 0,
    );

    return {
      days,
      dailyRate,
      totalPrice,
      advanceAmount,
      depositAmount,
    };
  }

  // ==================== RÉSERVATIONS ====================
  createReservation(
    reservation: Partial<ReservationLocation>,
  ): Observable<ReservationLocation> {
    const payload: Partial<ReservationLocation> & Record<string, any> = {
      ...reservation,
    };

    const note = String((reservation as any)?.note ?? '').trim();
    if (note) {
      payload.note = note;
      payload['notes'] = note;
      payload['noteClient'] = note;
      payload['clientNote'] = note;
      payload['commentaire'] = note;
      payload['messageClient'] = note;
    }

    return this.api
      .post<ReservationLocation>('/reservations-location', payload)
      .pipe(tap((r) => this.reservationActiveSubject.next(r)));
  }

  getReservationById(id: number): Observable<ReservationLocation> {
    return this.api
      .get<ReservationLocation>(`/reservations-location/${id}`)
      .pipe(tap((r) => this.reservationActiveSubject.next(r)));
  }

  getReservationsByClient(clientId: number): Observable<ReservationLocation[]> {
    return this.api.get<ReservationLocation[]>(
      `/reservations-location/client/${clientId}`,
    );
  }

  getReservationsByAgence(agenceId: number): Observable<ReservationLocation[]> {
    return this.api.getLenientJson<ReservationLocation[]>(
      `/reservations-location/agence/${agenceId}`,
      undefined,
      [],
    );
  }

  updateReservation(
    id: number,
    data: Partial<ReservationLocation>,
  ): Observable<ReservationLocation> {
    return this.api
      .put<ReservationLocation>(`/reservations-location/${id}`, {
        ...data,
        idReservation: id,
      })
      .pipe(tap((r) => this.reservationActiveSubject.next(r)));
  }

  deleteReservation(id: number): Observable<void> {
    return this.api.delete<void>(`/reservations-location/${id}`);
  }

  // ==================== WORKFLOW RÉSERVATION ====================
  confirmReservation(id: number): Observable<ReservationLocation> {
    return this.api
      .put<ReservationLocation>(`/reservations-location/${id}/confirmer`, {})
      .pipe(tap((r) => this.reservationActiveSubject.next(r)));
  }

  cancelReservation(
    id: number,
    cancelledBy: 'CLIENT' | 'AGENCE' | 'SYSTEM' = 'CLIENT',
    reason?: string,
  ): Observable<ReservationLocation> {
    let path = `/reservations-location/${id}/annuler?cancelledBy=${encodeURIComponent(cancelledBy)}`;
    const normalizedReason = String(reason || '').trim();
    if (normalizedReason) {
      path += `&reason=${encodeURIComponent(normalizedReason)}`;
    }

    return this.api
      .put<ReservationLocation>(path, {})
      .pipe(tap(() => this.reservationActiveSubject.next(null)));
  }

  // ✅ CORRIGÉ : utilisation de l'enum PaiementMethode
  completeReservation(
    id: number,
    methode: PaiementMethode = PaiementMethode.CARD,
    paymentIntentId?: string,
  ): Observable<ReservationLocation> {
    let path = `/reservations-location/${id}/complete?methode=${encodeURIComponent(methode)}`;
    const intent = String(paymentIntentId || '').trim();
    if (intent) {
      path += `&paymentIntentId=${encodeURIComponent(intent)}`;
    }

    return this.api
      .post<ReservationLocation>(path, {})
      .pipe(tap((r) => this.reservationActiveSubject.next(r)));
  }

  payReservationAdvance(
    id: number,
    methode: PaiementMethode = PaiementMethode.CARD,
    paymentIntentId?: string,
  ): Observable<ReservationLocation> {
    let path = `/reservations-location/${id}/paiement/avance?methode=${encodeURIComponent(methode)}`;
    const intent = String(paymentIntentId || '').trim();
    if (intent) {
      path += `&paymentIntentId=${encodeURIComponent(intent)}`;
    }

    return this.api
      .post<ReservationLocation>(path, {})
      .pipe(tap((r) => this.reservationActiveSubject.next(r)));
  }

  holdDeposit(
    id: number,
    mode: 'PHYSICAL' | 'ONLINE' = 'PHYSICAL',
  ): Observable<ReservationLocation> {
    return this.api
      .post<ReservationLocation>(
        `/reservations-location/${id}/hold-deposit?mode=${encodeURIComponent(mode)}`,
        {},
      )
      .pipe(tap((r) => this.reservationActiveSubject.next(r)));
  }

  refundDeposit(
    id: number,
    methode: PaiementMethode = PaiementMethode.CARD,
    paymentIntentId?: string,
  ): Observable<ReservationLocation> {
    let path = `/reservations-location/${id}/refund-deposit?methode=${encodeURIComponent(methode)}`;
    const intent = String(paymentIntentId || '').trim();
    if (intent) {
      path += `&paymentIntentId=${encodeURIComponent(intent)}`;
    }

    return this.api
      .post<ReservationLocation>(path, {})
      .pipe(tap((r) => this.reservationActiveSubject.next(r)));
  }

  // ==================== KYC / SIGNATURE / ÉTAT DES LIEUX ====================
  uploadLicense(
    id: number,
    numeroPermis: string,
    licenseImageUrl: string,
    expiryDate: string,
    prenom?: string,
    nom?: string,
    dateNaiss?: string,
  ): Observable<ReservationLocation> {
    const payload: Record<string, string> = {
      numeroPermis,
      licenseImageUrl,
      expiryDate,
    };

    if (prenom) {
      payload['prenom'] = prenom;
    }

    if (nom) {
      payload['nom'] = nom;
    }

    if (dateNaiss) {
      payload['dateNaiss'] = dateNaiss;
    }

    return this.api.postForm<ReservationLocation>(
      `/reservations-location/${id}/upload-license`,
      payload,
    );
  }

  approveLicense(
    id: number,
    approved: boolean,
    reason?: string,
  ): Observable<ReservationLocation> {
    let path = `/reservations-location/${id}/approve-license?approved=${approved}`;
    if (reason) path += `&reason=${encodeURIComponent(reason)}`;
    return this.api.post<ReservationLocation>(path, {});
  }

  signContract(
    id: number,
    base64Signature: string,
    signedBy: string,
  ): Observable<ReservationLocation> {
    return this.api.postForm<ReservationLocation>(
      `/reservations-location/${id}/sign-contract`,
      {
        base64Signature,
        signedBy,
      },
    );
  }

  checkIn(id: number, photoUrls: string[]): Observable<string> {
    return this.api.postText(
      `/reservations-location/${id}/check-in`,
      photoUrls,
    );
  }

  checkOut(id: number, photoUrls: string[]): Observable<string> {
    return this.api.postText(
      `/reservations-location/${id}/check-out`,
      photoUrls,
    );
  }

  getEtatDesLieuxPhotosByReservation(
    reservationId: number,
  ): Observable<EtatDesLieuxPhotoDto[]> {
    if (!reservationId) {
      return of([]);
    }

    const candidatePaths = [
      `/reservations-location/${reservationId}/etat-des-lieux-photos`,
      `/reservations-location/${reservationId}/etat-lieux/photos`,
      `/etat-des-lieux-photos/reservation/${reservationId}`,
      `/etat-des-lieux-photos/reservations/${reservationId}`,
    ];

    return this.tryResolveEtatDesLieuxPhotos(candidatePaths).pipe(
      map((photos) =>
        photos.filter(
          (photo, index, list) =>
            list.findIndex(
              (candidate) =>
                candidate.url === photo.url && candidate.type === photo.type,
            ) === index,
        ),
      ),
    );
  }

  checkAvailability(
    vehiculeAgenceId: number,
    start: string,
    end: string,
  ): Observable<boolean> {
    return this.api.get<boolean>(
      `/reservations-location/availability?vehiculeAgenceId=${vehiculeAgenceId}&start=${start}&end=${end}`,
    );
  }

  getContractPdfUrl(id: number): string {
    return `http://localhost:8080/hypercloud/reservations-location/${id}/contract-pdf`;
  }

  getFinalInvoicePdfUrl(id: number): string {
    return `http://localhost:8080/hypercloud/reservations-location/${id}/final-invoice-pdf`;
  }

  downloadContractPdf(id: number): void {
    this.api.getBlob(`/reservations-location/${id}/contract-pdf`).subscribe({
      next: (pdfBlob) => {
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `contrat_${id}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
      },
      error: (error) => {
        console.error('[LOCATION][PDF] download failed', { id, error });
      },
    });
  }

  downloadFinalInvoicePdf(id: number): void {
    this.api
      .getBlob(`/reservations-location/${id}/final-invoice-pdf`)
      .subscribe({
        next: (pdfBlob) => {
          const blobUrl = URL.createObjectURL(pdfBlob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `facture_location_${id}.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(blobUrl);
        },
        error: (error) => {
          console.error('[LOCATION][INVOICE] download failed', { id, error });
        },
      });
  }

  getLicenseImageBlob(id: number): Observable<Blob> {
    return this.api.getBlob(`/reservations-location/${id}/license-image`);
  }

  // ==================== GEOLOCATION ====================
  getCurrentPosition(): Observable<GeolocationPosition> {
    return from(
      new Promise<GeolocationPosition>((resolve, reject) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        } else {
          reject(new Error('Geolocation not supported'));
        }
      }),
    );
  }

  // ==================== HELPERS ====================
  getReservationActive(): ReservationLocation | null {
    return this.reservationActiveSubject.value;
  }

  buildRentalExtensionProposal(
    reservation: ReservationLocation,
    extraDays: number,
  ): Pick<
    LocationExtensionRequest,
    'proposedEndDate' | 'proposedTotalPrice' | 'proposedDepositAmount'
  > {
    const safeExtraDays = Math.max(1, Math.floor(extraDays || 0));
    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date(reservation.dateDebut);
    const end = new Date(reservation.dateFin);

    const baseDurationDays =
      Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
        ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs))
        : 1;

    const safeBasePrice = Number(reservation.prixTotal || 0);
    const dailyRate = safeBasePrice > 0 ? safeBasePrice / baseDurationDays : 0;
    const extendedDurationDays = baseDurationDays + safeExtraDays;
    const proposedTotalPrice = this.roundCurrency(
      dailyRate * extendedDurationDays,
    );

    const currentDeposit = Number(
      reservation.depositAmount ?? this.roundCurrency(safeBasePrice * 0.1),
    );
    const proposedDepositAmount = this.roundCurrency(
      currentDeposit * (extendedDurationDays / baseDurationDays),
    );

    const newEnd = Number.isFinite(end.getTime()) ? new Date(end) : new Date();
    newEnd.setDate(newEnd.getDate() + safeExtraDays);

    return {
      proposedEndDate: newEnd.toISOString(),
      proposedTotalPrice,
      proposedDepositAmount,
    };
  }

  requestRentalExtension(
    reservation: ReservationLocation,
    extraDays: number,
    reason: string,
  ): LocationExtensionRequest {
    const proposal = this.buildRentalExtensionProposal(reservation, extraDays);
    const request: LocationExtensionRequest = {
      reservationId: reservation.idReservation,
      extraDays: Math.max(1, Math.floor(extraDays || 0)),
      reason: String(reason || '').trim(),
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
      ...proposal,
    };

    this.saveRentalExtensionRequest(request);
    return request;
  }

  updateRentalExtensionStatus(
    reservationId: number,
    status: LocationExtensionStatus,
    reviewedBy: string,
    reviewReason = '',
  ): LocationExtensionRequest | null {
    const current = this.getRentalExtensionRequest(reservationId);
    if (!current) {
      return null;
    }

    const updated: LocationExtensionRequest = {
      ...current,
      status,
      reviewedBy: String(reviewedBy || '').trim() || 'Agence',
      reviewedAt: new Date().toISOString(),
      reviewReason: String(reviewReason || '').trim(),
    };

    this.saveRentalExtensionRequest(updated);
    return updated;
  }

  saveRentalExtensionRequest(request: LocationExtensionRequest): void {
    if (!request?.reservationId) {
      return;
    }

    try {
      localStorage.setItem(
        this.getExtensionRequestCacheKey(request.reservationId),
        JSON.stringify(request),
      );
    } catch {
      // Ignore storage errors.
    }
  }

  getRentalExtensionRequest(
    reservationId: number,
  ): LocationExtensionRequest | null {
    if (!reservationId) {
      return null;
    }

    try {
      const raw = localStorage.getItem(
        this.getExtensionRequestCacheKey(reservationId),
      );
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as LocationExtensionRequest;
      if (!parsed || Number(parsed.reservationId) !== Number(reservationId)) {
        return null;
      }

      return {
        ...parsed,
        reservationId,
        extraDays: Math.max(1, Number(parsed.extraDays || 1)),
        reason: String(parsed.reason || '').trim(),
        status:
          parsed.status === 'APPROVED' || parsed.status === 'REJECTED'
            ? parsed.status
            : 'PENDING',
        proposedEndDate: String(parsed.proposedEndDate || ''),
        proposedTotalPrice: Number(parsed.proposedTotalPrice || 0),
        proposedDepositAmount: Number(parsed.proposedDepositAmount || 0),
      };
    } catch {
      return null;
    }
  }

  clearRentalExtensionRequest(reservationId: number): void {
    if (!reservationId) {
      return;
    }

    try {
      localStorage.removeItem(this.getExtensionRequestCacheKey(reservationId));
    } catch {
      // Ignore storage errors.
    }
  }

  cacheEtatDesLieuxPhotos(
    reservationId: number,
    photos: Array<{ url: string; label: string }>,
  ): void {
    if (!reservationId || !Array.isArray(photos) || photos.length === 0) {
      return;
    }

    const merged = this.getCachedEtatDesLieuxPhotos(reservationId).concat(
      photos.filter((photo) => !!photo?.url),
    );
    const deduped = merged.filter(
      (photo, index, array) =>
        array.findIndex(
          (candidate) =>
            candidate.url === photo.url && candidate.label === photo.label,
        ) === index,
    );

    try {
      localStorage.setItem(
        this.getEtatDesLieuxPhotosCacheKey(reservationId),
        JSON.stringify(deduped),
      );
    } catch {
      // Ignore storage errors.
    }
  }

  getCachedEtatDesLieuxPhotos(
    reservationId: number,
  ): Array<{ url: string; label: string }> {
    if (!reservationId) {
      return [];
    }

    try {
      const raw = localStorage.getItem(
        this.getEtatDesLieuxPhotosCacheKey(reservationId),
      );
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((photo) => ({
          url: String(photo?.url || '').trim(),
          label: String(photo?.label || '').trim(),
        }))
        .filter((photo) => !!photo.url);
    } catch {
      return [];
    }
  }

  clearCachedEtatDesLieuxPhotos(reservationId: number): void {
    if (!reservationId) {
      return;
    }

    try {
      localStorage.removeItem(
        this.getEtatDesLieuxPhotosCacheKey(reservationId),
      );
    } catch {
      // Ignore storage errors.
    }
  }

  private getEtatDesLieuxPhotosCacheKey(reservationId: number): string {
    return `${this.etatDesLieuxPhotosCachePrefix}${reservationId}`;
  }

  private tryResolveEtatDesLieuxPhotos(
    paths: string[],
  ): Observable<EtatDesLieuxPhotoDto[]> {
    if (paths.length === 0) {
      return of([]);
    }

    const [path, ...rest] = paths;

    return this.api.getLenientJson<any>(path).pipe(
      map((payload) => this.extractEtatDesLieuxPhotos(payload)),
      switchMap((photos) => {
        if (photos.length > 0) {
          return of(photos);
        }

        return this.tryResolveEtatDesLieuxPhotos(rest);
      }),
      catchError(() => this.tryResolveEtatDesLieuxPhotos(rest)),
    );
  }

  private extractEtatDesLieuxPhotos(payload: unknown): EtatDesLieuxPhotoDto[] {
    const source = this.extractEtatDesLieuxPhotoCollection(payload);
    if (!Array.isArray(source) || source.length === 0) {
      return [];
    }

    return source
      .map((item) => this.normalizeEtatDesLieuxPhoto(item))
      .filter((photo): photo is EtatDesLieuxPhotoDto => !!photo);
  }

  private extractEtatDesLieuxPhotoCollection(payload: unknown): any[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const raw = payload as Record<string, any>;
    const candidates = [
      raw['content'],
      raw['data'],
      raw['result'],
      raw['photos'],
      raw['etatDesLieuxPhotos'],
      raw['etat_des_lieux_photos'],
      raw['photoDtos'],
      raw['etatDesLieuxPhotoDtos'],
      raw['items'],
      raw['rows'],
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }

    return [];
  }

  private normalizeEtatDesLieuxPhoto(
    value: unknown,
  ): EtatDesLieuxPhotoDto | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const raw = value as Record<string, any>;

    const url = String(
      raw['photoUrl'] ??
        raw['photo_url'] ??
        raw['url'] ??
        raw['chemin'] ??
        raw['path'] ??
        '',
    ).trim();

    if (!url) {
      return null;
    }

    const type = String(
      raw['typePhoto'] ?? raw['type_photo'] ?? raw['type'] ?? '',
    ).trim();

    const createdAt = String(
      raw['dateUpload'] ??
        raw['date_upload'] ??
        raw['dateCreation'] ??
        raw['createdAt'] ??
        raw['created_date'] ??
        '',
    ).trim();

    const resolvedUrl = this.resolveMediaUrl(url);
    if (!resolvedUrl) {
      return null;
    }

    return {
      url: resolvedUrl,
      type,
      createdAt,
    };
  }

  private getExtensionRequestCacheKey(reservationId: number): string {
    return `${this.extensionRequestCachePrefix}${reservationId}`;
  }

  resolveMediaUrl(rawUrl: string | null | undefined): string | null {
    const trimmed = String(rawUrl || '').trim();
    if (!trimmed) {
      return null;
    }

    if (
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      /^https?:\/\//i.test(trimmed)
    ) {
      return trimmed;
    }

    const apiUrl = this.api.getApiUrl().replace(/\/+$/, '');

    if (
      trimmed.startsWith('/hypercloud/') ||
      trimmed.startsWith('hypercloud/')
    ) {
      const normalized = trimmed.replace(/^\/+/, '');
      const origin = new URL(apiUrl).origin;
      return `${origin}/${normalized}`;
    }

    if (trimmed.startsWith('/')) {
      return `${apiUrl}${trimmed}`;
    }

    return `${apiUrl}/${trimmed}`;
  }

  private normalizeVehiculeAgencePhotos(
    vehicule: VehiculeAgence,
  ): VehiculeAgence {
    const current = (vehicule as any)?.photoUrls;
    const serialized = (vehicule as any)?.photoUrlsSerialized;

    let normalized: string[] = [];

    if (Array.isArray(current)) {
      const currentStrings = current.filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      ) as string[];

      const looksLikeCharArray =
        currentStrings.length > 0 &&
        currentStrings.every((p) => p.length === 1);

      if (looksLikeCharArray) {
        normalized = currentStrings
          .join('')
          .split('||')
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
      } else {
        normalized = currentStrings;
      }
    } else if (typeof current === 'string' && current.trim().length > 0) {
      normalized = current
        .split('||')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }

    if (
      normalized.length === 0 &&
      typeof serialized === 'string' &&
      serialized.trim().length > 0
    ) {
      normalized = serialized
        .split('||')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }

    normalized = Array.from(new Set(normalized));

    return {
      ...vehicule,
      photoUrls: normalized,
    };
  }

  private extractAgencyUserId(
    agence: AgenceLocation & Record<string, any>,
  ): number | null {
    const rawUser = agence.utilisateur as any;
    const candidates = [
      rawUser?.id,
      rawUser?.idUtilisateur,
      rawUser?.id_utilisateur,
      rawUser?.idUser,
      rawUser?.userId,
      rawUser?.utilisateurId,
      agence['idUserFk'],
      agence['fkUtilisateur'],
      agence['fk_utilisateur'],
      agence['utilisateurId'],
      agence['idUtilisateur'],
      agence['id_utilisateur'],
      agence['userId'],
      agence['idUser'],
    ];

    for (const candidate of candidates) {
      const parsed = this.toNumericId(candidate);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  private toNumericId(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private roundCurrency(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }
}
