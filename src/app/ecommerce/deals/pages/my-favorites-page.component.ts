import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DealService } from '../../../services/deal.service';

@Component({
  selector: 'app-my-favorites-page',
  templateUrl: './my-favorites-page.component.html',
  styleUrls: ['./my-favorites-page.component.css']
})
export class MyFavoritesPageComponent implements OnInit {
  favorites: any[] = [];
  isLoading = true;
  
  filterType = 'all';
  filterOptions = [
    { value: 'all', label: 'Tous les bons' },
    { value: 'hotel', label: 'Hôtels' },
    { value: 'tour', label: 'Séjours' },
    { value: 'activity', label: 'Activités' }
  ];

  constructor(
    private dealService: DealService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFavorites();
  }

  loadFavorites(): void {
    this.dealService.getMyFavorites().subscribe(
      (favorites) => {
        this.favorites = favorites;
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading favorites:', error);
        this.isLoading = false;
      }
    );
  }

  removeFavorite(dealId: number): void {
    this.dealService.toggleFavorite(dealId).subscribe(
      () => {
        this.favorites = this.favorites.filter(f => f.id !== dealId);
      },
      (error) => {
        console.error('Error removing favorite:', error);
      }
    );
  }

  viewDeal(dealId: number): void {
    this.router.navigate(['/deal-detail', dealId]);
  }

  getFilteredFavorites(): any[] {
    if (this.filterType === 'all') {
      return this.favorites;
    }
    return this.favorites.filter(f => f.type === this.filterType);
  }
}
