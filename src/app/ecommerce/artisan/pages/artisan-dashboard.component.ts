import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ArtisanService, Artisan, ArtisanProduct } from '../../../services/artisan.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-artisan-dashboard',
  templateUrl: './artisan-dashboard.component.html',
  styleUrls: ['./artisan-dashboard.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class ArtisanDashboardComponent implements OnInit {
  artisan: Artisan | null = null;
  stats: any = null;
  isLoading = true;
  sidebarOpen = true;
  productsCount = 0;

  constructor(
    private artisanService: ArtisanService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    Promise.all([
      new Promise(resolve => {
        this.artisanService.getCurrentArtisan().subscribe(
          (artisan) => {
            this.artisan = artisan;
            resolve(null);
          },
          (error) => {
            console.error('Error loading artisan:', error);
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
      }),
      new Promise(resolve => {
        this.artisanService.getArtisanProducts().subscribe(
          (products: ArtisanProduct[]) => {
            this.productsCount = products.length;
            if (this.artisan) {
              this.artisan.productsCount = this.productsCount;
            }
            resolve(null);
          },
          (error) => {
            console.error('Error loading products:', error);
            resolve(null);
          }
        );
      })
    ]).then(() => {
      this.isLoading = false;
    });
  }

  navigateTo(path: string): void {
    this.router.navigate([`/artisan/${path}`]);
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.authService.logout());
    } catch {
      this.authService.clearLocalAuth();
    }
    await this.router.navigate(['/']);
  }
}
