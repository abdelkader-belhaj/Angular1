import { Component, OnInit } from '@angular/core';
import {
  CategorieService,
  Categorie
} from '../../services/accommodation/categorie.service';

@Component({
  selector: 'app-stays-section',
  templateUrl: './stays-section.component.html',
  styleUrls: ['./stays-section.component.css']
})
export class StaysSectionComponent implements OnInit {

  categories: Categorie[] = [];
  loading = true;
  error   = false;
  private readonly imageAliases: Record<string, string> = {
    'farm.avif': 'beautiful-farmhouse-countryside-sunset.jpg',
    'cui.avif': '3d-rendering-white-minimal-kitchen-with-wood-decoration.jpg',
    'maison.avif': 'maison.jpg',
    'villa.avif': 'villa.jpg',
    'appartement.avif': 'appartement.jpg',
    'riad.avif': 'riad.jpg',
    'chalet.avif': 'chalet.jpg'
  };

  constructor(
    private categorieService: CategorieService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.error   = false;

    this.categorieService.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.loading    = false;
      },
      error: (err) => {
        console.error('Erreur chargement catégories:', err);
        this.error   = true;
        this.loading = false;
      }
    });
  }

  getImage(icone: string): string {
    const imageName = this.normalizeImageName(icone);
    if (!imageName)
      return 'assets/images/default.jpg';
    if (imageName.startsWith('http'))
      return imageName;
    return `assets/images/${imageName}`;
  }

  private normalizeImageName(raw: string): string {
    if (!raw) return '';
    const clean = String(raw).trim();
    if (!clean) return '';
    if (clean.startsWith('http') || clean.startsWith('data:')) return clean;
    const normalized = clean.replace(/\\/g, '/').split('?')[0].split('#')[0];
    const baseName = normalized.split('/').pop() || '';
    return this.imageAliases[baseName.toLowerCase()] || baseName;
  }

  canOpenCategory(categorie: Categorie): boolean {
    return !!categorie.statut;
  }
}