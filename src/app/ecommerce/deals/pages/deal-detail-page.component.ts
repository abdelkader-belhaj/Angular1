import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DealService } from '../../../services/deal.service';
import { CartService } from '../../../services/cart.service';

@Component({
  selector: 'app-deal-detail-page',
  templateUrl: './deal-detail-page.component.html',
  styleUrls: ['./deal-detail-page.component.css']
})
export class DealDetailPageComponent implements OnInit {
  dealId: string | null = null;
  deal: any = null;
  similarDeals: any[] = [];
  isLoading = true;
  quantity = 1;

  constructor(
    private activatedRoute: ActivatedRoute,
    private dealService: DealService,
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.activatedRoute.paramMap.subscribe((params) => {
      this.dealId = params.get('id');
      if (this.dealId) {
        this.loadDeal();
      }
    });
  }

  loadDeal(): void {
    if (!this.dealId) return;
    const dealId = Number(this.dealId);
    this.dealService.getDealById(dealId).subscribe(
      (deal) => {
        this.deal = deal;
        this.loadSimilarDeals();
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading deal:', error);
        this.isLoading = false;
      }
    );
  }

  loadSimilarDeals(): void {
    this.dealService.getAllDeals().subscribe(
      (deals) => {
        this.similarDeals = deals
          .filter(d => d.activityType === this.deal.type && d.id !== this.deal.id)
          .slice(0, 3);
      },
      (error) => {
        console.error('Error loading similar deals:', error);
      }
    );
  }

  toggleFavorite(): void {
    this.dealService.toggleFavorite(this.deal.id).subscribe(
      () => {
        this.deal.isFavorite = !this.deal.isFavorite;
      },
      (error) => {
        console.error('Error toggling favorite:', error);
      }
    );
  }

  addToCart(): void {
    this.cartService.addToCart(this.deal, this.quantity);
    alert('Bon ajouté au panier!');
  }

  viewSimilarDeal(dealId: number): void {
    this.router.navigate(['/deal-detail', dealId]);
  }

  goBack(): void {
    this.router.navigate(['/deals']);
  }
}
