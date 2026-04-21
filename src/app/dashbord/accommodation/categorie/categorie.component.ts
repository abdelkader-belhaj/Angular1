import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CategorieService, Categorie, Logement } from '../../../services/accommodation/categorie.service';
import { AuthService } from '../../../services/auth.service';
import { AiPricePredictionService } from '../../../services/accommodation/ai-price-prediction.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-categorie',
  templateUrl: './categorie.component.html',
  styleUrls: ['./categorie.component.css']
})
export class CategorieComponent implements OnInit {

  categories: Categorie[] = [];
  loading                 = true;
  error                   = false;
  showModal               = false;
  showDeleteModal         = false;
  selectedCategorie: Categorie | null = null;
  categorieToDelete: Categorie | null = null;
  hasAssociatedLogements  = false;
  deleteRequiresConfirmation = false;
  deleteConfirmedStep1     = false;
  deleteConfirmedStep2     = false;
  showFinalDeleteConfirm   = false;
  deleteErrorMessage      = '';
  deleteBlockerLogements: Logement[] = [];
  deleteBlockerCount      = 0;
  currentRole = '';

  formData = { nomCategorie: '', description: '', icone: '', statut: true };
  formErrors: any = {};
  enhancingDescription = false;
  isAdminUser = false;
  isHebergeurUser = false;
  selectedAssetIcon = '';
  imagePreviewUrl = '';

  imageOptions = ['maison.jpg', 'villa.jpg', 'appartement.jpg', 'riad.jpg', 'chalet.jpg']; // Ajoutez vos images ici

  typeCategories = [
    'Appartements',
    'Villas',
    'Maisons',
    'Studios',
    'Chalets',
    'Riads',
    'Duplexes',
    'Penthouses',
    'Bungalows',
    'Fermes'
  ];

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  constructor(
    private categorieService: CategorieService,
    private predictorService: AiPricePredictionService
  ) {}

  ngOnInit(): void {
    this.currentRole = this.authService.getCurrentUser()?.role || '';
    this.isAdminUser = this.currentRole === 'ADMIN';
    this.isHebergeurUser = this.currentRole === 'HEBERGEUR';
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.categorieService.getCategories().subscribe({
      next: (data) => { this.categories = data; this.loading = false; },
      error: () => { this.error = true; this.loading = false; }
    });
  }

  openAddModal(): void {
    this.selectedCategorie = null;
    this.formData = { nomCategorie: '', description: '', icone: '', statut: true };
    this.selectedAssetIcon = '';
    this.imagePreviewUrl = '';
    this.formErrors = {};
    this.showModal = true;
  }

  openEditModal(cat: Categorie): void {
    this.selectedCategorie = cat;
    this.formData = {
      nomCategorie: cat.nomCategorie,
      description:  cat.description,
      icone:        cat.icone,
      statut:       cat.statut
    };
    this.selectedAssetIcon = cat.icone;
    this.imagePreviewUrl = this.getImage(cat.icone);
    this.formErrors = {};
    this.showModal = true;
  }

  openDeleteModal(cat: Categorie): void {
    this.categorieToDelete = cat;
    this.showDeleteModal = true;
    this.hasAssociatedLogements = !!cat.nbLogements && cat.nbLogements > 0;
    this.deleteRequiresConfirmation = this.hasAssociatedLogements;
    this.deleteConfirmedStep1 = !this.deleteRequiresConfirmation;
    this.deleteConfirmedStep2 = !this.deleteRequiresConfirmation;
    this.showFinalDeleteConfirm = false;
    this.deleteErrorMessage = '';
    this.deleteBlockerLogements = [];
    this.deleteBlockerCount = cat.nbLogements || 0;
    this.loadDeletePreview(cat.idCategorie);
  }

  loadDeletePreview(id: number): void {
    this.categorieService.getLogementsByCategorie(id).subscribe({
      next: (logements) => {
        this.deleteBlockerLogements = logements || [];
        this.deleteBlockerCount = this.deleteBlockerLogements.length;
        this.hasAssociatedLogements = this.deleteBlockerCount > 0;
        if (this.hasAssociatedLogements) {
          this.deleteRequiresConfirmation = true;
          this.deleteConfirmedStep1 = false;
          this.deleteConfirmedStep2 = false;
          this.deleteErrorMessage = `Cette catégorie contient ${this.deleteBlockerCount} logement(s). En confirmant, vous supprimerez également tous ces logements.`;
        }
      },
      error: () => {
        // Si l'aperçu échoue, le modal reste affiché sans détails supplémentaires.
      }
    });
  }

  closeModal(): void { 
    this.showModal = false; 
    this.selectedCategorie = null;
    this.selectedAssetIcon = '';
    this.imagePreviewUrl = '';
  }

  selectImageFromAssets(imageName: string): void {
    this.formData.icone = imageName;
    if (imageName) {
      this.imagePreviewUrl = this.getImage(imageName);
    } else {
      this.imagePreviewUrl = '';
    }
  }
  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.categorieToDelete = null;
    this.hasAssociatedLogements = false;
    this.deleteRequiresConfirmation = false;
    this.deleteConfirmedStep1 = false;
    this.deleteConfirmedStep2 = false;
    this.showFinalDeleteConfirm = false;
    this.deleteErrorMessage = '';
    this.deleteBlockerLogements = [];
    this.deleteBlockerCount = 0;
    this.selectedAssetIcon = '';
    this.imagePreviewUrl = '';
  }

  saveCategorie(): void {
    if (!this.validate()) return;
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
    if (!token || (user.role !== 'ADMIN' && user.role !== 'HEBERGEUR')) {
      alert('Vous devez être connecté en tant qu\'admin ou hébergeur pour effectuer cette action.');
      return;
    }
    if (this.selectedCategorie) {
      this.categorieService.updateCategorie(this.selectedCategorie.idCategorie, this.formData).subscribe({
        next: () => { this.loadCategories(); this.closeModal(); },
        error: (err) => console.error('Erreur update:', err)
      });
    } else {
      this.categorieService.createCategorie(this.formData).subscribe({
        next: () => { this.loadCategories(); this.closeModal(); },
        error: (err) => console.error('Erreur create:', err)
      });
    }
  }

  confirmDelete(): void {
    if (!this.categorieToDelete) return;
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
    if (!token || (user.role !== 'ADMIN' && user.role !== 'HEBERGEUR')) {
      alert('Vous devez être connecté en tant qu\'admin ou hébergeur pour effectuer cette action.');
      return;
    }
    if (this.deleteRequiresConfirmation && (!this.deleteConfirmedStep1 || !this.deleteConfirmedStep2)) {
      this.deleteErrorMessage = 'Cochez les deux confirmations pour supprimer cette catégorie et tous les logements associés.';
      return;
    }
    if (!this.showFinalDeleteConfirm) {
      this.showFinalDeleteConfirm = true;
      return;
    }
    this.categorieService.deleteCategorie(this.categorieToDelete.idCategorie).subscribe({
      next: () => {
        this.loadCategories();
        this.closeDeleteModal();
      },
      error: (err) => {
        console.error('Erreur delete:', err);
        if (err.status === 400 || err.status === 409) {
          const payload = err.error || {};
          const logements = payload.logements || payload.associatedLogements || [];
          this.deleteBlockerLogements = Array.isArray(logements) ? logements : [];
          this.deleteBlockerCount = this.deleteBlockerLogements.length || this.categorieToDelete?.nbLogements || 0;
          this.deleteErrorMessage = payload.message
            || `Impossible de supprimer cette catégorie car elle contient ${this.deleteBlockerCount} logement(s).`;
          this.deleteRequiresConfirmation = true;
          this.deleteConfirmedStep1 = false;
          this.deleteConfirmedStep2 = false;
          this.showFinalDeleteConfirm = false;
        }
      }
    });
  }

  cancelFinalDelete(): void {
    this.showFinalDeleteConfirm = false;
    this.deleteErrorMessage = '';
  }

  scrollModalTop(element: HTMLElement): void {
    element.scrollTop = 0;
  }

  scrollModalBottom(element: HTMLElement): void {
    element.scrollTop = element.scrollHeight;
  }

  async logout(): Promise<void> {
     await firstValueFrom(this.authService.logout());
    await this.router.navigate(['/']);
  }

  validate(): boolean {
    this.formErrors = {};
    if (!this.formData.nomCategorie.trim())
      this.formErrors.nom = 'Nom obligatoire';
    if (!this.formData.description.trim() || this.formData.description.trim().length < 10)
      this.formErrors.description = 'Description minimum 10 caractères';
    if (!this.formData.icone.trim())
      this.formErrors.icone = 'Image obligatoire';
    return Object.keys(this.formErrors).length === 0;
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.formData.icone = file.name;
  }

  formatDate(date: string): string { return new Date(date).toLocaleDateString('fr-FR'); }

  getImage(icone: string): string {
    if (!icone) return '/assets/images/default.jpg';
    if (icone.startsWith('http')) return icone;
    if (icone.startsWith('data:')) return icone;
    if (!this.imageOptions.includes(icone)) return '/assets/images/default.jpg';
    return `/assets/images/${icone}`;
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
}