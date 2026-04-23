import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ReclamationService } from '../../services/reclamation.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly reclamationService = inject(ReclamationService);

  isLoginDialogOpen = false;
  isUserMenuOpen = false;
  unreadReclamations = 0;

  ngOnInit(): void {
    this.refreshUnreadReclamations();
  }

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

  get isClientTouriste(): boolean {
    return this.authService.getCurrentUser()?.role === 'CLIENT_TOURISTE';
  }

  get currentUserBio(): string {
    const bio = this.authService.getCurrentUser()?.bio?.trim();
    return bio && bio.length > 0 ? bio : 'Ajoutez une bio depuis Mon profil';
  }

  get currentUserModuleLabel(): string {
    return this.isAdminUser ? 'Tableau de bord' : 'Mon espace';
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
    if (this.isUserMenuOpen) {
      this.refreshUnreadReclamations();
    }
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

  async goToMesReclamations(): Promise<void> {
    this.isUserMenuOpen = false;
    await this.router.navigate(['/reclamations/mes']);
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

  private refreshUnreadReclamations(): void {
    if (!this.authService.isAuthenticated() || !this.isClientTouriste) {
      this.unreadReclamations = 0;
      return;
    }
    this.reclamationService.unreadCount().subscribe({
      next: (res) => (this.unreadReclamations = Number(res?.unread ?? 0)),
      error: () => (this.unreadReclamations = 0)
    });
  }
}
