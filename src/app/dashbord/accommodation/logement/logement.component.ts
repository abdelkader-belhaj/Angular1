import { Component, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { LogementService, Logement, LogementRequest } from '../../../services/accommodation/logement.service';
import { CategorieService, Categorie } from '../../../services/accommodation/categorie.service';
import { AuthService } from '../../../services/auth.service';
import {
  HostHubMeta,
  getHostLogementStatus,
  mergeDescriptionWithMeta,
  parseHostHubMeta,
  stripHostHubMeta,
  HostLogementStatus
} from '../../../hebergeur/hosthub-meta';
import { NotificationService } from '../../../services/accommodation/notification.service';
import { AiPricePredictionService } from '../../../services/accommodation/ai-price-prediction.service';

@Component({
  selector: 'app-logement',
  templateUrl: './logement.component.html',
  styleUrls: ['./logement.component.css']
})
export class LogementComponent implements OnInit {
  logements: Logement[] = [];
  categories: Categorie[] = [];
  selectedCategoryId = 0;
  loading = true;
  error = false;

  showEditModal = false;
  showDeleteModal = false;

  selectedLogement: Logement | null = null;
  deletingLogement: Logement | null = null;

  formData: LogementRequest = {
    idCategorie: 0,
    nom: '',
    description: '',
    imageUrls: [],
    videoUrl: '',
    adresse: '',
    ville: '',
    prixNuit: 0,
    capacite: 1,
    disponible: true
  };

  loadingCounter = 0;
  deletingLogementId?: number;
  savingLogs = false;
  
  predictingPrice = false;
  enhancingDescription = false;
  enhancingReason = false;

  formErrors: any = {};
  requestError = '';
  loadError = '';
  
  actionReason = '';
  reasonError = '';

  hostHubMode = false;
  searchQuery = '';
  statusFilter: HostLogementStatus | 'all' = 'all';
  adminArchiveView: 'active' | 'archived' = 'active';
  editMeta: HostHubMeta = {};
  private readonly adminArchivedStorageKey = 'admin_archived_logements_ids';
  private adminArchivedLogementIds = new Set<number>();

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly predictorService = inject(AiPricePredictionService);

  constructor(
    private readonly logementService: LogementService,
    private readonly categorieService: CategorieService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.error = true;
      this.loadError = 'Vous devez être connecté pour accéder à cette page.';
      return;
    }
    this.refreshHostMode();
    this.loadAdminArchivedIds();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.refreshHostMode());
    this.loadCategories();
    this.loadLogements();
  }

  private refreshHostMode(): void {
    this.hostHubMode = this.router.url.includes('/hebergeur/logements');
  }

  loadLogements(): void {
    this.loading = true;
    this.error = false;
    this.loadError = '';
    this.logementService.getLogements().subscribe({
      next: (data) => {
        this.logements = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur loadLogements:', err);
        this.error = true;
        this.loadError = err?.error?.message || err?.message || 'Erreur lors du chargement des hébergements.';
        this.loading = false;
      }
    });
  }

  loadCategories(): void {
    this.categorieService.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
      },
      error: () => {
        this.categories = [];
      }
    });
  }

  get filteredLogements(): Logement[] {
    let list = this.logements;
    if (this.hostHubMode) {
      const uid = this.authService.getCurrentUser()?.id;
      if (uid) {
        list = list.filter((l) => l.idHebergeur === uid);
      }
    }
    if (!this.selectedCategoryId) {
      return list;
    }
    return list.filter((logement) => logement.idCategorie === this.selectedCategoryId);
  }

  get displayedLogements(): Logement[] {
    let list = this.filteredLogements;
    if (!this.hostHubMode) {
      return list;
    }
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.nom.toLowerCase().includes(q) ||
          (l.ville || '').toLowerCase().includes(q) ||
          (l.nomCategorie || '').toLowerCase().includes(q)
      );
    }
    if (this.statusFilter !== 'all') {
      list = list.filter((l) => getHostLogementStatus(l.disponible, l.description) === this.statusFilter);
    }
    return list;
  }

  get adminVisibleLogements(): Logement[] {
    const base = this.filteredLogements;
    if (this.adminArchiveView === 'archived') {
      return base.filter((l) => this.isAdminArchived(l));
    }
    return base.filter((l) => !this.isAdminArchived(l));
  }

  get adminArchivedCount(): number {
    return this.filteredLogements.filter((l) => this.isAdminArchived(l)).length;
  }

  get adminActiveCount(): number {
    return this.filteredLogements.filter((l) => !this.isAdminArchived(l)).length;
  }

  setAdminArchiveView(view: 'active' | 'archived'): void {
    this.adminArchiveView = view;
  }

  get statusCounts(): Record<HostLogementStatus, number> {
    const base = this.filteredLogements;
    return {
      disponible: base.filter((l) => getHostLogementStatus(l.disponible, l.description) === 'disponible').length,
      occupe: base.filter((l) => getHostLogementStatus(l.disponible, l.description) === 'occupe').length,
      maintenance: base.filter((l) => getHostLogementStatus(l.disponible, l.description) === 'maintenance').length
    };
  }

  hostStatusLabel(logement: Logement): string {
    const s = getHostLogementStatus(logement.disponible, logement.description);
    if (s === 'disponible') return 'Disponible';
    if (s === 'occupe') return 'Occupé';
    return 'Maintenance';
  }

  hostStatusClass(logement: Logement): string {
    const s = getHostLogementStatus(logement.disponible, logement.description);
    if (s === 'disponible') return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
    if (s === 'occupe') return 'bg-sky-50 text-sky-900 ring-sky-100';
    return 'bg-amber-50 text-amber-900 ring-amber-100';
  }

  cardExcerpt(logement: Logement): string {
    const t = stripHostHubMeta(logement.description);
    return t.length > 120 ? `${t.slice(0, 120)}…` : t || '—';
  }

  openEditModal(logement: Logement): void {
    this.selectedLogement = logement;
    this.formErrors = {};
    this.requestError = '';
    this.actionReason = '';
    this.reasonError = '';
    this.editMeta = { ...parseHostHubMeta(logement.description) };
    this.formData = {
      idCategorie: logement.idCategorie,
      nom: logement.nom,
      description: stripHostHubMeta(logement.description || ''),
      imageUrls: logement.imageUrl ? [logement.imageUrl] : [],
      videoUrl: logement.videoUrl || '',
      adresse: logement.adresse || '',
      ville: logement.ville || '',
      prixNuit: logement.prixNuit || 0,
      capacite: logement.capacite,
      disponible: logement.disponible
    };
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedLogement = null;
    this.requestError = '';
    this.editMeta = {};
  }

  openDeleteModal(logement: Logement): void {
    this.deletingLogement = logement;
    this.requestError = '';
    this.actionReason = '';
    this.reasonError = '';
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.deletingLogement = null;
    this.requestError = '';
  }

  saveLogement(): void {
    if (!this.validateForm()) {
      return;
    }

    if (!this.canManageLogements()) {
      this.requestError = 'Action réservée aux administrateurs et hébergeurs.';
      return;
    }

    if (!this.hostHubMode && this.selectedLogement) {
      if (!this.actionReason || !this.actionReason.trim()) {
        this.reasonError = 'Le motif de modification est obligatoire poud avertir l\'hébergeur.';
        return;
      }
    }

    const descriptionOut = mergeDescriptionWithMeta(this.formData.description, this.editMeta);
    const requestData = {
      ...this.formData,
      description: descriptionOut,
      disponible: this.editMeta.maintenance ? false : this.formData.disponible,
      imageUrl: this.formData.imageUrls.length > 0 ? this.formData.imageUrls[0] : ''
    };

    if (this.selectedLogement) {
      this.logementService.updateLogement(this.selectedLogement.idLogement, requestData).subscribe({
        next: () => {
          if (!this.hostHubMode && this.selectedLogement?.idHebergeur) {
            this.notificationService.addNotification(
              this.selectedLogement.idHebergeur,
              'modification',
              requestData.nom,
              'Un administrateur a modifié les informations de votre logement.',
              this.actionReason
            );
          }
          this.loadLogements();
          this.closeEditModal();
        },
        error: (err) => {
          console.error('Erreur update logement:', err);
          this.requestError = err?.error?.message || 'Impossible de mettre à jour le logement.';
        }
      });
      return;
    }

    this.logementService.createLogement(requestData).subscribe({
      next: () => {
        this.loadLogements();
        this.closeEditModal();
      },
      error: (err) => {
        console.error('Erreur create logement:', err);
        this.requestError = err?.error?.message || 'Impossible de créer le logement.';
      }
    });
  }

  confirmDelete(): void {
    if (!this.canManageLogements()) {
      this.requestError = 'Action réservée aux administrateurs et hébergeurs.';
      return;
    }

    if (!this.deletingLogement) {
      return;
    }

    if (!this.hostHubMode) {
      if (!this.actionReason || !this.actionReason.trim()) {
        this.reasonError = 'Le motif de suppression est obligatoire pour avertir l\'hébergeur.';
        return;
      }
    }

    this.logementService.deleteLogement(this.deletingLogement.idLogement)
      .subscribe({
        next: () => {
          if (!this.hostHubMode && this.deletingLogement?.idHebergeur) {
            this.notificationService.addNotification(
              this.deletingLogement.idHebergeur,
              'suppression',
              this.deletingLogement.nom,
              'Un administrateur a supprimé votre logement de la plateforme.',
              this.actionReason
            );
          }
          this.loadLogements();
          this.closeDeleteModal();
        },
        error: (err) => {
          console.error('Erreur delete logement:', err);
          this.requestError = err?.error?.message || 'Impossible de supprimer le logement.';
        }
      });
  }

  toggleArchiveLogement(logement: Logement): void {
    if (!this.canManageLogements()) {
      this.requestError = 'Action réservée aux administrateurs et hébergeurs.';
      return;
    }

    const id = logement.idLogement;
    if (this.adminArchivedLogementIds.has(id)) {
      this.adminArchivedLogementIds.delete(id);
    } else {
      this.adminArchivedLogementIds.add(id);
    }
    this.persistAdminArchivedIds();
  }

  isAdminArchived(logement: Logement): boolean {
    return this.adminArchivedLogementIds.has(logement.idLogement);
  }

  getArchiveActionLabel(logement: Logement): string {
    return this.isAdminArchived(logement) ? 'Restaurer' : 'Archiver';
  }

  private loadAdminArchivedIds(): void {
    try {
      const raw = localStorage.getItem(this.adminArchivedStorageKey);
      const values = raw ? (JSON.parse(raw) as number[]) : [];
      this.adminArchivedLogementIds = new Set(values);
    } catch {
      this.adminArchivedLogementIds = new Set<number>();
    }
  }

  private persistAdminArchivedIds(): void {
    localStorage.setItem(this.adminArchivedStorageKey, JSON.stringify([...this.adminArchivedLogementIds]));
  }

  validateForm(): boolean {
    this.formErrors = {};
    this.requestError = '';

    if (!this.formData.nom.trim()) {
      this.formErrors.nom = 'Nom du logement obligatoire.';
    }
    if (this.formData.idCategorie <= 0) {
      this.formErrors.idCategorie = 'Catégorie obligatoire.';
    }
    if (!this.formData.description.trim()) {
      this.formErrors.description = 'Description obligatoire.';
    }
    if (!this.formData.ville.trim()) {
      this.formErrors.ville = 'Ville obligatoire.';
    }
    if (!this.formData.adresse.trim()) {
      this.formErrors.adresse = 'Adresse obligatoire.';
    }
    if (this.formData.prixNuit <= 0) {
      this.formErrors.prixNuit = 'Prix par nuit doit être supérieur à 0.';
    }
    if (this.formData.capacite < 1) {
      this.formErrors.capacite = 'Capacité doit être au moins 1.';
    }

    return Object.keys(this.formErrors).length === 0;
  }

  formatPrice(value?: number): string {
    if (value == null) {
      return '-';
    }
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      maximumFractionDigits: 2
    }).format(value);
  }

  formatDate(value?: string): string {
    if (!value) {
      return '-';
    }
    return new Date(value).toLocaleDateString('fr-FR');
  }

  canManageLogements(): boolean {
    const r = this.authService.getCurrentUser()?.role;
    return r === 'ADMIN' || r === 'HEBERGEUR';
  }

  onMaintenanceToggle(): void {
    if (this.editMeta.maintenance) {
      this.formData.disponible = false;
    }
  }

  onFileSelected(event: Event, field: 'imageUrls' | 'videoUrl'): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (field === 'imageUrls') {
      this.formData.imageUrls.push(file.name);
    } else {
      this.formData[field] = file.name;
    }
  }

  removeImage(index: number): void {
    this.formData.imageUrls.splice(index, 1);
  }

  getImage(imageName: string): string {
    if (!imageName) return '/assets/images/default.jpg';
    if (imageName.startsWith('http')) return imageName;
    if (imageName.startsWith('data:')) return imageName;
    return `/assets/images/${imageName}`;
  }

  getVideo(videoName: string): string {
    if (!videoName) return '';
    if (videoName.startsWith('http')) return videoName;
    if (videoName.startsWith('data:')) return videoName;
    return `/assets/videos/${videoName}`;
  }

  scrollModalTop(): void {
    const modalContent = document.querySelector('#modalContent') as HTMLElement;
    if (modalContent) {
      modalContent.scrollTop = 0;
    }
  }

  scrollModalBottom(): void {
    const modalContent = document.querySelector('#modalContent') as HTMLElement;
    if (modalContent) {
      modalContent.scrollTop = modalContent.scrollHeight;
    }
  }

  predictOptimalPrice(): void {
    if (!this.formData.description) {
      this.formErrors.description = 'Veuillez rédiger la description pour pouvoir prédire le prix avec l\'IA.';
      return;
    }
    
    this.predictingPrice = true;
    
    // Find category name
    const categoryName = this.categories.find(c => c.idCategorie === this.formData.idCategorie)?.nomCategorie || '';
    
    // Predict Asynchronously
    this.predictorService.predictPrice(
      this.formData.description,
      this.formData.capacite,
      categoryName,
      this.editMeta.equipements || []
    ).subscribe({
      next: (suggestedPrice) => {
        this.formData.prixNuit = suggestedPrice;
        this.predictingPrice = false;
        this.formErrors.prixNuit = '';
      },
      error: (err) => {
        this.predictingPrice = false;
        this.formErrors.prixNuit = typeof err === 'string' ? err : (err.message || 'Le bouton Magique IA est temporairement indisponible. Saisissez le prix manuellement.');
      }
    });
  }

  enhanceDescription() {
    if (!this.formData.description) {
      this.formErrors.description = 'Veuillez rédiger une description avant de la corriger.';
      return;
    }

    this.enhancingDescription = true;
    this.formErrors.description = '';

    this.predictorService.enhanceDescription(this.formData.description).subscribe({
      next: (enhancedText) => {
        this.formData.description = enhancedText;
        this.enhancingDescription = false;
      },
      error: (err) => {
        this.enhancingDescription = false;
        this.formErrors.description = typeof err === 'string' ? err : (err.message || "Impossible de joindre l'IA pour le moment.");
      }
    });
  }

  enhanceReason() {
    if (!this.actionReason) {
      this.reasonError = 'Veuillez rédiger un motif avant de le corriger.';
      return;
    }

    this.enhancingReason = true;
    this.reasonError = '';

    this.predictorService.enhanceDescription(this.actionReason).subscribe({
      next: (enhancedText) => {
        this.actionReason = enhancedText;
        this.enhancingReason = false;
      },
      error: (err) => {
        this.enhancingReason = false;
        this.reasonError = typeof err === 'string' ? err : (err.message || "Impossible de joindre l'IA pour le moment.");
      }
    });
  }
}
