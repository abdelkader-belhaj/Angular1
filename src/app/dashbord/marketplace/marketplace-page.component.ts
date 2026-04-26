import { Component } from '@angular/core';

@Component({
  selector: 'app-marketplace-page',
  templateUrl: './marketplace-page.component.html',
  styleUrl: './marketplace-page.component.css'
})
export class MarketplacePageComponent {
  activeTab: 'artisans' | 'products' | 'orders' | 'promo' | 'deals' = 'artisans';

  setActiveTab(tab: 'artisans' | 'products' | 'orders' | 'promo' | 'deals') {
    this.activeTab = tab;
  }
}
