import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dash-side-nav',
  templateUrl: './side-nav.component.html',
  styleUrl: './side-nav.component.css'
})
export class SideNavComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isAccommodationExpanded = true;

  toggleAccommodation() {
    this.isAccommodationExpanded = !this.isAccommodationExpanded;
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.authService.logout());
    await this.router.navigate(['/']);
  }
}
