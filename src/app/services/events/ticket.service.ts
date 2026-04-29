// src/app/services/events/ticket.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Ticket } from '../../event/models/event.model';


interface ApiResponse<T> { success: boolean; message: string; data: T; }

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly apiUrl = 'http://localhost:8080/api/tickets';
  constructor(private readonly http: HttpClient) {}

  getTicketByCode(code: string): Observable<Ticket> {
    return this.http.get<ApiResponse<Ticket>>(`${this.apiUrl}/${code}`).pipe(map(r => r.data));
  }

  validateTicket(code: string): Observable<Ticket> {
    return this.http.put<ApiResponse<Ticket>>(`${this.apiUrl}/${code}/validate`, {}).pipe(map(r => r.data));
  }

  getTicketsByReservation(reservationId: number): Observable<Ticket[]> {
    return this.http.get<ApiResponse<Ticket[]>>(`${this.apiUrl}/reservation/${reservationId}`).pipe(map(r => r.data));
  }
}