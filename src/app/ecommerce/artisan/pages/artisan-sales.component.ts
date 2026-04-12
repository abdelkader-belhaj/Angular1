import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ArtisanService, ArtisanSale } from '../../../services/artisan.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-artisan-sales',
  templateUrl: './artisan-sales.component.html',
  styleUrls: ['./artisan-sales.component.css']
})
export class ArtisanSalesComponent implements OnInit {
  sales: ArtisanSale[] = [];
  filteredSales: ArtisanSale[] = [];
  stats: any = null;
  isLoading = true;
  sidebarOpen = true;

  filterStatus = 'all';
  statusOptions = ['all', 'completed', 'pending', 'cancelled'];
  sortBy = 'date';

  constructor(
    private artisanService: ArtisanService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadSales();
  }

  loadSales(): void {
    Promise.all([
      new Promise(resolve => {
        this.artisanService.getArtisanSales().subscribe(
          (sales) => {
            this.sales = sales.sort((a, b) => 
              new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
            );
            this.applySortAndFilter();
            resolve(null);
          },
          (error) => {
            console.error('Error loading sales:', error);
            resolve(null);
          }
        );
      }),
      new Promise(resolve => {
        this.artisanService.getSalesStats().subscribe(
          (stats) => {
            this.stats = stats;
            resolve(null);
          },
          (error) => {
            console.error('Error loading stats:', error);
            resolve(null);
          }
        );
      })
    ]).then(() => {
      this.isLoading = false;
    });
  }

  applySortAndFilter(): void {
    let filtered = [...this.sales];

    // Filter by status
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(sale => sale.status === this.filterStatus);
    }

    // Sort
    if (this.sortBy === 'date') {
      filtered.sort((a, b) => 
        new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
      );
    } else if (this.sortBy === 'amount') {
      filtered.sort((a, b) => b.totalAmount - a.totalAmount);
    } else if (this.sortBy === 'quantity') {
      filtered.sort((a, b) => b.quantity - a.quantity);
    }

    this.filteredSales = filtered;
  }

  onFilterChange(): void {
    this.applySortAndFilter();
  }

  onSortChange(): void {
    this.applySortAndFilter();
  }

  getStatusColor(status: string): string {
    switch(status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  exportToCsv(): void {
    const headers = ['Date', 'Produit', 'Quantité', 'Prix unitaire', 'Total', 'Acheteur', 'Statut'];
    const data = this.filteredSales.map(sale => [
      new Date(sale.saleDate).toLocaleDateString('fr-FR'),
      sale.productName,
      sale.quantity,
      sale.unitPrice,
      sale.totalAmount,
      sale.buyerName,
      sale.status
    ]);

    const csv = [headers, ...data].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ventes-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
