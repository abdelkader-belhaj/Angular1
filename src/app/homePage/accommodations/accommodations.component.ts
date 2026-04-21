import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LogementService, Logement, RecommendationResponse } from '../../services/accommodation/logement.service';
import { CategorieService, Categorie } from '../../services/accommodation/categorie.service';
import { AuthService } from '../../services/auth.service';
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

  categories: Categorie[] = [];
  allLogements: Logement[] = [];
  filteredLogements: Logement[] = [];
  recommendations: RecommendationResponse[] = [];
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
      this.logementService.getRecommendations(currentUser.id).subscribe({
        next: (recs) => {
          this.recommendations = recs;
          console.log('Recommandations chargées:', recs.length);
          this.applyLocalFilters();
        },
        error: (err) => console.error('Erreur chargement recommandations', err)
      });
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

    // Tri pour que l'IA place les meilleurs logements recommandés en Haut !
    this.filteredLogements.sort((a, b) => {
      const scoreA = this.getAiScore(a.idLogement) ?? -1;
      const scoreB = this.getAiScore(b.idLogement) ?? -1;
      
      return scoreB - scoreA; // Du plus grand score au plus petit
    });
  }

  filterLogements(): void {
    this.applyLocalFilters();
  }

  getAiScore(idLogement: number): number | undefined {
    // Cherche si ce logement fait partie des recommandations de l'IA
    const rec = this.recommendations.find(r => r.logement.idLogement === idLogement);
    return rec ? rec.aiScore : undefined;
  }
}
