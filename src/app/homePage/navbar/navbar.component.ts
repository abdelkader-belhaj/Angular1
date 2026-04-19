import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationClientService, BackendNotification } from '../../services/accommodation/notification-client.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {
  isLoginDialogOpen = false;
  showUserMenu = false;
  profileImage: string = '';
  backendNotifs: BackendNotification[] = [];

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationClientService = inject(NotificationClientService);

  ngOnInit(): void {
    this.profileImage = this.getRandomProfileImage();
    if (this.isAuthenticated) {
      this.loadNotifications();
      this.notificationClientService.notificationsUpdated$.subscribe(() => {
        this.loadNotifications();
      });
    }
  }

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

  get unreadNotifsCount(): number {
    return this.backendNotifs.filter(n => !n.isRead).length;
  }



  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  get currentUser() {
    return this.authService.getCurrentUser();
  }

  openLoginDialog(): void {
    this.isLoginDialogOpen = true;
  }

  closeLoginDialog(): void {
    this.isLoginDialogOpen = false;
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  logout(): void {
    this.authService.logout();
    this.showUserMenu = false;
    this.backendNotifs = [];
  }

  getRoleLabel(role?: string): string {
    switch (role) {
      case 'CLIENT_TOURISTE': return 'Client Touriste';
      case 'HEBERGEUR': return 'Hébergeur';
      case 'ADMIN': return 'Administrateur';
      case 'TRANSPORTEUR': return 'Transporteur';
      case 'AIRLINE_PARTNER': return 'Partenaire Aérien';
      case 'ORGANISATEUR': return 'Organisateur';
      case 'VENDEUR_ARTI': return 'Vendeur Artisan';
      case 'SOCIETE': return 'Société';
      default: return 'Utilisateur';
    }
  }

  getUserAvatar(role?: string): string {
    const avatars: { [key: string]: string } = {
      'CLIENT_TOURISTE': 'assets/images/avatar-tourist.svg',
      'HEBERGEUR': 'assets/images/avatar-host.svg',
      'ADMIN': 'assets/images/avatar-admin.svg',
      'TRANSPORTEUR': 'assets/images/avatar-transport.svg',
      'AIRLINE_PARTNER': 'assets/images/avatar-airline.svg',
      'ORGANISATEUR': 'assets/images/avatar-organizer.svg',
      'VENDEUR_ARTI': 'assets/images/avatar-artisan.svg',
      'SOCIETE': 'assets/images/avatar-company.svg'
    };
    return avatars[role || 'CLIENT_TOURISTE'] || 'assets/images/avatar-default.svg';
  }

  isHostUser(): boolean {
    return this.currentUser?.role === 'HEBERGEUR';
  }

  isTouristUser(): boolean {
    return this.currentUser?.role === 'CLIENT_TOURISTE';
  }

  editProfile(): void {
    this.showUserMenu = false;
    this.router.navigate(['/profile']);
  }

  getProfileImage(): string {
    return this.profileImage;
  }

  private getRandomProfileImage(): string {
    const profileImages = [
      'assets/images/profile1.jpg',
      'assets/images/profile2.jpg',
      'assets/images/profile3.jpg'
    ];
    const randomIndex = Math.floor(Math.random() * profileImages.length);
    return profileImages[randomIndex];
  }

  getUserDisplayName(): string {
    return this.currentUser?.username || this.currentUser?.email || 'Utilisateur';
  }
}
