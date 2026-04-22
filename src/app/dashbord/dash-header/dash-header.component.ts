import { Component, HostListener, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dash-header',
  templateUrl: './dash-header.component.html',
  styleUrl: './dash-header.component.css'
})
export class DashHeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @Input() showContextBlock = false;

  isAccountMenuOpen = false;

  get currentUserName(): string {
    return this.authService.getCurrentUser()?.username ?? 'Administrateur';
  }

  toggleAccountMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isAccountMenuOpen = !this.isAccountMenuOpen;
  }

  async goToProfile(): Promise<void> {
    this.isAccountMenuOpen = false;
    await this.router.navigate(['/profile']);
  }

  async logout(): Promise<void> {
    this.isAccountMenuOpen = false;
    await firstValueFrom(this.authService.logout());
    await this.router.navigate(['/']);
  }

  @HostListener('document:click')
  closeAccountMenuOnOutsideClick(): void {
    this.isAccountMenuOpen = false;
  }
}
