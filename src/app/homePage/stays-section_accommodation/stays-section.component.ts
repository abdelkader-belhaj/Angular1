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
    if (!icone || icone === '')
      return 'assets/images/default.jpg';
    if (icone.startsWith('http'))
      return icone;
    return `assets/images/${icone}`;
  }

  canOpenCategory(categorie: Categorie): boolean {
    return !!categorie.statut;
  }
}