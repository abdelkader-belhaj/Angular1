import { Component, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isLoginDialogOpen = false;
  isUserMenuOpen = false;

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  get currentUserName(): string {
    return this.authService.getCurrentUser()?.username ?? 'Utilisateur';
  }

  get currentUserRole(): string {
    const role = this.authService.getCurrentUser()?.role ?? '';
    return role.replaceAll('_', ' ');
  }

  get isAdminUser(): boolean {
    return this.authService.getCurrentUser()?.role === 'ADMIN';
  }

  get currentUserBio(): string {
    const bio = this.authService.getCurrentUser()?.bio?.trim();
    return bio && bio.length > 0 ? bio : 'Ajoutez une bio depuis Mon profil';
  }

  openLoginDialog(): void {
    this.isLoginDialogOpen = true;
  }

  closeLoginDialog(): void {
    this.isLoginDialogOpen = false;
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  async goToProfile(): Promise<void> {
    this.isUserMenuOpen = false;
    await this.router.navigate(['/profile']);
  }

  async goToSecurity(): Promise<void> {
    this.isUserMenuOpen = false;
    await this.router.navigate(['/security']);
  }

  async goToRoleModule(): Promise<void> {
    const role = this.authService.getCurrentUser()?.role;
    this.isUserMenuOpen = false;
    await this.router.navigateByUrl(this.authService.getRouteForRole(role));
  }

  async logout(): Promise<void> {
    this.isUserMenuOpen = false;
    try {
      await firstValueFrom(this.authService.logout());
    } catch {
      this.authService.clearLocalAuth();
    }
    await this.router.navigate(['/homePage']);
  }

  @HostListener('document:click')
  closeUserMenuOnOutsideClick(): void {
    this.isUserMenuOpen = false;
  }
}
