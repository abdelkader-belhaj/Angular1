import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ArtisanService, Artisan } from '../../../services/artisan.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-artisan-dashboard',
  templateUrl: './artisan-dashboard.component.html',
  styleUrls: ['./artisan-dashboard.component.css']
})
export class ArtisanDashboardComponent implements OnInit {
  artisan: Artisan | null = null;
  stats: any = null;
  isLoading = true;
  sidebarOpen = true;

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

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
