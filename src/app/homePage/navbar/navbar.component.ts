import { Component, HostListener, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationClientService, BackendNotification } from '../../services/accommodation/notification-client.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationClientService = inject(NotificationClientService);

  isLoginDialogOpen = false;
  isUserMenuOpen = false;

  backendNotifs: BackendNotification[] = [];

  private notifSubscription?: Subscription;
  private pollingInterval?: ReturnType<typeof setInterval>;

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

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (this.isAuthenticated && this.isTouristUser()) {
      this.loadNotifications();
      // Polling toutes les 30 secondes pour les nouvelles notifications
      this.pollingInterval = setInterval(() => this.loadNotifications(), 30000);
      // Rechargement immédiat sur événement (ex: après markAsRead)
      this.notifSubscription = this.notificationClientService.notificationsUpdated$.subscribe(() => {
        this.loadNotifications();
      });
    }
  }

  ngOnDestroy(): void {
    this.notifSubscription?.unsubscribe();
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  // ─── Chargement notifications ───────────────────────────────────────────────

  loadNotifications(): void {
    this.notificationClientService.getMyNotifications().subscribe({
      next: (ns) => { this.backendNotifs = ns; },
      error: () => { this.backendNotifs = []; }
    });
  }

  get unreadNotifsCount(): number {
    const backendUnread = this.backendNotifs.filter(n => !n.isRead).length;
    const uid = this.authService.getCurrentUser()?.id ?? 0;
    const localUnread = this.notificationClientService.getLocalUnreadCount(uid);
    return backendUnread + localUnread;
  }

  isTouristUser(): boolean {
    return this.authService.getCurrentUser()?.role === 'CLIENT_TOURISTE';
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
    this.backendNotifs = [];
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
