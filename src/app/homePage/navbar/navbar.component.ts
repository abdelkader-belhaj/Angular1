import { Component, HostListener, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';

import { firstValueFrom, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationClientService, BackendNotification } from '../../services/accommodation/notification-client.service';
import { ReclamationService } from '../../services/reclamation.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationClientService = inject(NotificationClientService);
  private readonly reclamationService = inject(ReclamationService);
  private readonly cdr = inject(ChangeDetectorRef);

  isLoginDialogOpen = false;
  isUserMenuOpen = false;
  unreadReclamations = 0;
  currentUrl = '';

  backendNotifs: BackendNotification[] = [];

  private notifSubscription?: Subscription;
  private pollingInterval?: ReturnType<typeof setInterval>;

  // ================== GETTERS ==================

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

  get isOrganisateurUser(): boolean {
    return this.authService.getCurrentUser()?.role === 'ORGANISATEUR';
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

  get unreadNotifsCount(): number {
    const backendUnread = this.backendNotifs.filter(n => !n.isRead).length;
    const uid = this.authService.getCurrentUser()?.id ?? 0;
    const localUnread = this.notificationClientService.getLocalUnreadCount(uid);
    return backendUnread + localUnread;
  }

  // ================== GETTERS ÉVÉNEMENTS (ajoutés) ==================

  get showOrganisateurMenu(): boolean {
    return this.isOrganisateurUser;
  }

  get showEventsMenu(): boolean {
    if (this.isOrganisateurUser) return false;
    return this.currentUrl.startsWith('/events')
      || this.currentUrl.startsWith('/mes-reservations-event')
      || this.currentUrl.startsWith('/payment')
      || this.currentUrl.startsWith('/ticket');
  }

  get showDefaultMenu(): boolean {
    if (this.isOrganisateurUser) return false;
    return !this.showEventsMenu;
  }

  // ================== LIFECYCLE ==================

  ngOnInit(): void {
    this.currentUrl = this.router.url;
    
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentUrl = event.urlAfterRedirects;
        this.cdr.detectChanges();
      }
    });

    this.refreshUnreadReclamations();

    if (this.isAuthenticated && this.isClientTouriste) {
      this.loadNotifications();

      this.pollingInterval = setInterval(() => this.loadNotifications(), 30000);

      this.notifSubscription =
        this.notificationClientService.notificationsUpdated$
          .subscribe(() => this.loadNotifications());
    }
  }

  ngOnDestroy(): void {
    this.notifSubscription?.unsubscribe();
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  // ================== NOTIFICATIONS ==================

  loadNotifications(): void {
    this.notificationClientService.getMyNotifications().subscribe({
      next: (ns) => this.backendNotifs = ns,
      error: () => this.backendNotifs = []
    });
  }

  // ================== ACTIONS ==================

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

  async goToHome(): Promise<void> {
    if (this.isOrganisateurUser) return;
    await this.router.navigate(['/']);
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

  async onEventsMenuClick(event: MouseEvent): Promise<void> {
    event.preventDefault();
    if (this.isOrganisateurUser) {
      await this.router.navigate(['/organisateur']);
      return;
    }
    await this.router.navigate(['/events']);
  }

  async goToOrganisateurSpace(event?: MouseEvent): Promise<void> {
    event?.preventDefault();
    await this.router.navigate(['/organisateur']);
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

  // ================== RECLAMATIONS ==================

  private refreshUnreadReclamations(): void {
    if (!this.isAuthenticated || !this.isClientTouriste) {
      this.unreadReclamations = 0;
      return;
    }

    this.reclamationService.unreadCount().subscribe({
      next: (res) => this.unreadReclamations = Number(res?.unread ?? 0),
      error: () => this.unreadReclamations = 0
    });
  }
}