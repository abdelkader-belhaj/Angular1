import { Component, HostListener, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
// ========== IMPORT SPÉCIFIQUE: MES RÉSERVATIONS ==========
import { NotificationClientService, BackendNotification } from '../../services/accommodation/notification-client.service';
// ========== FIN IMPORT: MES RÉSERVATIONS ==========

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  // ========== SERVICE SPÉCIFIQUE: MES RÉSERVATIONS ==========
  private readonly notificationClientService = inject(NotificationClientService);
  // ========== FIN SERVICE: MES RÉSERVATIONS ==========

  isLoginDialogOpen = false;
  isUserMenuOpen = false;
  
  // ========== PROPRIÉTÉS SPÉCIFIQUES: MES RÉSERVATIONS ==========
  // Stockage des notifications backend pour les réservations
  backendNotifs: BackendNotification[] = [];
  // ========== FIN PROPRIÉTÉS: MES RÉSERVATIONS ==========

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

  // ========== MÉTHODES SPÉCIFIQUES: MES RÉSERVATIONS ==========
  // Méthode pour charger les notifications de réservations
  ngOnInit(): void {
    if (this.isAuthenticated && this.isTouristUser()) {
      this.loadNotifications();
      // S'abonner aux mises à jour des notifications
      this.notificationClientService.notificationsUpdated$.subscribe(() => {
        this.loadNotifications();
      });
    }
  }

  // Charger les notifications depuis le backend
  loadNotifications(): void {
    this.notificationClientService.getMyNotifications().subscribe({
      next: (ns) => {
        this.backendNotifs = ns;
      },
      error: (error) => {
        console.error('Erreur chargement notifications', error);
        this.backendNotifs = [];
      }
    });
  }

  // Compter les notifications non lues pour le badge
  get unreadNotifsCount(): number {
    return this.backendNotifs.filter(n => !n.isRead).length;
  }

  // Vérifier si l'utilisateur est un touriste (pour afficher le bouton Mes Réservations)
  isTouristUser(): boolean {
    return this.authService.getCurrentUser()?.role === 'CLIENT_TOURISTE';
  }
  // ========== FIN MÉTHODES: MES RÉSERVATIONS ==========

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
    // ========== NETTOYAGE SPÉCIFIQUE: MES RÉSERVATIONS ==========
    // Vider les notifications lors de la déconnexion
    this.backendNotifs = [];
    // ========== FIN NETTOYAGE: MES RÉSERVATIONS ==========
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
