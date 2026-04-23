// src/app/features/transport/core/services/chauffeur.service.ts
import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, map, catchError, switchMap } from 'rxjs/operators';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import {
  Chauffeur,
  DisponibiliteStatut,
  Vehicule,
  Course,
  PositionUpdate,
  ChauffeurDashboardStats,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ChauffeurService {
  private readonly legacyForcedKey = 'forced_chauffeur_id';
  private readonly legacyResolvedPrefix = 'resolved_chauffeur_id_';
  private currentChauffeurSubject = new BehaviorSubject<Chauffeur | null>(null);
  public currentChauffeur$ = this.currentChauffeurSubject.asObservable();

  constructor(private api: ApiService) {}

  createChauffeur(payload: {
    utilisateurId: number;
    telephone: string;
    numeroLicence: string;
  }): Observable<Chauffeur> {
    return this.api.post<Chauffeur>('/chauffeurs', payload).pipe(
      map((c) => this.normalizeChauffeur(c)),
      tap((c) => this.currentChauffeurSubject.next(c)),
    );
  }

  hasChauffeurProfile(userId: number): Observable<boolean> {
    return this.getChauffeurByUtilisateurId(userId).pipe(
      map(() => true),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          return of(false);
        }
        return throwError(() => error);
      }),
    );
  }

  private normalizeChauffeur(raw: any): Chauffeur {
    return {
      ...raw,
      utilisateurId:
        raw?.utilisateurId ??
        raw?.id_utilisateur ??
        raw?.idUtilisateur ??
        raw?.chauffeurUserId ??
        raw?.userId ??
        raw?.utilisateur?.id ??
        raw?.utilisateur?.idUser ??
        raw?.utilisateur?.idUtilisateur ??
        raw?.user?.id ??
        null,
    } as Chauffeur;
  }

  // ==================== PROFIL ====================

  getProfil(chauffeurId: number): Observable<Chauffeur> {
    return this.api.get<any>(`/chauffeurs/${chauffeurId}`).pipe(
      map((c) => this.normalizeChauffeur(c)),
      tap((c) => this.currentChauffeurSubject.next(c)),
      catchError((err) => {
        this.currentChauffeurSubject.next(null);
        return throwError(() => err);
      }),
    );
  }

  updateProfil(
    chauffeurId: number,
    changes: Partial<Chauffeur>,
  ): Observable<Chauffeur> {
    // Reload frais → merge → PUT (évite conflits de version JPA)
    return this.api.get<Chauffeur>(`/chauffeurs/${chauffeurId}`).pipe(
      switchMap((current) => {
        const updated = { ...current, ...changes };
        return this.api.put<Chauffeur>(`/chauffeurs/${chauffeurId}`, updated);
      }),
      tap((c) => this.currentChauffeurSubject.next(c)),
    );
  }

  // ==================== STATUT / DISPONIBILITÉ ====================
  // Endpoints dédiés : PUT /hypercloud/chauffeurs/{id}/online|offline|on-ride

  goOnline(chauffeurId: number): Observable<Chauffeur> {
    return this.api
      .put<Chauffeur>(`/chauffeurs/${chauffeurId}/online`, {})
      .pipe(tap((c) => this.currentChauffeurSubject.next(c)));
  }

  goOffline(chauffeurId: number): Observable<Chauffeur> {
    return this.api
      .put<Chauffeur>(`/chauffeurs/${chauffeurId}/offline`, {})
      .pipe(tap((c) => this.currentChauffeurSubject.next(c)));
  }

  setOnRide(chauffeurId: number): Observable<Chauffeur> {
    return this.api
      .put<Chauffeur>(`/chauffeurs/${chauffeurId}/on-ride`, {})
      .pipe(tap((c) => this.currentChauffeurSubject.next(c)));
  }

  approveChauffeur(chauffeurId: number): Observable<Chauffeur> {
    return this.api
      .put<Chauffeur>(`/chauffeurs/${chauffeurId}/approuver`, {})
      .pipe(tap((c) => this.currentChauffeurSubject.next(c)));
  }

  suspendChauffeur(chauffeurId: number): Observable<Chauffeur> {
    return this.api
      .put<Chauffeur>(`/chauffeurs/${chauffeurId}/suspendre`, {})
      .pipe(tap((c) => this.currentChauffeurSubject.next(c)));
  }

  // ==================== POSITION ====================
  // PUT /hypercloud/chauffeurs/{id}/position — body: { latitude, longitude }

  updatePosition(
    chauffeurId: number,
    position: PositionUpdate,
  ): Observable<Chauffeur> {
    return this.api.put<Chauffeur>(
      `/chauffeurs/${chauffeurId}/position`,
      position,
    );
  }

  // ==================== LISTES ====================

  getAllChauffeurs(): Observable<Chauffeur[]> {
    return this.api
      .get<any[]>('/chauffeurs')
      .pipe(
        map((chauffeurs) => chauffeurs.map((c) => this.normalizeChauffeur(c))),
      );
  }

  getChauffeurByUtilisateurId(userId: number): Observable<Chauffeur> {
    return this.api
      .get<any>(`/chauffeurs/utilisateur/${userId}`)
      .pipe(map((chauffeur) => this.normalizeChauffeur(chauffeur)));
  }

  private clearLegacyResolvedKeys(userId: number): void {
    localStorage.removeItem(this.legacyForcedKey);
    localStorage.removeItem(`${this.legacyResolvedPrefix}${userId}`);
  }

  resolveChauffeurIdByUserId(userId: number): Observable<number | null> {
    this.clearLegacyResolvedKeys(userId);

    return this.getChauffeurByUtilisateurId(userId).pipe(
      map((chauffeur) => chauffeur.idChauffeur ?? null),
      catchError((error) => {
        if (this.isServerUnavailableError(error)) {
          return throwError(() => error);
        }

        return this.resolveByListFallback(userId);
      }),
    );
  }

  resolveUserIdByChauffeurId(chauffeurId: number): Observable<number | null> {
    return this.getProfil(chauffeurId).pipe(
      map((chauffeur) => {
        const id = Number(
          chauffeur?.utilisateurId ??
            chauffeur?.utilisateur?.id ??
            (chauffeur as any)?.utilisateur?.idUser ??
            (chauffeur as any)?.user?.id ??
            0,
        );

        return Number.isFinite(id) && id > 0 ? id : null;
      }),
      catchError(() => this.resolveUserIdByChauffeurIdFromList(chauffeurId)),
    );
  }

  private resolveUserIdByChauffeurIdFromList(
    chauffeurId: number,
  ): Observable<number | null> {
    return this.getAllChauffeurs().pipe(
      map((chauffeurs) => {
        const current = chauffeurs.find(
          (c) => Number(c.idChauffeur) === Number(chauffeurId),
        );

        const id = Number(
          current?.utilisateurId ??
            current?.utilisateur?.id ??
            (current as any)?.utilisateur?.idUser ??
            (current as any)?.user?.id ??
            0,
        );

        return Number.isFinite(id) && id > 0 ? id : null;
      }),
      catchError(() => of(null)),
    );
  }

  private resolveByListFallback(userId: number): Observable<number | null> {
    return this.getAllChauffeurs().pipe(
      map((chauffeurs) => {
        const current = chauffeurs.find(
          (c) => c.utilisateurId === userId || c.utilisateur?.id === userId,
        );

        if (current?.idChauffeur) {
          return current.idChauffeur;
        }

        return null;
      }),
      catchError((error) => {
        if (this.isServerUnavailableError(error)) {
          return throwError(() => error);
        }

        return of(null);
      }),
    );
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

  getAvailableChauffeurs(): Observable<Chauffeur[]> {
    return this.api.get<Chauffeur[]>('/chauffeurs/disponibles');
  }

  getActiveChauffeurs(): Observable<Chauffeur[]> {
    return this.api.get<Chauffeur[]>('/chauffeurs/actifs');
  }

  // ==================== VÉHICULES ====================
  // GET /hypercloud/vehicules → filtré côté client par chauffeur.idChauffeur

  getVehicules(chauffeurId: number): Observable<Vehicule[]> {
    return this.api.get<Vehicule[]>(`/vehicules/chauffeur/${chauffeurId}`);
  }

  getVehiculeById(vehiculeId: number): Observable<Vehicule> {
    return this.api.get<Vehicule>(`/vehicules/${vehiculeId}`);
  }

  getActiveVehicules(): Observable<Vehicule[]> {
    return this.api.get<Vehicule[]>('/vehicules/actifs');
  }

  addVehicule(vehicule: any): Observable<Vehicule> {
    // on accepte any pour inclure chauffeurId
    return this.api.post<Vehicule>('/vehicules', vehicule);
  }

  updateVehicule(
    vehiculeId: number,
    data: Partial<Vehicule>,
  ): Observable<Vehicule> {
    // Reload frais → merge → PUT (même pattern que updateProfil)
    return this.api.get<Vehicule>(`/vehicules/${vehiculeId}`).pipe(
      switchMap((current) => {
        const updated = { ...current, ...data };
        return this.api.put<Vehicule>(`/vehicules/${vehiculeId}`, updated);
      }),
    );
  }

  activateVehicule(vehiculeId: number): Observable<Vehicule> {
    return this.api.put<Vehicule>(`/vehicules/${vehiculeId}/activer`, {});
  }

  deactivateVehicule(vehiculeId: number): Observable<Vehicule> {
    return this.api.put<Vehicule>(`/vehicules/${vehiculeId}/desactiver`, {});
  }

  deleteVehicule(vehiculeId: number): Observable<void> {
    return this.api.delete<void>(`/vehicules/${vehiculeId}`);
  }

  uploadVehiculePhotos(
    vehiculeId: number,
    files: File[],
  ): Observable<Vehicule> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file, file.name);
    }

    return this.api.postMultipart<Vehicule>(
      `/vehicules/${vehiculeId}/photos`,
      formData,
    );
  }

  removeVehiculePhoto(
    vehiculeId: number,
    photoUrl: string,
  ): Observable<Vehicule> {
    const params = new HttpParams().set('photoUrl', photoUrl);
    return this.api.deleteWithParams<Vehicule>(
      `/vehicules/${vehiculeId}/photos`,
      params,
    );
  }

  getPublicUploadUrl(path: string): string {
    if (!path) {
      return '';
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
    const lower = normalized.toLowerCase();
    const uploadsMarker = 'uploads/';
    const markerIndex = lower.indexOf(uploadsMarker);
    const relativePath =
      markerIndex >= 0
        ? normalized.slice(markerIndex + uploadsMarker.length)
        : normalized;

    const origin = new URL(this.api.getApiUrl()).origin.replace(/\/+$/, '');
    return `${origin}/uploads/${relativePath.replace(/^\/+/, '')}`;
  }

  affecterVehicule(
    chauffeurId: number,
    vehiculeId: number,
  ): Observable<Chauffeur> {
    return this.api
      .put<Chauffeur>(
        `/chauffeurs/${chauffeurId}/affecter-vehicule/${vehiculeId}`,
        {},
      )
      .pipe(tap((c) => this.currentChauffeurSubject.next(c)));
  }

  // ==================== COURSES ====================
  // GET /hypercloud/courses/chauffeur/{chauffeurId}

  getHistoriqueCourses(chauffeurId: number): Observable<Course[]> {
    return this.api
      .getLenientJson<any>(`/courses/chauffeur/${chauffeurId}`, undefined, [])
      .pipe(
        map((payload) => {
          const list = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload?.content)
                ? payload.content
                : [];

          return list.map((course: any) => ({
            ...course,
            idCourse: course.idCourse ?? course.id,
          })) as Course[];
        }),
      );
  }

  getCourseActive(chauffeurId: number): Observable<Course | null> {
    return this.getHistoriqueCourses(chauffeurId).pipe(
      map(
        (courses) =>
          courses.find(
            (c) => c.statut === 'STARTED' || c.statut === 'IN_PROGRESS',
          ) ?? null,
      ),
    );
  }

  // ==================== STATISTIQUES ====================
  // Pas d'endpoint dédié côté backend pour l'instant → calculé depuis le profil + historique

  getDashboardStats(chauffeurId: number): Observable<ChauffeurDashboardStats> {
    return this.getProfil(chauffeurId).pipe(
      switchMap((chauffeur) =>
        this.getHistoriqueCourses(chauffeurId).pipe(
          map((courses) => {
            const computed = this.computeDashboardStatsFromCourses(
              chauffeur,
              courses,
            );
            this.logDashboardStatsDiagnostics(
              chauffeurId,
              chauffeur,
              courses,
              computed,
            );
            return computed;
          }),
          catchError((error) => {
            console.error(
              '[DashboardStats] Echec chargement historique courses',
              {
                chauffeurId,
                error,
              },
            );

            const computed = this.computeDashboardStatsFromCourses(
              chauffeur,
              [],
            );
            this.logDashboardStatsDiagnostics(
              chauffeurId,
              chauffeur,
              [],
              computed,
            );
            return of(computed);
          }),
        ),
      ),
    );
  }

  private computeDashboardStatsFromCourses(
    chauffeur: Chauffeur,
    courses: Course[],
  ): ChauffeurDashboardStats {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const startOfWeek = this.getStartOfRollingWeek(now);

    let totalCoursesAujourdhui = 0;
    let totalCoursesSemaine = 0;
    let revenusAujourdhui = 0;
    let revenusSemaine = 0;

    for (const course of courses ?? []) {
      if (!this.isCompletedCourse(course)) {
        continue;
      }

      const timestamp = this.extractCourseTimestamp(course);
      if (timestamp == null) {
        continue;
      }

      const amount = this.extractCourseAmount(course);

      if (timestamp >= startOfToday) {
        totalCoursesAujourdhui += 1;
        revenusAujourdhui += amount;
      }

      if (timestamp >= startOfWeek) {
        totalCoursesSemaine += 1;
        revenusSemaine += amount;
      }
    }

    return {
      totalCoursesAujourdhui,
      totalCoursesSemaine,
      revenusAujourdhui,
      revenusSemaine,
      noteMoyenne: Number(chauffeur?.noteMoyenne ?? 0),
      tempsEnLigneMinutes: 0,
    };
  }

  private getStartOfRollingWeek(date: Date): Date {
    const start = new Date(date);
    start.setDate(date.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private isCompletedCourse(course: Course): boolean {
    const status = String((course as any)?.statut ?? '').toUpperCase();

    if (
      ['COMPLETED', 'TERMINEE', 'TERMINATED', 'FINISHED', 'DONE'].includes(
        status,
      )
    ) {
      return true;
    }

    // Compat backend: certaines courses "terminees" remontent avec statut ACTIVE.
    if (status === 'ACTIVE') {
      const amount = this.extractCourseAmount(course);
      const hasCompletionTimestamp = [
        (course as any)?.dateFin,
        (course as any)?.dateCompletion,
        (course as any)?.completedAt,
        (course as any)?.paiementTransport?.datePaiement,
      ].some((value) => !!value);

      return amount > 0 || hasCompletionTimestamp;
    }

    return false;
  }

  private extractCourseTimestamp(course: Course): Date | null {
    const rawCandidates = [
      (course as any)?.paiementTransport?.datePaiement,
      (course as any)?.paiementTransport?.dateCreation,
      (course as any)?.dateFin,
      (course as any)?.dateCompletion,
      (course as any)?.completedAt,
      (course as any)?.dateCreation,
      (course as any)?.dateModification,
    ];

    for (const raw of rawCandidates) {
      if (!raw) {
        continue;
      }

      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  }

  private extractCourseAmount(course: Course): number {
    const rawCandidates = [
      (course as any)?.paiementTransport?.montantNet,
      (course as any)?.paiementTransport?.montantTotal,
      (course as any)?.montantNetChauffeur,
      (course as any)?.prixFinal,
      (course as any)?.prixEstime,
      0,
    ];

    for (const raw of rawCandidates) {
      const normalized = Number(raw);
      if (Number.isFinite(normalized) && normalized > 0) {
        return normalized;
      }
    }

    return 0;
  }

  private logDashboardStatsDiagnostics(
    chauffeurId: number,
    chauffeur: Chauffeur,
    courses: Course[],
    stats: ChauffeurDashboardStats,
  ): void {
    const simplifiedCourses = (courses ?? []).map((course: any) => ({
      idCourse: course?.idCourse ?? course?.id,
      statut: course?.statut,
      dateCreation: course?.dateCreation,
      dateModification: course?.dateModification,
      dateFin: course?.dateFin,
      completedAt: course?.completedAt,
      prixFinal: course?.prixFinal,
      montantNetChauffeur: course?.montantNetChauffeur,
      paiementMontantNet: course?.paiementTransport?.montantNet,
      paiementMontantTotal: course?.paiementTransport?.montantTotal,
      paiementDate: course?.paiementTransport?.datePaiement,
    }));

    const completedStatuts = simplifiedCourses
      .map((course) => String(course.statut ?? '').toUpperCase())
      .filter((status) => status.length > 0);

    console.groupCollapsed(
      `[DashboardStats] chauffeur=${chauffeurId} courses=${courses?.length ?? 0}`,
    );
    console.log('Profil chauffeur', {
      idChauffeur: chauffeur?.idChauffeur,
      utilisateurId: chauffeur?.utilisateurId,
      noteMoyenne: chauffeur?.noteMoyenne,
    });
    console.log('Statuts detectes', completedStatuts);
    console.table(simplifiedCourses);
    console.log('Stats calculees', stats);
    console.groupEnd();
  }

  // ==================== HELPERS ====================

  getCurrentChauffeurId(): number | null {
    return this.currentChauffeurSubject.value?.idChauffeur ?? null;
  }

  isAvailable(): boolean {
    return (
      this.currentChauffeurSubject.value?.disponibilite ===
      DisponibiliteStatut.AVAILABLE
    );
  }

  getCachedChauffeur(): Chauffeur | null {
    return this.currentChauffeurSubject.value;
  }
}
