import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EventActivity, EventCategory, EventReservation } from '../../models/event.model';
import { EventService } from '../../../services/events/event.service';
import { ReservationService } from '../../../services/events/reservation.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-event-list',
  templateUrl: './event-list.component.html',
  styleUrls: ['./event-list.component.css'],
})
export class EventListComponent implements OnInit {

  allEvents: EventActivity[] = [];
  filteredEvents: EventActivity[] = [];
  categories: EventCategory[] = [];
  loading = true;
  reservedIds = new Set<number>();
  favoriteIds = new Set<number>();
  assistantOpen = false;
  showFavoritesOnly = false;

  private readonly favoritesStorageKeyPrefix = 'tunisiatour.favoriteEvents';

  searchQuery = '';
  selectedDate = '';
  selectedType = 'ALL';
  selectedCity = '';
  selectedCategories = new Set<number>();
  maxPrice = 500;
  maxPriceCeiling = 500;
  sortBy = 'date';

  readonly typeOptions = [
    { value: 'ALL',      label: '🌟 Tous' },
    { value: 'EVENT',    label: '🎭 Événements' },
    { value: 'ACTIVITY', label: '🏄 Activités' },
  ];

  get cities(): string[] {
    return [...new Set(this.allEvents.map(e => e.city))].sort();
  }

  constructor(
    private readonly eventService: EventService,
    private readonly reservationService: ReservationService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadFavorites();
    this.loadEvents();
    this.loadCategories();
    if (this.authService.isAuthenticated()) this.loadReservedIds();
  }

  loadEvents(): void {
    this.loading = true;
    this.eventService.getPublished().subscribe({
      next: (data: EventActivity[]) => {
        this.allEvents = data;
        // Keep all events visible by default: ceiling follows the highest current event price.
        const highestPrice = this.allEvents.reduce((max, ev) => Math.max(max, Number(ev.price) || 0), 0);
        this.maxPriceCeiling = Math.max(500, Math.ceil(highestPrice));
        this.maxPrice = this.maxPriceCeiling;
        this.applyFilters();
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  loadCategories(): void {
    this.eventService.getCategories().subscribe({
      next: (data: EventCategory[]) => { this.categories = data; },
      error: () => {},
    });
  }

  loadReservedIds(): void {
    this.reservationService.getMesReservationsEvent().subscribe({
      next: (reservations: EventReservation[]) => {
        this.reservedIds = new Set(
          reservations
            .filter(r => r.status !== 'CANCELLED')
            .map(r => r.eventId)
        );
      },
      error: () => {},
    });
  }

  applyFilters(): void {
    let results = [...this.allEvents];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      results = results.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.city.toLowerCase().includes(q) ||
        (e.categoryName ?? '').toLowerCase().includes(q)
      );
    }

    if (this.selectedType !== 'ALL') {
      results = results.filter(e => e.type === this.selectedType);
    }

    if (this.selectedCity) {
      results = results.filter(e => e.city === this.selectedCity);
    }

    if (this.selectedDate) {
      results = results.filter(e => this.toDateInput(e.startDate) === this.selectedDate);
    }

    if (this.selectedCategories.size > 0) {
      results = results.filter(e =>
        e.categoryId != null && this.selectedCategories.has(e.categoryId)
      );
    }

    if (this.showFavoritesOnly) {
      results = results.filter(e => this.favoriteIds.has(e.id));
    }

    results = results.filter(e => Number(e.price) <= this.maxPrice);

    switch (this.sortBy) {
      case 'date':
        results.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        break;
      case 'price_asc':
        results.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case 'price_desc':
        results.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case 'seats':
        results.sort((a, b) => b.availableSeats - a.availableSeats);
        break;
    }

    this.filteredEvents = results;
  }

  toggleCategory(categoryId: number): void {
    if (this.selectedCategories.has(categoryId)) {
      this.selectedCategories.delete(categoryId);
    } else {
      this.selectedCategories.add(categoryId);
    }
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedDate = '';
    this.selectedType = 'ALL';
    this.selectedCity = '';
    this.selectedCategories.clear();
    this.maxPrice = this.maxPriceCeiling;
    this.sortBy = 'date';
    this.showFavoritesOnly = false;
    this.applyFilters();
  }

  toggleFavoritesOnly(): void {
    this.showFavoritesOnly = !this.showFavoritesOnly;
    this.applyFilters();
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

    if (this.showFavoritesOnly) {
      this.applyFilters();
    }
  }

  toggleAssistant(): void { this.assistantOpen = !this.assistantOpen; }

  goToEvent(eventOrId: EventActivity | number): void {
    const id = typeof eventOrId === 'number' ? eventOrId : eventOrId.id;
    void this.router.navigate(['/events', id]);
  }

  onReserveClick(event: EventActivity): void {
    void this.router.navigate(['/events', event.id]);
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

  private toDateInput(dateStr: string): string {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}