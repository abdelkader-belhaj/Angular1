// src/app/services/events/reservation.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  EventReservation,
  EventQrScanResult,
  EventReservationRequest,
  EventVisionAnalysisResult,
  EventTicket,
} from '../../event/models/event.model';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly base = 'http://localhost:8080/api/reservations/events';

  constructor(private readonly http: HttpClient) {}

  create(payload: EventReservationRequest): Observable<EventReservation> {
    return this.http.post<EventReservation>(this.base, payload);
  }

  // ✅ Suppression des headers no-cache — ils peuvent interférer avec l'interceptor JWT
  // Le no-cache était la cause du bug "Impossible de charger vos réservations"
  getMesReservations(): Observable<EventReservation[]> {
    return this.http.get<EventReservation[]>(`${this.base}/mes-reservations`);
  }

  getById(id: number): Observable<EventReservation> {
    return this.http.get<EventReservation>(`${this.base}/${id}`);
  }

  getByEvent(eventId: number): Observable<EventReservation[]> {
    return this.http.get<EventReservation[]>(`${this.base}/event/${eventId}`);
  }

  cancel(id: number): Observable<EventReservation> {
    return this.http.put<EventReservation>(`${this.base}/${id}/cancel`, {});
  }

  scanQr(id: number): Observable<EventQrScanResult> {
    return this.http.post<EventQrScanResult>(`${this.base}/${id}/scan-qr`, {});
  }

  analyzeTicketWithAI(base64Image: string, reservationId: number): Observable<EventVisionAnalysisResult> {
    return this.http.post<EventVisionAnalysisResult>(`${this.base}/analyze-ticket`, {
      imageBase64: base64Image,
      reservationId,
    });
  }

  getTicketsByReservation(reservationId: number): Observable<EventTicket[]> {
    const eventsEndpoint = `http://localhost:8080/api/tickets/events/reservation/${reservationId}`;
    const legacyEndpoint = `http://localhost:8080/api/tickets/reservation/${reservationId}`;

    return this.http.get<unknown>(eventsEndpoint).pipe(
      map((response) => this.normalizeTicketsResponse(response)),
      catchError(() =>
        this.http.get<unknown>(legacyEndpoint).pipe(
          map((response) => this.normalizeTicketsResponse(response))
        )
      )
    );
  }

  scanTicketByCode(ticketCode: string): Observable<EventQrScanResult> {
    const encodedCode = encodeURIComponent(ticketCode);
    const eventsEndpoint = `http://localhost:8080/api/tickets/events/scan/${encodedCode}`;
    const legacyEndpoint = `http://localhost:8080/api/tickets/${encodedCode}/validate`;

    return this.http.post<unknown>(eventsEndpoint, {}).pipe(
      map((response) => this.normalizeScanResponse(response)),
      catchError((err: HttpErrorResponse) => {
        // Keep legacy fallback only for endpoint-not-found to preserve old environments.
        if (err?.status === 404) {
          return this.http.put<unknown>(legacyEndpoint, {}).pipe(
            map((response) => this.normalizeScanResponse(response))
          );
        }
        return throwError(() => err);
      })
    );
  }

  hasReservedEvent(eventId: number): Observable<boolean> {
    return this.getMesReservations().pipe(
      map(rs => rs.some(
        r => r.eventId === eventId &&
             (r.status === 'PENDING' || r.status === 'CONFIRMED')
      ))
    );
  }

  private normalizeTicketsResponse(response: unknown): EventTicket[] {
    if (Array.isArray(response)) {
      return response as EventTicket[];
    }

    if (response && typeof response === 'object' && 'data' in response) {
      const data = (response as { data?: unknown }).data;
      if (Array.isArray(data)) {
        return data as EventTicket[];
      }
    }

    return [];
  }

  private normalizeScanResponse(response: unknown): EventQrScanResult {
    if (response && typeof response === 'object' && 'valid' in response && 'message' in response) {
      return response as EventQrScanResult;
    }

    if (response && typeof response === 'object' && 'data' in response) {
      const data = (response as { data?: unknown }).data;
      if (data && typeof data === 'object') {
        const ticket = data as { used?: boolean; status?: string; ticketCode?: string };
        return {
          valid: !!ticket.used || ticket.status === 'USED',
          message: ticket.ticketCode ? `Ticket ${ticket.ticketCode} validé.` : 'Ticket validé.',
        };
      }
    }

    return {
      valid: false,
      message: 'Réponse de validation invalide.',
    };
  }
}