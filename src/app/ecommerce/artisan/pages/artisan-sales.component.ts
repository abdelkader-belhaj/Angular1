import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArtisanService, ArtisanSale } from '../../../services/artisan.service';
import { AuthService } from '../../../services/auth.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface ProductStat {
  productName: string;
  totalSold: number;
  totalQuantity: number;
  revenue: number;
  percentage: number;
}

interface CategoryStat {
  category: string;
  totalSales: number;
  totalQuantity: number;
  totalRevenue: number;
}

@Component({
  selector: 'app-artisan-sales',
  templateUrl: './artisan-sales.component.html',
  styleUrls: ['./artisan-sales.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule]
})
export class ArtisanSalesComponent implements OnInit {
  @ViewChild('revenuePieChart') revenuePieChart!: ElementRef;
  @ViewChild('salesBarChart') salesBarChart!: ElementRef;
  @ViewChild('trendLineChart') trendLineChart!: ElementRef;

  sales: ArtisanSale[] = [];
  filteredSales: ArtisanSale[] = [];
  paginatedSales: ArtisanSale[] = [];
  stats: any = null;
  isLoading = true;
  sidebarOpen = true;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  Math = Math;

  filterStatus = 'all';
  statusOptions = ['all', 'completed', 'pending', 'cancelled'];
  sortBy = 'date';

  // Statistics
  productStats: ProductStat[] = [];
  categoryStats: CategoryStat[] = [];
  topProductBySales: ProductStat | null = null;
  topProductByRevenue: ProductStat | null = null;
  totalProductsSold = 0;
  totalMoneyEarned = 0;
  averageOrderValue = 0;

  // Chart instances
  private revenuePie: any;
  private salesBar: any;
  private trendLine: any;

  // Filters
  selectedCategory: string = 'all';
  categoryOptions: string[] = [];

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
            this.calculateStatistics();
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
      setTimeout(() => this.initCharts(), 100);
    });
  }

  initCharts(): void {
    if (!this.revenuePieChart || !this.salesBarChart || !this.trendLineChart) return;

    // Cleanup existing charts
    if (this.revenuePie) this.revenuePie.destroy();
    if (this.salesBar) this.salesBar.destroy();
    if (this.trendLine) this.trendLine.destroy();

    const colors = [
      '#003974', '#0047a3', '#005edb', '#3b82f6', '#60a5fa', 
      '#93c5fd', '#bfdbfe', '#dbeafe', '#f0f9ff', '#002a54'
    ];

    // Revenue Pie Chart (Doughnut)
    const pieCtx = this.revenuePieChart.nativeElement.getContext('2d');
    this.revenuePie = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: this.productStats.slice(0, 5).map(p => p.productName),
        datasets: [{
          data: this.productStats.slice(0, 5).map(p => p.revenue),
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
          tooltip: {
            callbacks: {
              label: (context: any) => ` ${context.label}: ${context.raw.toFixed(2)} TND`
            }
          }
        },
        cutout: '75%'
      }
    });

    // Trend Line Chart
    const trendData = this.getTrendData();
    const trendCtx = this.trendLineChart.nativeElement.getContext('2d');
    this.trendLine = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: trendData.labels,
        datasets: [{
          label: 'Revenue Net Journalier',
          data: trendData.data,
          borderColor: '#003974',
          backgroundColor: 'rgba(0, 57, 116, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#003974',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: (val) => `${val} TND` } },
          x: { grid: { display: false } }
        }
      }
    });

    // Sales Bar Chart
    const barCtx = this.salesBarChart.nativeElement.getContext('2d');
    this.salesBar = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: this.productStats.slice(0, 8).map(p => p.productName),
        datasets: [{
          label: 'Volume de Ventes',
          data: this.productStats.slice(0, 8).map(p => p.totalQuantity),
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          barThickness: 25
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  calculateStatistics(): void {
    // Product Statistics
    const productMap = new Map<string, ProductStat>();
    const categoryMap = new Map<string, CategoryStat>();

    this.sales.forEach(sale => {
      // Product stats
      const existing = productMap.get(sale.productName) || {
        productName: sale.productName,
        totalSold: 0,
        totalQuantity: 0,
        revenue: 0,
        percentage: 0
      };
      existing.totalSold += 1;
      existing.totalQuantity += sale.quantity;
      existing.revenue += sale.totalAmount * 0.9; // Net Revenue
      productMap.set(sale.productName, existing);

      // Category stats
      const category = this.extractCategory(sale.productName);
      const catExisting = categoryMap.get(category) || {
        category,
        totalSales: 0,
        totalQuantity: 0,
        totalRevenue: 0
      };
      catExisting.totalSales += 1;
      catExisting.totalQuantity += sale.quantity;
      catExisting.totalRevenue += sale.totalAmount * 0.9; // Net Revenue
      categoryMap.set(category, catExisting);
    });

    // Convert to arrays and sort
    this.productStats = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue);

    // Calculate percentages
    const totalRevenue = this.productStats.reduce((sum, p) => sum + p.revenue, 0);
    this.productStats = this.productStats.map(p => ({
      ...p,
      percentage: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0
    }));

    this.categoryStats = Array.from(categoryMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Extract unique categories for filter
    this.categoryOptions = ['all', ...new Set(this.categoryStats.map(c => c.category))];

    // Top products
    if (this.productStats.length > 0) {
      this.topProductByRevenue = this.productStats[0];
      this.topProductBySales = [...this.productStats].sort((a, b) => b.totalQuantity - a.totalQuantity)[0];
    }

    // Totals
    this.totalProductsSold = this.sales.reduce((sum, s) => sum + s.quantity, 0);
    this.totalMoneyEarned = this.sales.reduce((sum, s) => sum + s.totalAmount, 0) * 0.9; // 90% Net
    this.averageOrderValue = this.sales.length > 0 ? this.totalMoneyEarned / this.sales.length : 0;
  }

  getTrendData(): { labels: string[], data: number[] } {
    const dailyMap = new Map<string, number>();
    
    // Sort sales by date ascending for the trend
    const sortedSales = [...this.sales].sort((a, b) => 
      new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime()
    );

    sortedSales.forEach(sale => {
      const date = new Date(sale.saleDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      dailyMap.set(date, (dailyMap.get(date) || 0) + (sale.totalAmount * 0.9));
    });

    return {
      labels: Array.from(dailyMap.keys()),
      data: Array.from(dailyMap.values())
    };
  }

  extractCategory(productName: string): string {
    // Extract category from product name or use 'Général' as default
    return 'Général';
  }

  applySortAndFilter(): void {
    let filtered = [...this.sales];

    // Filter by status
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(sale => sale.status === this.filterStatus);
    }

    // Filter by category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(sale => 
        this.extractCategory(sale.productName) === this.selectedCategory
      );
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
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredSales.length / this.pageSize);
    if (this.totalPages === 0) this.totalPages = 1;
    if (this.currentPage > this.totalPages) this.currentPage = 1;
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedSales = this.filteredSales.slice(start, start + this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  nextPage(): void { this.goToPage(this.currentPage + 1); }
  previousPage(): void { this.goToPage(this.currentPage - 1); }

  get pages(): number[] {
    const range: number[] = [];
    const delta = 2;
    const left = Math.max(1, this.currentPage - delta);
    const right = Math.min(this.totalPages, this.currentPage + delta);
    for (let i = left; i <= right; i++) range.push(i);
    return range;
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

  getStatusLabel(status: string): string {
    switch(status) {
      case 'completed': return 'Complétée';
      case 'pending': return 'En attente';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  }

  getPercentageBarColor(percentage: number): string {
    if (percentage > 30) return 'bg-green-500';
    if (percentage > 15) return 'bg-blue-500';
    if (percentage > 5) return 'bg-amber-500';
    return 'bg-gray-400';
  }

  exportToCsv(): void {
    const lines: string[] = [];
    
    // Add title and metadata
    lines.push(this.escapeCSV('RAPPORT DE VENTES - ARTISAN'));
    lines.push(this.escapeCSV(`Généré le: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`));
    lines.push('');

    // Add summary statistics
    lines.push(this.escapeCSV('RÉSUMÉ'));
    lines.push(this.joinCSV(['Nombre de ventes', this.filteredSales.length.toString()]));
    lines.push(this.joinCSV(['Produits vendus', this.totalProductsSold.toString()]));
    lines.push(this.joinCSV(['Revenus totaux', this.formatCurrency(this.totalMoneyEarned)]));
    lines.push(this.joinCSV(['Panier moyen', this.formatCurrency(this.averageOrderValue)]));
    lines.push('');

    // Add transaction details header
    const headers = ['Date', 'Produit', 'Quantité', 'Prix unitaire', 'Total', 'Acheteur', 'Statut'];
    lines.push(this.joinCSV(headers));

    // Add transaction data
    const data = this.filteredSales.map(sale => [
      new Date(sale.saleDate).toLocaleDateString('fr-FR'),
      sale.productName,
      sale.quantity.toString(),
      sale.unitPrice.toString(),
      sale.totalAmount.toString(),
      sale.buyerName,
      this.formatStatus(sale.status)
    ]);

    lines.push(...data.map(row => this.joinCSV(row)));

    // Add totals footer
    lines.push('');
    lines.push(this.joinCSV(['TOTAL', this.filteredSales.reduce((sum, s) => sum + s.totalAmount, 0).toString()]));
    lines.push(this.joinCSV(['Nombre de transactions', this.filteredSales.length.toString()]));

    // Add category breakdown if available
    if (this.categoryStats && this.categoryStats.length > 0) {
      lines.push('');
      lines.push(this.escapeCSV('VENTES PAR CATÉGORIE'));
      lines.push(this.joinCSV(['Catégorie', 'Nombre de ventes', 'Quantité', 'Revenus']));
      this.categoryStats.forEach(cat => {
        lines.push(this.joinCSV([
          cat.category,
          cat.totalSales.toString(),
          cat.totalQuantity.toString(),
          cat.totalRevenue.toString()
        ]));
      });
    }

    const csv = lines.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel compatibility
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ventes-artisan-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  private joinCSV(values: string[]): string {
    return values.map(v => this.escapeCSV(v)).join(';'); // Use semicolon as delimiter
  }

  private escapeCSV(value: string): string {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = value.toString();
    // If value contains semicolon, quote, or newline, wrap in quotes and escape internal quotes
    if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n')) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  private formatStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'completed': 'Complété',
      'pending': 'En attente',
      'cancelled': 'Annulé'
    };
    return statusMap[status] || status;
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
