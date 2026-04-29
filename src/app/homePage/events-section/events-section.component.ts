import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EventActivity, WeatherData } from '../../event/models/event.model';
import { EventService } from '../../services/events/event.service';
import { AuthService } from '../../services/auth.service';
import { calculateDiscount } from '../../event/utils/discount.util';

@Component({
  selector: 'app-events-section',
  templateUrl: './events-section.component.html',
  styleUrls: ['./events-section.component.css']
})
export class EventsSectionComponent implements OnInit {
  featuredEvents: EventActivity[] = [];
  promoEvents: EventActivity[] = [];
  weather: WeatherData | null = null;
  loading = true;
  weatherUnavailable = false;
  favoriteIds = new Set<number>();

  private readonly favoritesStorageKeyPrefix = 'tunisiatour.favoriteEvents';

  constructor(
    private readonly eventService: EventService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadFavorites();
    this.eventService.getPublished().subscribe({
      next: evs => {
        this.featuredEvents = evs.slice(0, 3);
        this.promoEvents = evs
          .filter(ev => this.isPromoEvent(ev))
          .slice(0, 3);
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
    this.eventService.getWeatherByCity('Tunis').subscribe({
      next: w => {
        this.weather = w;
        this.weatherUnavailable = false;
      },
      error: () => {
        this.weather = null;
        this.weatherUnavailable = true;
      }
    });
  }

  isFavorite(eventId: number): boolean {
    return this.favoriteIds.has(eventId);
  }

  toggleFavorite(eventId: number): void {
    if (this.favoriteIds.has(eventId)) {
      this.favoriteIds.delete(eventId);
    } else {
      this.favoriteIds.add(eventId);
    }
    this.saveFavorites();
  }

  goToPromos(): void {
    void this.router.navigate(['/events/promos']);
  }

  goToReservations(): void {
    void this.router.navigate(['/mes-reservations-event']);
  }

  goToEvent(eventId: number): void {
    void this.router.navigate(['/events', eventId]);
  }

  getCategoryName(categoryId: number): string {
    const event = this.featuredEvents.find(ev => ev.categoryId === categoryId);
    return event?.categoryName ?? 'Evenement';
  }

  private isPromoEvent(ev: EventActivity): boolean {
    const hasConfiguredCode = !!ev.promoCode?.trim();
    const hasActiveDiscount = calculateDiscount(ev.price, ev.startDate, ev.categoryName, {
      promoType: ev.promoType,
      promoPercent: ev.promoPercent,
      promoCode: ev.promoCode,
      promoStartDate: ev.promoStartDate,
      promoEndDate: ev.promoEndDate,
    }).hasDiscount;

    return hasConfiguredCode || hasActiveDiscount;
  }

  private loadFavorites(): void {
    try {
      const raw = localStorage.getItem(this.getFavoritesStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        this.favoriteIds = new Set(parsed.map(value => Number(value)).filter(value => Number.isFinite(value)));
      }
    } catch {
      this.favoriteIds = new Set<number>();
    }
  }

  private saveFavorites(): void {
    try {
      localStorage.setItem(this.getFavoritesStorageKey(), JSON.stringify([...this.favoriteIds]));
    } catch {
      // Ignore storage failures.
    }
  }

  private getFavoritesStorageKey(): string {
    const user = this.authService.getCurrentUser();
    if (user?.id != null) {
      return `${this.favoritesStorageKeyPrefix}:user:${user.id}`;
    }
    return `${this.favoritesStorageKeyPrefix}:guest`;
  }
}