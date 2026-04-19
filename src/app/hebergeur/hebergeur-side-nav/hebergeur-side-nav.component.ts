import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/accommodation/notification.service';
import { NotificationClientService } from '../../services/accommodation/notification-client.service';

@Component({
  selector: 'app-hebergeur-side-nav',
  templateUrl: './hebergeur-side-nav.component.html',
  styleUrls: ['./hebergeur-side-nav.component.css']
})
export class HebergeurSideNavComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly notificationClientService = inject(NotificationClientService);

  isMobileMenuOpen = false;
  unreadCount = 0;
  private sub!: Subscription;
  private intervalId: any;

  navItems = [
    { icon: 'space_dashboard', label: 'Tableau de bord', route: '/hebergeur', badge: false },
    { icon: 'holiday_village', label: 'Mes logements', route: '/hebergeur/logements', badge: false },
    { icon: 'add_home_work', label: 'Ajouter un logement', route: '/hebergeur/logements/ajout', badge: false },
    { icon: 'category', label: 'Catégories', route: '/hebergeur/categories', badge: false },
    { icon: 'book_online', label: 'Réservations', route: '/hebergeur/reservations', badge: false },
    { icon: 'support_agent', label: 'Réclamations', route: '/hebergeur/reclamations', badge: false },
    { icon: 'notifications', label: 'Notifications', route: '/hebergeur/notifications', badge: true },
    { icon: 'settings', label: 'Paramètres', route: '/hebergeur/parametres', badge: false }
  ];

  ngOnInit(): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (userId) {
      this.sub = this.notificationService.notifications$.subscribe(() => {
        this.updateCounts(userId);
      });
      // S'abonner aux rafraichissements instantanés du backend
      this.notificationClientService.notificationsUpdated$.subscribe(() => {
        this.updateCounts(userId);
      });
      this.updateCounts(userId);
      this.intervalId = setInterval(() => this.updateCounts(userId), 10000); // Polling toutes les 10 secondes
    }
  }

  updateCounts(userId: number): void {
    const localCount = this.notificationService.getUnreadCount(userId);
    this.notificationClientService.getMyNotifications().subscribe(ns => {
      const backendCount = ns.filter(n => !n.isRead).length;
      this.unreadCount = localCount + backendCount;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  isActive(route: string): boolean {
    if (route === '/hebergeur') {
      return this.router.url === '/hebergeur' || this.router.url === '/hebergeur/';
    }
    return this.router.url.startsWith(route);
  }

  navigate(route: string): void {
    this.router.navigate([route]);
    this.isMobileMenuOpen = false;
  }

  getCurrentUserName(): string {
    return this.authService.getCurrentUser()?.username || 'Hôte';
  }

  getCurrentUserEmail(): string {
    return this.authService.getCurrentUser()?.email || '';
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
}
