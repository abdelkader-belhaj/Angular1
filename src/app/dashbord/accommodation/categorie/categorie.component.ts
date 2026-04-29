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
  loading = true;
  error = false;

  showModal = false;
  showDeleteModal = false;

  selectedCategorie: Categorie | null = null;
  categorieToDelete: Categorie | null = null;

  hasAssociatedLogements = false;
  deleteRequiresConfirmation = false;
  deleteConfirmedStep1 = false;
  deleteConfirmedStep2 = false;
  showFinalDeleteConfirm = false;

  deleteErrorMessage = '';
  deleteBlockerLogements: Logement[] = [];
  deleteBlockerCount = 0;

  currentRole = '';

  formData = {
    nomCategorie: '',
    description: '',
    icone: '',
    statut: true
  };

  formErrors: any = {};
  enhancingDescription = false;
  requestError = '';
  requestSuccess = '';

  isAdminUser = false;
  isHebergeurUser = false;

  selectedAssetIcon = '';
  imagePreviewUrl = '';

  imageOptions = [
    'maison.jpg',
    'villa.jpg',
    'appartement.jpg',
    'riad.jpg',
    'chalet.jpg'
  ];

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

  // ================= LOAD =================
  loadCategories(): void {
    this.loading = true;
    this.categorieService.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  // ================= MODALS =================
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
      description: cat.description,
      icone: cat.icone,
      statut: cat.statut
    };

    this.selectedAssetIcon = cat.icone;
    this.imagePreviewUrl = this.getImage(cat.icone);
    this.formErrors = {};
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedCategorie = null;
    this.imagePreviewUrl = '';
  }

  // ================= DELETE =================
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
      next: (logements: Logement[]) => {
        this.deleteBlockerLogements = logements || [];
        this.deleteBlockerCount = this.deleteBlockerLogements.length;

        this.hasAssociatedLogements = this.deleteBlockerCount > 0;

        if (this.hasAssociatedLogements) {
          this.deleteRequiresConfirmation = true;
          this.deleteConfirmedStep1 = false;
          this.deleteConfirmedStep2 = false;

          this.deleteErrorMessage =
            `Cette catégorie contient ${this.deleteBlockerCount} logement(s).`;
        }
      },
      error: () => {
        console.warn('Erreur chargement logements');
      }
    });
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.categorieToDelete = null;
    this.deleteErrorMessage = '';
  }

  confirmDelete(): void {
    if (!this.categorieToDelete) return;

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
        console.error(err);
      }
    });
  }

  cancelFinalDelete(): void {
    this.showFinalDeleteConfirm = false;
  }

  // ================= SAVE =================
  saveCategorie(): void {
    if (!this.validate()) return;

    const user = JSON.parse(localStorage.getItem('auth_user') || '{}');

    if (user.role !== 'ADMIN' && user.role !== 'HEBERGEUR') {
      alert('Non autorisé');
      return;
    }

    if (this.selectedCategorie) {
      this.categorieService.updateCategorie(this.selectedCategorie.idCategorie, this.formData)
        .subscribe(() => this.loadCategories());
    } else {
      this.categorieService.createCategorie(this.formData)
        .subscribe(() => this.loadCategories());
    }

    this.closeModal();
  }

  // ================= UTIL =================
  selectImageFromAssets(imageName: string): void {
    this.formData.icone = imageName;
    this.imagePreviewUrl = this.getImage(imageName);
  }

  getImage(icone: string): string {
    if (!icone) return '/assets/images/default.jpg';
    if (icone.startsWith('http')) return icone;
    if (icone.startsWith('data:')) return icone;
    return `/assets/images/${icone}`;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  // ================= VALIDATION =================
  validate(): boolean {
    this.formErrors = {};

    if (!this.formData.nomCategorie.trim()) {
      this.formErrors.nom = 'Nom obligatoire';
    }

    if (!this.formData.description || this.formData.description.length < 10) {
      this.formErrors.description = 'Description min 10 caractères';
    }

    if (!this.formData.icone) {
      this.formErrors.icone = 'Image obligatoire';
    }

    return Object.keys(this.formErrors).length === 0;
  }

  // ================= DESCRIPTION IA =================
  enhanceDescription(): void {
    if (!this.formData.description) return;

    this.enhancingDescription = true;

    this.predictorService.enhanceDescription(this.formData.description)
      .subscribe({
        next: (res: string) => {
          this.formData.description = res;
          this.enhancingDescription = false;
        },
        error: () => {
          this.enhancingDescription = false;
        }
      });
  }

  // ================= FILE =================
  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.formData.icone = file.name;
  }

  // ================= AUTH =================
  async logout(): Promise<void> {
    await firstValueFrom(this.authService.logout());
    await this.router.navigate(['/']);
  }
}