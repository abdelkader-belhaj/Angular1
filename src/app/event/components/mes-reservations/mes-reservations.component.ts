// src/app/event/components/mes-reservations/mes-reservations.component.ts
// ✅ FIX "already reserved" — après annulation, navigue vers l'event
// pour forcer le rechargement de checkReservation()

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EventReservation } from '../../models/event.model';
import { ReservationService } from '../../../services/events/reservation.service';
import { AuthService }        from '../../../services/auth.service';

@Component({
  selector:    'app-mes-reservations',
  templateUrl: './mes-reservations.component.html',
  styleUrls:   ['./mes-reservations.component.css'],
})
export class MesReservationsComponent implements OnInit {

  reservations: EventReservation[] = [];
  loading      = true;
  cancelingId: number | null = null;
  errorMsg     = '';

  constructor(
    private readonly resService:  ReservationService,
    private readonly authService: AuthService,
    private readonly router:      Router,
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      void this.router.navigate(['/']);
      return;
    }
    this.load();
  }

  load(): void {
    this.loading  = true;
    this.errorMsg = '';

    this.resService.getMesReservations().subscribe({
      next: (r: EventReservation[]) => {
        this.reservations = r.sort((a, b) =>
          new Date(b.reservationDate).getTime() - new Date(a.reservationDate).getTime()
        );
        this.loading = false;
      },
      error: () => {
        this.errorMsg = 'Impossible de charger vos réservations.';
        this.loading  = false;
      },
    });
  }

  canCancel(r: EventReservation): boolean {
    return r.status === 'PENDING' || r.status === 'CONFIRMED';
  }

  cancel(id: number): void {
    if (!confirm('Confirmer l\'annulation de cette réservation ?')) return;

    this.cancelingId = id;
    this.errorMsg    = '';

    this.resService.cancel(id).subscribe({
      next: () => {
        this.cancelingId = null;
        // ✅ FIX "already reserved" — recharge la liste depuis le serveur
        // Angular va maintenant voir status=CANCELLED dans la liste
        // et event-detail.component checkReservation() filtrera correctement
        this.load();
      },
      error: (err: any) => {
        this.cancelingId = null;
        this.errorMsg    = err?.error?.message
          ?? 'Annulation impossible. L\'événement est peut-être trop proche.';
      },
    });
  }

  goToTicket(id: number):   void { void this.router.navigate(['/ticket',  id]); }
  goToPayment(id: number):  void { void this.router.navigate(['/payment', id]); }
  goToEvent(eventId: number): void { void this.router.navigate(['/events', eventId]); }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'CONFIRMED': 'status-ok',
      'PENDING':   'status-pend',
      'CANCELLED': 'status-cancel',
    };
    return map[status] ?? '';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      'CONFIRMED': '✅ Confirmé',
      'PENDING':   '⏳ En attente de paiement',
      'CANCELLED': '❌ Annulé',
    };
    return map[status] ?? status;
  }
}