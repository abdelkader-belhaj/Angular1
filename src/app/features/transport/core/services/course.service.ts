// src/app/features/transport/core/services/course.service.ts
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, map, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Course, CourseStatus } from '../models';

export interface PaymentVerificationStatus {
  courseId: number;
  clientConfirmed: boolean;
  driverVerified: boolean;
  paymentCreated: boolean;
  cancelled: boolean;
  verificationCode?: string;
  paymentIntentId?: string;
  paymentStatut?: string;
  montantBrut?: number;
  montantPreautorise?: number;
  montantRestant?: number;
  penaltyAmount?: number;
  refundAmount?: number;
  cancelledBy?: string;
  cancellationReason?: string;
  clientConfirmedAt?: string;
  driverVerifiedAt?: string;
}

export interface ClientConfirmationStatus {
  courseId: number;
  clientConfirmed: boolean;
}

@Injectable({ providedIn: 'root' })
export class CourseService {
  private activeCourseSubject = new BehaviorSubject<Course | null>(null);
  public activeCourse$ = this.activeCourseSubject.asObservable();

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

  private normalizeCoursePayload(payload: any): Course {
    const unwrapped =
      payload?.course ?? payload?.data?.course ?? payload?.data ?? payload;
    const course: any = { ...(unwrapped ?? {}) };

    if (course.idCourse == null && course.id != null) {
      course.idCourse = course.id;
    }

    const demande = course.demande ?? course.demandeCourse;
    const prixEstime = this.firstFiniteNumber(
      demande?.prixEstime,
      demande?.prixEstimeCalcule,
      course.prixEstime,
      course.estimatedPrice,
      course.matching?.prixEstime,
      course.matching?.estimatedPrice,
      course.matching?.demande?.prixEstime,
      course.matching?.demandeCourse?.prixEstime,
      payload?.prixEstime,
      payload?.estimatedPrice,
    );

    if (demande || prixEstime != null) {
      course.demande = {
        ...(demande ?? {}),
        prixEstime: prixEstime ?? demande?.prixEstime,
      };
    }

    return course as Course;
  }

  // ==================== COURSES CRUD ====================
  // POST /hypercloud/courses

  createCourse(course: Partial<Course>): Observable<Course> {
    return this.api
      .post<Course>('/courses', course)
      .pipe(tap((c) => this.activeCourseSubject.next(c)));
  }

  getCourseById(id: number): Observable<Course> {
    return this.api.get<any>(`/courses/${id}`).pipe(
      map((payload) => this.normalizeCoursePayload(payload)),
      tap((c) => this.activeCourseSubject.next(c)),
    );
  }

  getAllCourses(): Observable<Course[]> {
    return this.api.get<Course[]>('/courses');
  }

  getCoursesByStatut(statut: CourseStatus): Observable<Course[]> {
    return this.api.get<Course[]>(`/courses/statut/${statut}`);
  }

  // GET /hypercloud/courses/chauffeur/{chauffeurId}
  getCoursesByChauffeur(chauffeurId: number): Observable<Course[]> {
    return this.api.get<Course[]>(`/courses/chauffeur/${chauffeurId}`);
  }

  // GET /hypercloud/courses/client/{clientId}
  getCoursesByClient(clientId: number): Observable<Course[]> {
    return this.api
      .getLenientJson<any>(`/courses/client/${clientId}`, undefined, [])
      .pipe(
        map((payload) => this.normalizeCourseList(payload)),
        switchMap((courses) => {
          if (courses.length > 0) {
            return of(courses);
          }

          return this.api
            .getLenientJson<any>(
              `/demandes-courses/client/${clientId}`,
              undefined,
              [],
            )
            .pipe(map((payload) => this.extractCoursesFromDemandes(payload)));
        }),
      );
  }

  private normalizeCourseList(payload: any): Course[] {
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
  }

  private extractCoursesFromDemandes(payload: any): Course[] {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.content)
          ? payload.content
          : [];

    return list
      .map((item: any) => item?.course ?? item?.demande?.course ?? null)
      .filter((course: any) => !!course)
      .map((course: any) => ({
        ...course,
        idCourse: course.idCourse ?? course.id,
      })) as Course[];
  }

  deleteCourse(id: number): Observable<void> {
    return this.api.delete<void>(`/courses/${id}`);
  }

  // ==================== WORKFLOW COURSE ====================
  // Déroulement : ACCEPTED → STARTED → IN_PROGRESS → COMPLETED

  // PUT /hypercloud/courses/{id}/demarrer → ACCEPTED → STARTED
  startCourse(courseId: number): Observable<Course> {
    return this.api
      .put<Course>(`/courses/${courseId}/demarrer`, {})
      .pipe(tap((c) => this.activeCourseSubject.next(c)));
  }

  // PUT /hypercloud/courses/{id}/statut/IN_PROGRESS
  setInProgress(courseId: number): Observable<Course> {
    return this.api
      .put<Course>(`/courses/${courseId}/statut/IN_PROGRESS`, {})
      .pipe(tap((c) => this.activeCourseSubject.next(c)));
  }

  // PUT /hypercloud/courses/{id}/terminer → COMPLETED (paiement sécurisé en étape séparée)
  completeCourse(courseId: number): Observable<Course> {
    return this.api
      .put<Course>(`/courses/${courseId}/terminer`, {})
      .pipe(tap((c) => this.activeCourseSubject.next(c)));
  }

  // PUT /hypercloud/courses/{id}/annuler
  cancelCourse(courseId: number): Observable<Course> {
    return this.api
      .put<Course>(`/courses/${courseId}/annuler`, {})
      .pipe(tap(() => this.activeCourseSubject.next(null)));
  }

  // PUT /hypercloud/courses/{id}/statut/{statut} — usage générique
  updateStatut(courseId: number, statut: CourseStatus): Observable<Course> {
    return this.api
      .put<Course>(`/courses/${courseId}/statut/${statut}`, {})
      .pipe(tap((c) => this.activeCourseSubject.next(c)));
  }

  // ==================== CHAT ====================
  // GET  /hypercloud/courses/{courseId}/messages
  // POST /hypercloud/courses/{courseId}/messages

  getChatHistory(courseId: number): Observable<any[]> {
    return this.api.get<any[]>(`/courses/${courseId}/messages`);
  }

  sendMessageViaRest(courseId: number, message: any): Observable<any> {
    return this.api.post<any>(`/courses/${courseId}/messages`, {
      ...message,
      courseId,
    });
  }

  // ==================== HELPERS ====================

  getCourseActive(): Course | null {
    return this.activeCourseSubject.value;
  }

  /** À appeler quand une course est connue (ex. depuis une demande ACCEPTED). */
  setActiveCourse(course: Course | null): void {
    this.activeCourseSubject.next(course);
  }

  clearActiveCourse(): void {
    this.activeCourseSubject.next(null);
  }

  confirmClientPayment(
    courseId: number,
    paymentIntentId?: string,
  ): Observable<PaymentVerificationStatus> {
    return this.api.post<PaymentVerificationStatus>(
      `/courses/${courseId}/paiement/client-confirmer`,
      {
        paymentIntentId: paymentIntentId ?? null,
      },
    );
  }

  verifyPaymentByDriver(
    courseId: number,
    verificationCode: string,
  ): Observable<PaymentVerificationStatus> {
    return this.api.post<PaymentVerificationStatus>(
      `/courses/${courseId}/paiement/valider-chauffeur`,
      {
        verificationCode,
      },
    );
  }

  getPaymentStatus(courseId: number): Observable<PaymentVerificationStatus> {
    return this.api.get<PaymentVerificationStatus>(
      `/courses/${courseId}/paiement/statut`,
    );
  }

  getClientConfirmationStatus(
    courseId: number,
  ): Observable<ClientConfirmationStatus> {
    return this.api.get<ClientConfirmationStatus>(
      `/courses/${courseId}/confirmation-client`,
    );
  }
}
