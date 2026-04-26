import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
  hideBackButton = false;
  showLocationModal = false;
  locationTab: 'map' | 'street' = 'map';
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

  get mapEmbedUrl(): SafeResourceUrl | null {
    if (!this.event || this.event.latitude == null || this.event.longitude == null) {
      return null;
    }

    const lat = this.event.latitude;
    const lng = this.event.longitude;
    const delta = 0.0035;
    const bbox = `${(lng - delta).toFixed(6)}%2C${(lat - delta).toFixed(6)}%2C${(lng + delta).toFixed(6)}%2C${(lat + delta).toFixed(6)}`;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  get hasCoordinates(): boolean {
    return !!(this.event && this.event.latitude != null && this.event.longitude != null);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private resService: ReservationService,
    private auth: AuthService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    const id = +this.route.snapshot.paramMap.get('id')!;
    this.hideBackButton = this.route.snapshot.queryParamMap.get('source') === 'organisateur';
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
    this.resService.getMesReservationsEvent().subscribe({
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

  openLocationModal(): void {
    if (!this.hasCoordinates) return;
    this.locationTab = 'map';
    this.showLocationModal = true;
  }

  closeLocationModal(): void {
    this.showLocationModal = false;
  }

  selectLocationTab(tab: 'map' | 'street'): void {
    this.locationTab = tab;
  }

  openStreetViewInNewTab(): void {
    if (!this.event || this.event.latitude == null || this.event.longitude == null) return;

    const target = this.getStreetViewTarget();
    const primaryUrl = `https://www.google.com/maps?layer=c&cbll=${target.lat},${target.lng}&cbp=12,0,0,0,5`;

    // Open in the same tab to avoid popup blockers entirely.
    window.location.assign(primaryUrl);
  }

  private getStreetViewTarget(): { lat: number; lng: number } {
    if (!this.event) {
      return { lat: 0, lng: 0 };
    }

    const placeKey = `${this.event.title} ${this.event.city} ${this.event.address}`.toLowerCase();

    if (placeKey.includes('sidi bou said') || placeKey.includes('sidi bou saïd')) {
      return { lat: 36.8713, lng: 10.3476 };
    }

    if (placeKey.includes('carthage')) {
      return { lat: 36.8528, lng: 10.3250 };
    }

    if (placeKey.includes('hammamet')) {
      return { lat: 36.4000, lng: 10.6167 };
    }

    if (placeKey.includes('sousse')) {
      return { lat: 35.8256, lng: 10.6369 };
    }

    if (placeKey.includes('djerba')) {
      return { lat: 33.8076, lng: 10.8451 };
    }

    if (placeKey.includes('tabarka')) {
      return { lat: 36.9540, lng: 8.7570 };
    }

    if (placeKey.includes('tunis')) {
      return { lat: 36.8008, lng: 10.1812 };
    }

    return {
      lat: this.event.latitude!,
      lng: this.event.longitude!,
    };
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
