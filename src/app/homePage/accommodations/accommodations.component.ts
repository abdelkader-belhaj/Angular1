import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LogementService, Logement, RecommendationResponse } from '../../services/accommodation/logement.service';
import { CategorieService, Categorie } from '../../services/accommodation/categorie.service';
import { AuthService } from '../../services/auth.service';
import { UserPrefs } from './preferences-form/preferences-form.component';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

@Component({
  selector: 'app-accommodations',
  templateUrl: './accommodations.component.html',
  styleUrl: './accommodations.component.css',
  animations: [
    trigger('listAnimation', [
      transition('* <=> *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(15px)' }),
          stagger('80ms', [
            animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class AccommodationsComponent implements OnInit {
  searchTerm: string = '';
  selectedCategory: string = 'all';
  priceRange: string = 'all';
  showFilters: boolean = false;
  showPreferencesForm = false;

  categories: Categorie[] = [];
  allLogements: Logement[] = [];
  filteredLogements: Logement[] = [];
  recommendations: RecommendationResponse[] = [];
  activePrefs: UserPrefs | null = null;
  availableVilles: string[] = [];
  maintenanceCategory: Categorie | null = null;
  
  loading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private logementService: LogementService,
    private categorieService: CategorieService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loading = true;

    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.role === 'CLIENT_TOURISTE') {
      this.loadRecommendations();
    }

    // Load categories first
    this.categorieService.getCategories().subscribe({
      next: (cats: Categorie[]) => {
        this.categories = cats;

        // Read category from query params
        this.route.queryParams.subscribe(params => {
          const categoryParam = params['category'];
          if (categoryParam) {
            this.selectedCategory = categoryParam.toString();
            this.loadLogementsByCategorie(parseInt(categoryParam, 10));
          } else {
            this.loadAllLogements();
          }
        });
      },
      error: (err) => {
        console.error('Erreur lors du chargement des catégories', err);
        this.loading = false;
      }
    });
  }

  loadAllLogements(): void {
    this.loading = true;
    this.maintenanceCategory = null;
    this.logementService.getLogementsPublic().subscribe({
      next: (logs: Logement[]) => {
        this.allLogements = logs;
        this.filteredLogements = [...this.allLogements];
        this.extractVilles();
        this.applyLocalFilters();
        this.loading = false;
        console.log('Tous les logements chargés:', this.filteredLogements.length);
      },
      error: (err) => {
        console.error('Erreur lors du chargement des logements', err);
        this.loading = false;
      }
    });
  }

  extractVilles(): void {
    const villes = this.allLogements
      .map(l => l.ville)
      .filter((v): v is string => !!v && v.trim() !== '');
    this.availableVilles = [...new Set(villes)].sort();
  }

  loadLogementsByCategorie(idCategorie: number): void {
    const category = this.categories.find(c => c.idCategorie === idCategorie);
    if (category && !category.statut) {
      this.loading = false;
      this.allLogements = [];
      this.filteredLogements = [];
      this.maintenanceCategory = category;
      return;
    }

    this.loading = true;
    this.maintenanceCategory = null;
    this.logementService.getLogementsByCategorie(idCategorie).subscribe({
      next: (logs: Logement[]) => {
        this.allLogements = logs;
        this.filteredLogements = [...this.allLogements];
        this.applyLocalFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error(`Erreur lors du chargement des logements pour la catégorie ${idCategorie}`, err);
        this.loading = false;
      }
    });
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  get isClient(): boolean {
    return this.authService.getCurrentUser()?.role === 'CLIENT_TOURISTE';
  }

  loadRecommendations(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;
    this.logementService.getRecommendations(currentUser.id).subscribe({
      next: (recs) => {
        this.recommendations = recs;
        this.applyLocalFilters(); // retrie la grille principale selon scores IA
      },
      error: (err) => console.error('Erreur chargement recommandations', err)
    });
  }

  onPreferencesSaved(prefs: UserPrefs): void {
    this.activePrefs = prefs;
    this.showPreferencesForm = false;
    // Si pas encore de recs IA, les charger d'abord
    if (this.recommendations.length === 0) {
      this.loadRecommendations();
    } else {
      this.applyLocalFilters(); // retrie selon préférences + score IA
    }
  }

  selectCategory(categoryId: string): void {
    this.selectedCategory = categoryId;
    if (categoryId === 'all') {
      this.loadAllLogements();
    } else {
      const parsedId = parseInt(categoryId, 10);
      const selected = this.categories.find(c => c.idCategorie === parsedId);
      if (selected && !selected.statut) {
        this.loading = false;
        this.allLogements = [];
        this.filteredLogements = [];
        this.maintenanceCategory = selected;
        return;
      }
      this.loadLogementsByCategorie(parsedId);
    }
  }

  onSearchChange(): void {
    this.applyLocalFilters();
  }

  onPriceChange(): void {
    this.applyLocalFilters();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.priceRange = 'all';
    this.loadAllLogements();
  }

  applyLocalFilters(): void {
    this.filteredLogements = this.allLogements.filter(logement => {
      const nom = logement.nom ? logement.nom.toLowerCase() : '';
      const ville = logement.ville ? logement.ville.toLowerCase() : '';
      const desc = logement.description ? logement.description.toLowerCase() : '';
      const search = this.searchTerm.toLowerCase();

      const matchSearch = !search || nom.includes(search) || ville.includes(search) || desc.includes(search);

      let matchPrice = true;
      const prix = logement.prixNuit || 0;
      if (this.priceRange === 'low') matchPrice = prix < 100;
      else if (this.priceRange === 'medium') matchPrice = prix >= 100 && prix < 300;
      else if (this.priceRange === 'high') matchPrice = prix >= 300;

      return matchSearch && matchPrice;
    });

    // Tri : score combiné IA + bonus préférences
    this.filteredLogements.sort((a, b) => {
      const scoreA = this.getCombinedScore(a);
      const scoreB = this.getCombinedScore(b);
      return scoreB - scoreA;
    });
  }

  // Score IA brut (depuis Python)
  getAiScore(idLogement: number): number | undefined {
    const rec = this.recommendations.find(r => r.logement.idLogement === idLogement);
    return rec ? rec.aiScore : undefined;
  }

  // Score combiné = aiScore + bonus préférences formulaire
  getCombinedScore(l: Logement): number {
    const aiScore = this.getAiScore(l.idLogement) ?? -1;
    if (!this.activePrefs) return aiScore;
    const p = this.activePrefs;
    let bonus = 0;
    if (p.budgetMax && p.budgetMax < 9999 && l.prixNuit != null) {
      bonus += l.prixNuit <= p.budgetMax ? 2 : -1;
    }
    if (p.villePreferee && l.ville) {
      bonus += l.ville.toLowerCase().includes(p.villePreferee.toLowerCase()) ? 2 : 0;
    }
    if (p.capaciteMin && l.capacite >= p.capaciteMin) bonus += 1;
    if (p.equipementsImportants.length > 0 && l.description) {
      const desc = l.description.toLowerCase();
      bonus += p.equipementsImportants.filter(e => desc.includes(e.toLowerCase())).length * 0.5;
    }
    return aiScore + bonus;
  }
}
