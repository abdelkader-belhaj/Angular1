// src/app/event/components/mes-reservations-event/mes-reservations-event.component.ts
// ✅ FIX "already reserved" — après annulation, navigue vers l'event
// pour forcer le rechargement de checkReservation()

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EventReservation } from '../../models/event.model';
import { ReservationService } from '../../../services/events/reservation.service';
import { AuthService }        from '../../../services/auth.service';
import { PaymentService } from '../../../services/events/Payment.service';

@Component({
  selector:    'app-mes-reservations-event',
  templateUrl: './mes-reservations-event.component.html',
  styleUrls:   ['./mes-reservations-event.component.css'],
})
export class MesReservationsEventComponent implements OnInit {

  reservations: EventReservation[] = [];
  loading      = true;
  cancelingId: number | null = null;
  errorMsg     = '';

  constructor(
    private readonly resService:  ReservationService,
    private readonly authService: AuthService,
    private readonly paymentService: PaymentService,
    private readonly route: ActivatedRoute,
    private readonly router:      Router,
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      void this.router.navigate(['/']);
      return;
    }

    const reservationId = Number(this.route.snapshot.queryParamMap.get('reservationId'));
    const stripeSessionId = this.route.snapshot.queryParamMap.get('stripeSessionId') ?? '';

    if (reservationId > 0 && stripeSessionId.trim().length > 0) {
      this.confirmStripeReturn(reservationId, stripeSessionId.trim());
      return;
    }

    this.load();
  }

  load(): void {
    this.loading  = true;
    this.errorMsg = '';

    this.resService.getMesReservationsEvent().subscribe({
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

  private confirmStripeReturn(reservationId: number, sessionId: string): void {
    this.loading = true;
    this.errorMsg = '';

    this.paymentService.confirmStripeSession({ reservationId, sessionId }).subscribe({
      next: () => {
        const cleanedUrl = this.router.createUrlTree(['/mes-reservations-event']).toString();
        void this.router.navigateByUrl(cleanedUrl, { replaceUrl: true });
        this.load();
      },
      error: (err: any) => {
        this.errorMsg = err?.error?.message ?? 'Paiement Stripe non confirmé.';
        this.load();
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
