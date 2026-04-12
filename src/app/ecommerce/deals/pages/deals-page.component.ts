import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DealService } from '../../../services/deal.service';

@Component({
  selector: 'app-deals-page',
  templateUrl: './deals-page.component.html',
  styleUrls: ['./deals-page.component.css']
})
export class DealsPageComponent implements OnInit {
  deals: any[] = [];
  filteredDeals: any[] = [];
  isLoading = true;
  
  searchQuery = '';
  sortBy = 'discount';
  filterType = 'all';
  
  filterOptions = [
    { value: 'all', label: 'Tous les bons' },
    { value: 'hotel', label: 'Hôtels' },
    { value: 'tour', label: 'Séjours' },
    { value: 'activity', label: 'Activités' }
  ];
  
  sortOptions = [
    { value: 'discount', label: 'Réduction (high to low)' },
    { value: 'price', label: 'Prix (low to high)' },
    { value: 'newest', label: 'Plus récent' },
    { value: 'rating', label: 'Évaluation' }
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
        this.deals = deals;
        this.applyFilters();
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading deals:', error);
        this.isLoading = false;
      }
    );
  }

  applyFilters(): void {
    let filtered = this.deals;

    // Filter by type
    if (this.filterType !== 'all') {
      filtered = filtered.filter(deal => deal.type === this.filterType);
    }

    // Search
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(deal =>
        deal.title.toLowerCase().includes(query) ||
        deal.description.toLowerCase().includes(query)
      );
    }

    // Sort
    if (this.sortBy === 'discount') {
      filtered.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    } else if (this.sortBy === 'price') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (this.sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (this.sortBy === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    this.filteredDeals = filtered;
  }

  onSearch(): void {
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.sortBy = 'discount';
    this.filterType = 'all';
    this.applyFilters();
  }

  toggleFavorite(deal: any): void {
    this.dealService.toggleFavorite(deal.id).subscribe(
      () => {
        deal.isFavorite = !deal.isFavorite;
      },
      (error) => {
        console.error('Error toggling favorite:', error);
      }
    );
  }

  viewDeal(dealId: number): void {
    this.router.navigate(['/deal-detail', dealId]);
  }
}
