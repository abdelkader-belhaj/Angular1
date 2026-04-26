import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DealService, Deal } from '../../../services/deal.service';
import { CustomSelectComponent } from './custom-select.component';

@Component({
  selector: 'app-my-favorites-page',
  templateUrl: './my-favorites-page.component.html',
  styleUrls: ['./my-favorites-page.component.css']
})
export class MyFavoritesPageComponent implements OnInit {
  favorites: Deal[] = [];
  filteredFavorites: Deal[] = [];
  paginatedFavorites: Deal[] = [];
  isLoading = true;

  // Pagination
  currentPage = 1;
  pageSize = 6;
  totalPages = 1;

  filterType = 'all';
  filterOptions = [
    { value: 'all', label: 'Tous les bons' },
    { value: 'adventure', label: 'Aventure' },
    { value: 'culture_history', label: 'Culture & Histoire' },
    { value: 'food', label: 'Gastronomie' },
    { value: 'relaxation', label: 'Relaxation' }
  ];

  Math = Math;

  constructor(
    private dealService: DealService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadFavorites();
  }

  loadFavorites(): void {
    this.dealService.getMyFavorites().subscribe(
      (favorites) => {
        console.log('Favorites loaded:', favorites);
        console.log('First image path:', favorites[0]?.image);
        this.favorites = favorites ?? [];
        this.applyFilters();
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading favorites:', error);
        this.favorites = [];
        this.isLoading = false;
      }
    );
  }

  removeFavorite(dealId: number): void {
    this.dealService.toggleFavorite(dealId).subscribe(
      () => {
        this.favorites = this.favorites.filter(f => f.id !== dealId);
        this.applyFilters();
      },
      (error) => {
        console.error('Error removing favorite:', error);
      }
    );
  }

  applyFilters(): void {
    this.filteredFavorites = this.getFilteredFavoritesArray();
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredFavorites.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = 1;
    }
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedFavorites = this.filteredFavorites.slice(startIndex, startIndex + this.pageSize);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  get pages(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  viewDeal(dealId: number): void {
    this.router.navigate(['/deal-detail', dealId]);
  }

  getFilteredFavorites(): Deal[] {
    return this.getFilteredFavoritesArray();
  }

  private getFilteredFavoritesArray(): Deal[] {
    if (this.filterType === 'all') {
      return this.favorites;
    }
    return this.favorites.filter(f => f.category === this.filterType);
  }

  formatEnumValue(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getImageUrl(imagePath: string): string {
  if (!imagePath) return 'assets/placeholder.png';
  if (imagePath.startsWith('http')) return imagePath;
  // ✅ strip leading slash if present to avoid double slash
  const clean = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  return 'http://localhost:8080/' + clean;
}
}

