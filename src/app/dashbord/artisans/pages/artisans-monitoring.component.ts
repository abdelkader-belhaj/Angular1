import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ArtisanService, Artisan } from '../../../services/artisan.service';

@Component({
  selector: 'app-artisans-monitoring',
  templateUrl: './artisans-monitoring.component.html',
  styleUrls: ['./artisans-monitoring.component.css']
})
export class ArtisansMonitoringComponent implements OnInit {
  artisans: Artisan[] = [];
  filteredArtisans: Artisan[] = [];
  isLoading = true;

  filterStatus = 'all';
  searchQuery = '';
  sortBy = 'revenue';

  statusOptions = ['all', 'active', 'suspended', 'pending'];
  sortOptions = [
    { value: 'revenue', label: 'Revenue (high to low)' },
    { value: 'sales', label: 'Sales (high to low)' },
    { value: 'products', label: 'Products (high to low)' },
    { value: 'joined', label: 'Recently joined' }
  ];

  constructor(
    private artisanService: ArtisanService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadArtisans();
  }

  loadArtisans(): void {
    this.artisanService.getAllArtisans().subscribe(
      (artisans) => {
        this.artisans = artisans;
        this.applyFiltersAndSort();
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading artisans:', error);
        this.isLoading = false;
      }
    );
  }

  applyFiltersAndSort(): void {
    let filtered = [...this.artisans];

    // Filter by status
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === this.filterStatus);
    }

    // Search
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.businessName.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query) ||
        a.email.toLowerCase().includes(query)
      );
    }

    // Sort
    if (this.sortBy === 'revenue') {
      filtered.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } else if (this.sortBy === 'sales') {
      filtered.sort((a, b) => b.totalProductsSold - a.totalProductsSold);
    } else if (this.sortBy === 'products') {
      filtered.sort((a, b) => (b.productsCount || 0) - (a.productsCount || 0));
    } else if (this.sortBy === 'joined') {
      filtered.sort((a, b) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime());
    }

    this.filteredArtisans = filtered;
  }

  onSearch(): void {
    this.applyFiltersAndSort();
  }

  onFilterChange(): void {
    this.applyFiltersAndSort();
  }

  onSortChange(): void {
    this.applyFiltersAndSort();
  }

  viewArtisanDetails(artisanId: number): void {
    this.router.navigate(['/dashbord/artisans', artisanId]);
  }

  suspendArtisan(artisanId: number, event: Event): void {
    event.stopPropagation();
    if (confirm('Êtes-vous sûr de vouloir suspendre cet artisan?')) {
      this.artisanService.suspendArtisan(artisanId).subscribe(
        () => {
          alert('Artisan suspendu avec succès!');
          this.loadArtisans();
        },
        (error) => {
          console.error('Error suspending artisan:', error);
          alert('Erreur lors de la suspension');
        }
      );
    }
  }

  activateArtisan(artisanId: number, event: Event): void {
    event.stopPropagation();
    if (confirm('Êtes-vous sûr de vouloir activer cet artisan?')) {
      this.artisanService.activateArtisan(artisanId).subscribe(
        () => {
          alert('Artisan activé avec succès!');
          this.loadArtisans();
        },
        (error) => {
          console.error('Error activating artisan:', error);
          alert('Erreur lors de l\'activation');
        }
      );
    }
  }

  getStatusColor(status: string): string {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'suspended': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }
}
