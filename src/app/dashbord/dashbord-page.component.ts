import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ReservationService, ReservationResponse } from '../services/accommodation/reservation.service';
import { LogementService, Logement } from '../services/accommodation/logement.service';
import { ReclamationService, ReclamationItem } from '../services/accommodation/reclamation.service';
import { NotificationService } from '../services/accommodation/notification.service';

@Component({
  selector: 'app-dashbord-page',
  templateUrl: './dashbord-page.component.html',
  styleUrls: ['./dashbord-page.component.css']
})
export class DashbordPageComponent implements OnInit, OnDestroy {

  // ════════════════════════════════════════════════════════════════
  // SERVICES & STATE
  // ════════════════════════════════════════════════════════════════
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly reservationService = inject(ReservationService);
  private readonly logementService = inject(LogementService);
  private readonly reclamationService = inject(ReclamationService);
  private readonly notificationService = inject(NotificationService);
  private destroy$ = new Subject<void>();

  // ════════════════════════════════════════════════════════════════
  // ROUTING & UI
  // ════════════════════════════════════════════════════════════════
  isChildRoute = false;
  isCategoriePage = false;
  isFooterHidden = false;

  // ════════════════════════════════════════════════════════════════
  // DATA - RESERVATIONS
  // ════════════════════════════════════════════════════════════════
  reservations: ReservationResponse[] = [];
  totalReservations = 0;
  confirmedReservations = 0;
  cancelledReservations = 0;
  totalRevenueFromReservations = 0;
  recentReservations: ReservationResponse[] = [];

  // ════════════════════════════════════════════════════════════════
  // DATA - LOGEMENTS
  // ════════════════════════════════════════════════════════════════
  logements: Logement[] = [];
  totalLogements = 0;
  availableLogements = 0;
  maintenanceLogements = 0;
  totalCapacity = 0;
  avgPricePerNight = 0;

  // ════════════════════════════════════════════════════════════════
  // DATA - RECLAMATIONS
  // ════════════════════════════════════════════════════════════════
  reclamations: ReclamationItem[] = [];
  totalReclamations = 0;
  openReclamations = 0;
  inProgressReclamations = 0;
  resolvedReclamations = 0;

  // ════════════════════════════════════════════════════════════════
  // DATA - NOTIFICATIONS
  // ════════════════════════════════════════════════════════════════
  unreadNotifications = 0;
  totalNotifications = 0;

  // ════════════════════════════════════════════════════════════════
  // LOADING & ERROR STATES
  // ════════════════════════════════════════════════════════════════
  isLoading = true;
  dataError = '';

  // ════════════════════════════════════════════════════════════════
  // USER INFO
  // ════════════════════════════════════════════════════════════════
  currentUserRole = '';
  currentUserId = 0;

  ngOnInit(): void {
    this.checkRoute(this.router.url);

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: any) => {
      this.checkRoute(event.urlAfterRedirects);
    });

    // Load dynamic dashboard data
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkRoute(url: string): void {
    this.isChildRoute = url !== '/dashbord' && url !== '/dashboard';
    this.isCategoriePage = url.includes('/categorie');
    this.isFooterHidden =
      url.includes('/categorie') ||
      url.includes('/logements') ||
      url.includes('/reservations') ||
      url.includes('/notifications') ||
      url.includes('/reclamations');
  }

  /**
   * Load all dashboard data from various services
   */
  private loadDashboardData(): void {
    console.log('[Dashboard] Starting data load...');
    this.isLoading = true;
    this.dataError = '';

    const user = this.authService.getCurrentUser();
    if (!user) {
      console.error('[Dashboard] User not authenticated');
      this.dataError = 'Utilisateur non authentifié';
      this.isLoading = false;
      return;
    }

    this.currentUserRole = user.role || '';
    this.currentUserId = user.id || 0;

    // Track completion of async operations
    let completedOperations = 0;
    const totalOperations = 4;
    
    const checkAllComplete = () => {
      completedOperations++;
      console.log(`[Dashboard] Operation ${completedOperations}/${totalOperations} completed`);
      if (completedOperations >= totalOperations) {
        console.log('[Dashboard] All operations completed, hiding loading state');
        this.isLoading = false;
      }
    };

    // Safety timeout - ensure loading stops after 10 seconds
    const timeoutId = setTimeout(() => {
      console.warn('[Dashboard] Loading timeout - forcing completion');
      this.isLoading = false;
    }, 10000);

    // Load all data in parallel
    this.loadReservations(() => {
      checkAllComplete();
      clearTimeout(timeoutId);
    });
    this.loadLogements(() => {
      checkAllComplete();
      clearTimeout(timeoutId);
    });
    this.loadReclamations(() => {
      checkAllComplete();
      clearTimeout(timeoutId);
    });
    this.loadNotifications(() => {
      checkAllComplete();
      clearTimeout(timeoutId);
    });
  }

  /**
   * Load reservations and calculate statistics
   */
  private loadReservations(onComplete?: () => void): void {
    console.log('[Dashboard] Loading reservations...');
    this.reservationService.getAllReservations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          console.log('[Dashboard] Reservations loaded:', data?.length || 0);
          this.reservations = Array.isArray(data) ? data : [];
          this.calculateReservationStats();
          onComplete?.();
        },
        error: (err) => {
          console.error('[Dashboard] Error loading reservations:', err);
          this.reservations = [];
          this.calculateReservationStats();
          onComplete?.();
        }
      });
  }

  /**
   * Load logements and calculate statistics
   */
  private loadLogements(onComplete?: () => void): void {
    console.log('[Dashboard] Loading logements...');
    this.logementService.getLogements()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          console.log('[Dashboard] Logements loaded:', data?.length || 0);
          this.logements = Array.isArray(data) ? data : [];
          this.calculateLogementStats();
          onComplete?.();
        },
        error: (err) => {
          console.error('[Dashboard] Error loading logements:', err);
          this.logements = [];
          this.calculateLogementStats();
          onComplete?.();
        }
      });
  }

  /**
   * Load reclamations and calculate statistics
   */
  private loadReclamations(onComplete?: () => void): void {
    console.log('[Dashboard] Loading reclamations...');
    try {
      const allReclamations = this.reclamationService.getAll();
      console.log('[Dashboard] Reclamations loaded:', allReclamations?.length || 0);
      this.reclamations = Array.isArray(allReclamations) ? allReclamations : [];
      this.calculateReclamationStats();
      onComplete?.();
    } catch (err) {
      console.error('[Dashboard] Error loading reclamations:', err);
      this.reclamations = [];
      this.calculateReclamationStats();
      onComplete?.();
    }
  }

  /**
   * Load notifications and calculate statistics
   */
  private loadNotifications(onComplete?: () => void): void {
    console.log('[Dashboard] Loading notifications...');
    try {
      const notifications = this.notificationService.getForHebergeur(this.currentUserId);
      console.log('[Dashboard] Notifications loaded:', notifications?.length || 0);
      this.totalNotifications = notifications.length;
      this.unreadNotifications = notifications.filter(n => !n.read).length;
      onComplete?.();
    } catch (err) {
      console.error('[Dashboard] Error loading notifications:', err);
      this.totalNotifications = 0;
      this.unreadNotifications = 0;
      onComplete?.();
    }
  }

  /**
   * Calculate reservation statistics
   */
  private calculateReservationStats(): void {
    this.totalReservations = this.reservations.length;
    this.confirmedReservations = this.reservations.filter(r => r.statut === 'confirmee').length;
    this.cancelledReservations = this.reservations.filter(r => r.statut === 'annulee').length;

    // Calculate total revenue
    this.totalRevenueFromReservations = this.reservations.reduce((sum, r) => {
      const price = typeof r.prixTotal === 'string' 
        ? parseFloat(r.prixTotal) 
        : r.prixTotal || 0;
      return sum + (isNaN(price) ? 0 : price);
    }, 0);

    // Get 5 most recent reservations
    this.recentReservations = this.reservations
      .sort((a, b) => new Date(b.dateReservation).getTime() - new Date(a.dateReservation).getTime())
      .slice(0, 5);
  }

  /**
   * Calculate logement statistics
   */
  private calculateLogementStats(): void {
    this.totalLogements = this.logements.length;
    this.availableLogements = this.logements.filter(l => l.disponible).length;
    this.maintenanceLogements = this.logements.filter(l => !l.disponible).length;

    // Calculate total capacity
    this.totalCapacity = this.logements.reduce((sum, l) => sum + (l.capacite || 0), 0);

    // Calculate average price
    const pricesWithValues = this.logements
      .map(l => typeof l.prixNuit === 'string' ? parseFloat(l.prixNuit) : l.prixNuit || 0)
      .filter(p => !isNaN(p) && p > 0);
    
    this.avgPricePerNight = pricesWithValues.length > 0
      ? pricesWithValues.reduce((sum, p) => sum + p, 0) / pricesWithValues.length
      : 0;
  }

  /**
   * Calculate reclamation statistics
   */
  private calculateReclamationStats(): void {
    this.totalReclamations = this.reclamations.length;
    this.openReclamations = this.reclamations.filter(r => r.status === 'ouverte').length;
    this.inProgressReclamations = this.reclamations.filter(r => r.status === 'en_cours').length;
    this.resolvedReclamations = this.reclamations.filter(r => r.status === 'resolue').length;
  }

  
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Helper: Format date
   */
  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get status badge color
   */
  getStatusColor(status: string): string {
    if (!status) return 'bg-gray-100 text-gray-800';
    const s = status.toLowerCase();
    if (s === 'confirmee') return 'bg-green-100 text-green-800';
    if (s === 'annulee') return 'bg-red-100 text-red-800';
    if (s === 'en_attente') return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  }

  /**
   * Refresh all data
   */
  refreshData(): void {
    this.loadDashboardData();
  }

  /**
   * Helper: Parse price to number
   */
  parsePriceToNumber(price: any): number {
    if (typeof price === 'string') {
      return parseFloat(price) || 0;
    }
    return price || 0;
  }
}