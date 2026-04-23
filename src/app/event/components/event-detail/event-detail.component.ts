import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DiscountInfo, EventActivity, EventReview, EventReviewRequest, WeatherData } from '../../models/event.model';
import { EventService } from '../../../services/events/event.service';
import { ReservationService } from '../../../services/events/reservation.service';
import { calculateDiscount, defaultEventImage } from '../../utils/discount.util';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.component.html',
  styleUrls: ['./event-detail.component.css']
})
export class EventDetailComponent implements OnInit {
  event: EventActivity | null = null;
  weather: WeatherData | null = null;
  discount: DiscountInfo = {
    hasDiscount: false,
    percent: 0,
    discountPercent: 0,
    finalPrice: 0,
    discountedPrice: 0,
    originalPrice: 0,
    label: '',
    reason: '',
  };
  loading = true;
  reserving = false;
  isReserved = false;
  errorMsg = '';
  numberOfTickets = 1;
  reviews: EventReview[] = [];
  reviewRating = 5;
  reviewComment = '';
  reviewError = '';
  reviewSuccess = '';
  hasConfirmedReservationForEvent = false;

  get isLoggedIn(): boolean { return !!this.auth.getToken(); }
  get isClient(): boolean { return this.auth.getCurrentUser()?.role === 'CLIENT_TOURISTE'; }
  get totalPrice(): number {
    if (!this.event) return 0;
    const base = this.discount.hasDiscount ? this.discount.finalPrice : this.event.price;
    return +(base * this.numberOfTickets).toFixed(2);
  }

  get averageRating(): number {
    if (!this.reviews.length) return 0;
    const sum = this.reviews.reduce((acc, r) => acc + r.rating, 0);
    return +(sum / this.reviews.length).toFixed(1);
  }

  get averageRatingRounded(): number {
    return Math.round(this.averageRating);
  }

  get isEventFinished(): boolean {
    if (!this.event?.endDate) return false;
    return new Date(this.event.endDate).getTime() <= Date.now();
  }

  get canReview(): boolean {
    return this.isLoggedIn && this.isClient && this.isEventFinished && this.hasConfirmedReservationForEvent;
  }

  get reviewEligibilityMessage(): string {
    if (!this.isLoggedIn || !this.isClient) {
      return 'Connectez-vous en tant que client pour laisser un avis.';
    }
    if (!this.hasConfirmedReservationForEvent) {
      return 'Vous pouvez laisser un avis uniquement après une réservation confirmée (paiement validé).';
    }
    if (!this.isEventFinished) {
      return 'Vous pourrez laisser un avis dès la fin de cet événement.';
    }
    return '';
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private resService: ReservationService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    const id = +this.route.snapshot.paramMap.get('id')!;
    this.eventService.getPublishedById(id).subscribe({
      next: ev => {
        this.event = ev;
        this.discount = calculateDiscount(ev.price, ev.startDate, ev.categoryName, {
          promoType: ev.promoType,
          promoPercent: ev.promoPercent,
          promoCode: ev.promoCode,
          promoStartDate: ev.promoStartDate,
          promoEndDate: ev.promoEndDate,
        });
        this.loadReviews(ev.id);
        this.loading = false;
        this.eventService.getEventWeather(id).subscribe({ next: w => this.weather = w, error: () => {} });
        if (this.isLoggedIn) this.checkReservation();
      },
      error: () => { this.loading = false; }
    });
  }

  checkReservation(): void {
    this.resService.getMesReservations().subscribe({
      next: rs => {
        this.isReserved = rs.some(r => r.eventId === this.event?.id && r.status !== 'CANCELLED');
        this.hasConfirmedReservationForEvent = rs.some(
          r => r.eventId === this.event?.id && r.status === 'CONFIRMED'
        );
      },
      error: () => {}
    });
  }

  reserve(): void {
    if (!this.event) return;
    this.reserving = true; this.errorMsg = '';
    this.resService.create({ numberOfTickets: this.numberOfTickets, eventId: this.event.id }).subscribe({
      next: r => { this.reserving = false; this.router.navigate(['/payment', r.id]); },
      error: err => { this.reserving = false; this.errorMsg = err.error?.message || 'Erreur lors de la réservation.'; }
    });
  }

  incrementTickets(): void {
    if (!this.event) return;
    if (this.numberOfTickets < this.event.availableSeats) {
      this.numberOfTickets += 1;
    }
  }

  decrementTickets(): void {
    if (this.numberOfTickets > 1) {
      this.numberOfTickets -= 1;
    }
  }

  getImage(): string {
    return this.event?.imageUrl || defaultEventImage(this.event?.type || '', this.event?.categoryName);
  }

  openGoogleMaps(): void {
    if (!this.event) return;
    const q = encodeURIComponent(`${this.event.address}, ${this.event.city}, Tunisia`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  goBack(): void { void this.router.navigate(['/events']); }

  setReviewRating(stars: number): void {
    this.reviewRating = stars;
  }

  submitReview(): void {
    this.reviewError = '';
    this.reviewSuccess = '';

    if (!this.event) return;
    if (!this.isLoggedIn || !this.isClient) {
      this.reviewError = 'Connectez-vous en tant que client pour laisser un avis.';
      return;
    }

    if (!this.hasConfirmedReservationForEvent) {
      this.reviewError = 'Avis autorisé uniquement après paiement confirmé pour cet événement.';
      return;
    }

    if (!this.isEventFinished) {
      this.reviewError = 'Vous pourrez publier votre avis après la fin de l\'événement.';
      return;
    }

    const message = this.reviewComment.trim();
    if (message.length < 10) {
      this.reviewError = 'Votre avis doit contenir au moins 10 caractères.';
      return;
    }

    const payload: EventReviewRequest = {
      rating: this.reviewRating,
      comment: message,
    };

    this.eventService.submitReview(this.event.id, payload).subscribe({
      next: () => {
        this.reviewSuccess = 'Merci, votre avis a été publié.';
        this.reviewComment = '';
        this.reviewRating = 5;
        this.loadReviews(this.event!.id);
      },
      error: err => {
        this.reviewError = err?.error?.message || 'Impossible de publier votre avis pour le moment.';
      }
    });
  }

  private loadReviews(eventId: number): void {
    this.eventService.getReviews(eventId).subscribe({
      next: reviews => {
        this.reviews = Array.isArray(reviews) ? reviews : [];
      },
      error: () => {
        this.reviews = [];
      }
    });
  }
}
