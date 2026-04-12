import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ArtisanService, ArtisanProduct, ArtisanSale } from '../../../services/artisan.service';

@Component({
  selector: 'app-artisan-detail',
  templateUrl: './artisan-detail.component.html',
  styleUrls: ['./artisan-detail.component.css']
})
export class ArtisanDetailComponent implements OnInit {
  artisanId: string | null = null;
  artisanData: any = null;
  products: ArtisanProduct[] = [];
  sales: ArtisanSale[] = [];
  stats: any = null;
  isLoading = true;

  activeTab = 'products';

  constructor(
    private artisanService: ArtisanService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.activatedRoute.paramMap.subscribe(params => {
      this.artisanId = params.get('id');
      if (this.artisanId) {
        this.loadArtisanDetails();
      }
    });
  }

  loadArtisanDetails(): void {
    if (!this.artisanId) return;
    const artisanIdNum = Number(this.artisanId);
    
    this.artisanService.getArtisanDetails(artisanIdNum).subscribe(
      (data) => {
        this.artisanData = data.artisan;
        this.products = data.products;
        this.sales = data.sales;
        this.stats = data.stats;
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading artisan details:', error);
        this.isLoading = false;
      }
    );
  }

  suspendArtisan(): void {
    if (!this.artisanId) return;
    if (confirm('Êtes-vous sûr de vouloir suspendre cet artisan?')) {
      const artisanIdNum = Number(this.artisanId);
      this.artisanService.suspendArtisan(artisanIdNum).subscribe(
        () => {
          alert('Artisan suspendu avec succès!');
          this.loadArtisanDetails();
        },
        (error) => {
          console.error('Error suspending artisan:', error);
          alert('Erreur lors de la suspension');
        }
      );
    }
  }

  activateArtisan(): void {
    if (!this.artisanId) return;
    if (confirm('Êtes-vous sûr de vouloir activer cet artisan?')) {
      const artisanIdNum = Number(this.artisanId);
      this.artisanService.activateArtisan(artisanIdNum).subscribe(
        () => {
          alert('Artisan activé avec succès!');
          this.loadArtisanDetails();
        },
        (error) => {
          console.error('Error activating artisan:', error);
          alert('Erreur lors de l\'activation');
        }
      );
    }
  }

  goBack(): void {
    this.router.navigate(['/dashbord/artisans']);
  }
}
