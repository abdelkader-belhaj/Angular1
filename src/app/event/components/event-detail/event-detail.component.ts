import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EventActivity, WeatherData, DiscountInfo } from '../../models/event.model';
import { EventService } from '../../../services/events/event.service';
import { ReservationService } from '../../../services/events/reservation.service';
import { calculateDiscount, defaultEventImage } from '../../utils/discount.util';
import { AuthService } from '../../../services/auth.service';

type EventReview = {
  eventId: number;
  userId: number | null;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

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

  private readonly reviewsStorageKey = 'tunisiatour.eventReviews.v1';

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
        this.discount = calculateDiscount(ev.price, ev.startDate, ev.categoryName);
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
      next: rs => { this.isReserved = rs.some(r => r.eventId === this.event?.id && r.status !== 'CANCELLED'); },
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

    const message = this.reviewComment.trim();
    if (message.length < 10) {
      this.reviewError = 'Votre avis doit contenir au moins 10 caractères.';
      return;
    }

    const user = this.auth.getCurrentUser();
    const review: EventReview = {
      eventId: this.event.id,
      userId: user?.id ?? null,
      userName: user?.username ?? 'Client',
      rating: this.reviewRating,
      comment: message,
      createdAt: new Date().toISOString(),
    };

    const store = this.readReviewsStore();
    const key = String(this.event.id);
    const list = Array.isArray(store[key]) ? store[key] : [];

    const existingIndex = list.findIndex((r: EventReview) => {
      if (user?.id != null && r.userId != null) return r.userId === user.id;
      return r.userName === review.userName;
    });

    if (existingIndex >= 0) {
      list[existingIndex] = review;
      this.reviewSuccess = 'Votre avis a été mis à jour.';
    } else {
      list.unshift(review);
      this.reviewSuccess = 'Merci, votre avis a été publié.';
    }

    store[key] = list;
    this.writeReviewsStore(store);
    this.loadReviews(this.event.id);
    this.reviewComment = '';
    this.reviewRating = 5;
  }

  private loadReviews(eventId: number): void {
    const store = this.readReviewsStore();
    const list = Array.isArray(store[String(eventId)]) ? store[String(eventId)] : [];
    this.reviews = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private readReviewsStore(): Record<string, EventReview[]> {
    try {
      const raw = localStorage.getItem(this.reviewsStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeReviewsStore(store: Record<string, EventReview[]>): void {
    try {
      localStorage.setItem(this.reviewsStorageKey, JSON.stringify(store));
    } catch {
      // Ignore storage failures.
    }
  }
}
