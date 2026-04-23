import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VolService } from '../services/vol.service';
import { Vol } from '../models/vol.model';

@Component({
  selector: 'app-vols-section',
  templateUrl: './vols-section.component.html',
  styleUrls: ['./vols-section.component.css']
})
export class VolsSectionComponent implements OnInit {
  vols: Vol[] = [];
  loading = true;
  depart = '';
  arrivee = '';
  date = '';
  showRecommendations = false;

  constructor(
    private volService: VolService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.volService.getAll().subscribe({
      next: v => { this.vols = v; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  rechercherVols(): void {
    this.router.navigate(['/vols'], {
      queryParams: {
        depart: this.depart || undefined,
        arrivee: this.arrivee || undefined,
        date: this.date || undefined
      }
    });
  }

  voirTous(): void {
    this.router.navigate(['/vols']);
  }

  getRecommendations(): void {
    this.loading = true;
    this.showRecommendations = true;
    
    this.volService.getRecommendations().subscribe({
      next: (recommendedVols) => {
        if (recommendedVols.length === 0) {
          this.volService.getAll().subscribe({
            next: v => { this.vols = v; this.loading = false; },
            error: () => { this.loading = false; }
          });
        } else {
          this.vols = recommendedVols;
          this.loading = false;
        }
      },
      error: () => {
        this.volService.getAll().subscribe({
          next: v => { this.vols = v; this.loading = false; },
          error: () => { this.loading = false; }
        });
      }
    });
  }

  resetToNormal(): void {
    this.showRecommendations = false;
    this.loading = true;
    this.volService.getAll().subscribe({
      next: v => { this.vols = v; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
}