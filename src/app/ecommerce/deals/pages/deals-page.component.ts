import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DealService, Deal } from '../../../services/deal.service';
import { CustomSelectComponent } from './custom-select.component';

@Component({
  selector: 'app-deals-page',
  templateUrl: './deals-page.component.html',
  styleUrls: ['./deals-page.component.css']
})
export class DealsPageComponent implements OnInit {
  deals: Deal[] = [];
  filteredDeals: Deal[] = [];
  paginatedDeals: Deal[] = [];
  isLoading = true;
  
  // Pagination
  currentPage = 1;
  pageSize = 6;
  totalPages = 1;
  
  Math = Math;
  
  searchQuery = '';
  sortBy = 'newest';
  selectedRegion = '';
  selectedBudget = '';
  selectedActivityType = '';
  selectedCategory = '';
  selectedEnvironment = '';
  selectedDuration = '';
  
  regions = ['north', 'south', 'center', 'east_coast', 'sahara'];
  budgets = ['low', 'medium', 'high'];
  activityTypes = ['solo', 'duo', 'group', 'flexible'];
  categories = ['adventure', 'culture_history', 'food', 'relaxation', 'water_sports', 'crafts', 'nature_hiking', 'heritage', 'photography'];
  environments = ['indoor', 'outdoor', 'both'];
  durations = ['one_hour', 'two_hours', 'three_hours', 'half_day', 'full_day', 'two_days', 'three_days_plus', 'weekend'];
  
  sortOptions = [
    { value: 'newest', label: 'Plus récent' },
    { value: 'popular', label: 'Populaires' },
    { value: 'favorites', label: 'Plus favorisés' }
  ];

  // Custom select options
  sortOptionsForSelect = [
    { value: 'newest', label: 'Plus récent' },
    { value: 'popular', label: 'Populaires' },
    { value: 'favorites', label: 'Plus favorisés' }
  ];

  regionOptions = [
    { value: '', label: 'Toutes les régions' },
    { value: 'north', label: 'Nord' },
    { value: 'south', label: 'Sud' },
    { value: 'center', label: 'Centre' },
    { value: 'east_coast', label: 'Côte Est' },
    { value: 'sahara', label: 'Sahara' }
  ];

  budgetOptions = [
    { value: '', label: 'Tous les budgets' },
    { value: 'low', label: 'Bas' },
    { value: 'medium', label: 'Moyen' },
    { value: 'high', label: 'Élevé' }
  ];

  activityTypeOptions = [
    { value: '', label: 'Tous les types' },
    { value: 'solo', label: 'Solo' },
    { value: 'duo', label: 'Duo' },
    { value: 'group', label: 'Groupe' },
    { value: 'flexible', label: 'Flexible' }
  ];

  categoryOptions = [
    { value: '', label: 'Toutes les catégories' },
    { value: 'adventure', label: 'Aventure' },
    { value: 'culture_history', label: 'Culture & Histoire' },
    { value: 'food', label: 'Gastronomie' },
    { value: 'relaxation', label: 'Relaxation' },
    { value: 'water_sports', label: 'Sports Aquatiques' },
    { value: 'crafts', label: 'Artisanat' },
    { value: 'nature_hiking', label: 'Nature & Randonnée' },
    { value: 'heritage', label: 'Patrimoine' },
    { value: 'photography', label: 'Photographie' }
  ];

  environmentOptions = [
    { value: '', label: 'Tous les environnements' },
    { value: 'indoor', label: 'Intérieur' },
    { value: 'outdoor', label: 'Extérieur' },
    { value: 'both', label: 'Les deux' }
  ];

  durationOptions = [
    { value: '', label: 'Toutes les durées' },
    { value: 'one_hour', label: '1 heure' },
    { value: 'two_hours', label: '2 heures' },
    { value: 'three_hours', label: '3 heures' },
    { value: 'half_day', label: 'Demi-journée' },
    { value: 'full_day', label: 'Journée complète' },
    { value: 'two_days', label: '2 jours' },
    { value: 'three_days_plus', label: '3+ jours' },
    { value: 'weekend', label: 'Week-end' }
  ];

  constructor(
    private dealService: DealService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDeals();
  }

  loadDeals(): void {
  this.dealService.getAllDeals().subscribe(
    (deals) => {
      this.deals = deals ?? [];
      this.filteredDeals = [...this.deals];
      this.applyFilters();
      this.isLoading = false;
    },
    (error) => {
      console.error('Error loading deals:', error);
      this.deals = [];
      this.filteredDeals = [];
      this.isLoading = false;
    }
  );
}

  applyFilters(): void {
     if (!this.deals || !this.deals.length) {
    this.filteredDeals = [];
    return;
  }  // ✅ guard
    let filtered = [...this.deals];
    
    // Search
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(deal =>
        deal.title.toLowerCase().includes(query) ||
        deal.description.toLowerCase().includes(query) ||
        deal.location.toLowerCase().includes(query)
      );
    }

    // Filter by region
    if (this.selectedRegion) {
      filtered = filtered.filter(deal => String(deal.region) === this.selectedRegion);
    }

    // Filter by budget
    if (this.selectedBudget) {
      filtered = filtered.filter(deal => String(deal.budget) === this.selectedBudget);
    }

    // Filter by activity type
    if (this.selectedActivityType) {
      filtered = filtered.filter(deal => String(deal.activityType) === this.selectedActivityType);
    }

    // Filter by category
    if (this.selectedCategory) {
      filtered = filtered.filter(deal => String(deal.category) === this.selectedCategory);
    }

    // Filter by environment
    if (this.selectedEnvironment) {
      filtered = filtered.filter(deal => String(deal.environment) === this.selectedEnvironment);
    }

    // Filter by duration
    if (this.selectedDuration) {
      filtered = filtered.filter(deal => String(deal.duration) === this.selectedDuration);
    }

    // Sort
    if (this.sortBy === 'popular') {
      filtered.sort((a, b) => (b.favoriteCount || 0) - (a.favoriteCount || 0));
    } else if (this.sortBy === 'favorites') {
      filtered.sort((a, b) => (b.favoriteCount || 0) - (a.favoriteCount || 0));
    }

    this.filteredDeals = filtered;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredDeals.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = 1;
    }
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedDeals = this.filteredDeals.slice(startIndex, startIndex + this.pageSize);
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

  onSearch(): void {
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.sortBy = 'newest';
    this.selectedRegion = '';
    this.selectedBudget = '';
    this.selectedActivityType = '';
    this.selectedCategory = '';
    this.selectedEnvironment = '';
    this.selectedDuration = '';
    this.currentPage = 1;
    this.applyFilters();
  }

  toggleFavorite(deal: Deal): void {
    this.dealService.toggleFavorite(deal.id).subscribe(
      () => {
        // Favorite status toggled, update count and UI
      },
      (error) => {
        console.error('Error toggling favorite:', error);
      }
    );
  }

  isFavorite(dealId: number): boolean {
    return this.dealService.isFavoriteSyncBoolean(dealId);
  }

  formatEnumValue(value: string): string {
  if (!value) return '';
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
