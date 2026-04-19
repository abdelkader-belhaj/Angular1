import { Component, inject, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dash-header',
  templateUrl: './dash-header.component.html',
  styleUrl: './dash-header.component.css'
})
export class DashHeaderComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isCategoriePage = false;
  isLogementsPage = false;
  pageTitle = 'Tableau de Bord';
  pageSubtitle = '';

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateRoute(event.urlAfterRedirects);
    });
    this.updateRoute(this.router.url);
  }

  updateRoute(url: string): void {
    this.isCategoriePage = url.includes('/categorie');
    this.isLogementsPage = url.includes('/logements');

    if (url.includes('/reservations')) {
      this.pageTitle = '';
      this.pageSubtitle = '';
      return;
    }

    if (this.isLogementsPage) {
      this.pageTitle = 'Hébergement';
      this.pageSubtitle = '';
    } else {
      this.pageTitle = 'Tableau de Bord';
      this.pageSubtitle = '';
    }
  }

  async logout(): Promise<void> {
    this.authService.logout();
    await this.router.navigate(['/']);
  }
}
