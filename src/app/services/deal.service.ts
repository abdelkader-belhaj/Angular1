import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, BehaviorSubject, catchError, of } from 'rxjs';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface Deal {
  id: number;
  title: string;
  description: string;
  longDescription?: string;
  location: string;
  category: string;
  region: string;
  activityType: string; // Solo, Duo, Groupe, Flexible
  environment: string; // Indoor, Outdoor, Les deux
  duration: number; // en heures
  budget: string; // TND, TND TND, TND TND TND
  image: string;
  price: number;
  rating?: number;
  reviewCount?: number;
  availableSlots?: number;
  favoriteCount: number;
}

export interface DealFilter {
  region?: string;
  category?: string;
  budget?: string;
  type?: string;
  environment?: string;
  duration?: number;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class DealService {
  private readonly apiUrl = 'http://localhost:8080/api/ecommerce/deals';
  private favoritesSubject$ = new BehaviorSubject<Set<number>>(new Set());

  constructor(private readonly http: HttpClient) {
    this.loadFavorites();
  }

  // ========== DEALS RETRIEVAL ==========

  getAllDeals(filters?: DealFilter): Observable<Deal[]> {
  let params = new URLSearchParams();
  if (filters) {
    if (filters.search) params.append('search', filters.search);
    if (filters.region) params.append('region', filters.region);
    if (filters.category) params.append('category', filters.category);
    if (filters.budget) params.append('budget', filters.budget);
    if (filters.type) params.append('type', filters.type);
    if (filters.environment) params.append('environment', filters.environment);
    if (filters.duration) params.append('duration', filters.duration.toString());
  }

  const queryString = params.toString();
  const url = queryString ? `${this.apiUrl}?${queryString}` : this.apiUrl;

  return this.http.get<any>(url).pipe(
    map(response => Array.isArray(response) ? response : response.data ?? [])  // ✅ handle both wrapped and unwrapped
  );
}

  // ========== FAVORITES MANAGEMENT ==========

  getMyFavorites(): Observable<Deal[]> {
  return this.http
    .get<any>('http://localhost:8080/api/ecommerce/deal-favorites/my-favorites')
    .pipe(
      map(response => {
        console.log('Raw favorites response:', JSON.stringify(response));
        return Array.isArray(response) ? response : response.data ?? [];
      }),
      catchError(() => of([]))
    );
}

  getFavoritesWithDetails(): Observable<Deal[]> {
    return this.getMyFavorites();
  }

  addToFavorites(dealId: number): Observable<void> {
    return this.http
      .post<ApiResponse<null>>('http://localhost:8080/api/ecommerce/deal-favorites', { dealId })
      .pipe(
        map(() => {
          const favorites = this.favoritesSubject$.value;
          favorites.add(dealId);
          this.favoritesSubject$.next(new Set(favorites));
        })
      );
  }

  removeFromFavorites(dealId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`http://localhost:8080/api/ecommerce/deal-favorites/${dealId}`)
      .pipe(
        map(() => {
          const favorites = this.favoritesSubject$.value;
          favorites.delete(dealId);
          this.favoritesSubject$.next(new Set(favorites));
        })
      );
  }

  isFavorite(dealId: number): Observable<boolean> {
    return this.http
      .get<ApiResponse<boolean>>(`${this.apiUrl}/${dealId}/is-favorite`)
      .pipe(map((response) => response.data));
  }

  getFavorites(): Observable<Set<number>> {
    return this.favoritesSubject$.asObservable();
  }

  isFavoriteSync(dealId: number): boolean {
    return this.favoritesSubject$.value.has(dealId);
  }

  isFavoriteSyncBoolean(dealId: number): boolean {
    return this.favoritesSubject$.value.has(dealId);
  }

  // ========== PRIVATE METHODS ==========

  private loadFavorites(): void {
  this.getMyFavorites().subscribe({
    next: (deals) => {
      if (deals && Array.isArray(deals)) {
        const favoriteIds = new Set(deals.map((d) => d.id));
        this.favoritesSubject$.next(favoriteIds);
      }
    },
    error: () => {
      this.favoritesSubject$.next(new Set());
    }
  });
}

  getDealById(id: number): Observable<Deal> {
  return this.http
    .get<any>(`${this.apiUrl}/${id}`)
    .pipe(map(response => response.data ?? response));
}

private readonly favoritesUrl = 'http://localhost:8080/api/ecommerce/deal-favorites';
toggleFavorite(dealId: number): Observable<void> {
  return this.http
    .post<any>(`${this.favoritesUrl}/toggle/${dealId}`, {})
    .pipe(
      map((response) => {
        const isFav = response.data;
        const favorites = this.favoritesSubject$.value;
        if (isFav) {
          favorites.add(dealId);
        } else {
          favorites.delete(dealId);
        }
        this.favoritesSubject$.next(new Set(favorites));
      })
    );
}
}
