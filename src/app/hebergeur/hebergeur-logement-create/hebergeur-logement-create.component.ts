import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CategorieService, Categorie } from '../../services/accommodation/categorie.service';
import { LogementService, LogementRequest } from '../../services/accommodation/logement.service';
import { AuthService } from '../../services/auth.service';
import { HostHubMeta, mergeDescriptionWithMeta } from '../hosthub-meta';
import { AiPricePredictionService } from '../../services/accommodation/ai-price-prediction.service';

@Component({
  selector: 'app-hebergeur-logement-create',
  templateUrl: './hebergeur-logement-create.component.html',
  styleUrl: './hebergeur-logement-create.component.css'
})
export class HebergeurLogementCreateComponent implements OnInit {
  private readonly categorieService = inject(CategorieService);
  private readonly logementService = inject(LogementService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly predictorService = inject(AiPricePredictionService);
  private readonly http = inject(HttpClient);
  private reverseGeocodeTimer: ReturnType<typeof setTimeout> | undefined;
  private equipmentPriceTimer: ReturnType<typeof setTimeout> | undefined;
  private locationRequestId = 0;
  private predictedBasePrice: number | null = null;

  categories: Categorie[] = [];
  loading = true;
  saving = false;
  predictingPrice = false;
  enhancingDescription = false;
  resolvingLocation = false;
  requestError = '';
  formErrors: Record<string, string> = {};

  equipementOptions = [
    'Wi‑Fi',
    'Climatisation',
    'Cuisine équipée',
    'Parking',
    'Piscine',
    'Machine à laver',
    'Balcon / Terrasse',
    'Vue de mer',
    'Jacuzzi',
    'Chauffage moderne',
    'Ascenseur',
    'Sécurité 24h/24',
    'Borne électrique',
    'Vue montagne',
    'Proche plage',
    'Proche centre-ville',
    'Smart TV',
    'Espace de travail',
    'Salle de sport',
    'Sauna'
  ];
  selectedEquipements: string[] = [];

  nbChambres = 1;
  surfaceM2 = 0;
  maintenance = false;

  formData: LogementRequest = {
    idCategorie: 0,
    nom: '',
    description: '',
    imageUrls: [],
    videoUrl: '',
    adresse: '',
    ville: '',
    prixNuit: 0,
    capacite: 2,
    disponible: true,
    latitude: undefined,
    longitude: undefined
  };

  ngOnInit(): void {
    this.categorieService.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.formData.idCategorie = data[0]?.idCategorie || 0;
        this.loading = false;
      },
      error: () => {
        this.categories = [];
        this.loading = false;
      }
    });
  }

  toggleEquipement(name: string): void {
    const i = this.selectedEquipements.indexOf(name);
    if (i === -1) this.selectedEquipements = [...this.selectedEquipements, name];
    else this.selectedEquipements = this.selectedEquipements.filter((x) => x !== name);
    this.scheduleEquipmentPriceRefresh();
  }

  isSelectedEq(name: string): boolean {
    return this.selectedEquipements.includes(name);
  }

  private scheduleEquipmentPriceRefresh(): void {
    if (!this.formData.description.trim() || this.predictingPrice) {
      return;
    }

    if (this.equipmentPriceTimer) {
      clearTimeout(this.equipmentPriceTimer);
    }

    this.equipmentPriceTimer = setTimeout(() => {
      if (this.predictedBasePrice !== null) {
        this.applyPriceFromBase();
        return;
      }
      this.predictOptimalPrice();
    }, 300);
  }

  private applyPriceFromBase(): void {
    if (this.predictedBasePrice === null) {
      return;
    }
    const bonus = this.predictorService.getEquipmentBonus(this.selectedEquipements);
    this.formData.prixNuit = Math.round((this.predictedBasePrice + bonus) / 5) * 5;
    this.formErrors['prixNuit'] = '';
  }

  save(): void {
    if (!this.validate()) return;
    const role = this.authService.getCurrentUser()?.role;
    if (!(role === 'HEBERGEUR' || role === 'ADMIN')) {
      this.requestError = 'Connexion hébergeur requise.';
      return;
    }

    const meta: HostHubMeta = {
      nbChambres: this.nbChambres,
      surfaceM2: this.surfaceM2 || undefined,
      equipements: this.selectedEquipements,
      maintenance: this.maintenance
    };
    const fullDescription = mergeDescriptionWithMeta(this.formData.description, meta);
    const payload = {
      ...this.formData,
      description: fullDescription,
      disponible: this.maintenance ? false : this.formData.disponible,
      imageUrl: this.formData.imageUrls.length > 0 ? this.formData.imageUrls[0] : ''
    };

    this.saving = true;
    this.requestError = '';
    this.logementService.createLogement(payload).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/hebergeur/logements']);
      },
      error: (err) => {
        this.saving = false;
        this.requestError = err?.error?.message || 'Impossible de créer le logement.';
      }
    });
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.formData.imageUrls.push(file.name);
  }

  removeImage(i: number): void {
    this.formData.imageUrls.splice(i, 1);
  }

  onVideoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.formData.videoUrl = file.name;
  }

  removeVideo(): void {
    this.formData.videoUrl = '';
  }

  getImage(name: string): string {
    if (!name) return '/assets/images/default.jpg';
    if (name.startsWith('http') || name.startsWith('data:')) return name;
    return `/assets/images/${name}`;
  }

  onCoordinatesChange(): void {
    if (this.reverseGeocodeTimer) {
      clearTimeout(this.reverseGeocodeTimer);
    }

    const latitude = this.formData.latitude;
    const longitude = this.formData.longitude;
    if (latitude === undefined || longitude === undefined) {
      this.resolvingLocation = false;
      return;
    }

    this.resolvingLocation = true;

    this.reverseGeocodeTimer = setTimeout(() => {
      this.reverseGeocodeCoordinates(latitude, longitude);
    }, 450);
  }

  private reverseGeocodeCoordinates(latitude: number, longitude: number): void {
    const requestId = ++this.locationRequestId;
    const endpoint = 'https://nominatim.openstreetmap.org/reverse';
    const url = `${endpoint}?format=jsonv2&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}&addressdetails=1&zoom=18&accept-language=fr`;

    this.http.get<any>(url).subscribe({
      next: (response) => {
        if (requestId !== this.locationRequestId) {
          return;
        }
        const address = response?.address || {};
        const country = address.country || '';
        const governorate = address.state || address.region || address.county || '';
        const city = address.city || address.town || address.village || address.municipality || '';
        const suburb = address.suburb || address.neighbourhood || address.city_district || '';
        const road = address.road || address.pedestrian || '';
        const houseNumber = address.house_number || '';
        const postcode = address.postcode || '';
        const displayName = response?.display_name || '';
        const cityLabel = [country, governorate, city].filter(Boolean).join(', ');
        const detailedAddress = [
          [houseNumber, road].filter(Boolean).join(' ').trim(),
          suburb,
          city,
          governorate,
          postcode,
          country
        ].filter(Boolean).join(', ');

        this.formData.ville = cityLabel || city || this.formData.ville;
        this.formData.adresse = detailedAddress || displayName || this.formData.adresse;
        this.formErrors['ville'] = '';
        this.formErrors['adresse'] = '';
        this.formErrors['gps'] = '';
        this.resolvingLocation = false;
      },
      error: () => {
        if (requestId !== this.locationRequestId) {
          return;
        }
        this.formErrors['gps'] = 'Impossible de déterminer automatiquement la ville et l\'adresse depuis ces coordonnées.';
        this.resolvingLocation = false;
      }
    });
  }

  private validate(): boolean {
    this.formErrors = {};
    if (this.formData.idCategorie <= 0) this.formErrors['idCategorie'] = 'Choisissez une catégorie.';
    if (!this.formData.nom.trim()) this.formErrors['nom'] = 'Nom obligatoire.';
    if (!this.formData.description.trim() || this.formData.description.trim().length < 10) {
      this.formErrors['description'] = 'Description (min. 10 caractères).';
    }
    if (!this.formData.ville.trim()) this.formErrors['ville'] = 'Ville obligatoire.';
    if (!this.formData.adresse.trim()) this.formErrors['adresse'] = 'Adresse obligatoire.';
    if (this.formData.prixNuit <= 0) this.formErrors['prixNuit'] = 'Prix invalide.';
    if (this.formData.capacite < 1) this.formErrors['capacite'] = 'Capacité min. 1.';
    if (this.nbChambres < 0) this.formErrors['nbChambres'] = 'Nombre de chambres invalide.';
    if (this.surfaceM2 < 0) this.formErrors['surfaceM2'] = 'Surface invalide.';
    const latitude = this.formData.latitude;
    const longitude = this.formData.longitude;
    if (latitude === undefined || longitude === undefined) {
      this.formErrors['gps'] = 'Indispensable : Cliquez sur "Utiliser ma position GPS" pour configurer la serrure connectée.';
    } else if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      this.formErrors['gps'] = 'Coordonnées GPS invalides.';
    }
    return Object.keys(this.formErrors).length === 0;
  }

  predictOptimalPrice(): void {
    if (!this.formData.description) {
      this.formErrors['description'] = 'Veuillez rédiger la description pour pouvoir prédire le prix avec l\'IA.';
      return;
    }
    
    this.predictingPrice = true;
    
    // Find category name
    const categoryName = this.categories.find(c => c.idCategorie === this.formData.idCategorie)?.nomCategorie || '';
    
    // Predict Asynchronously
    this.predictorService.predictBasePrice(
      this.formData.description,
      this.formData.capacite,
      categoryName
    ).subscribe({
      next: (basePrice) => {
        this.predictedBasePrice = basePrice;
        this.applyPriceFromBase();
        this.predictingPrice = false;
        this.formErrors['prixNuit'] = ''; // Clear existing errors
      },
      error: (err) => {
        this.predictingPrice = false;
        this.formErrors['prixNuit'] = typeof err === 'string' ? err : (err.message || 'Le bouton Magique IA est temporairement indisponible. Saisissez le prix manuellement.');
      }
    });
  }

  enhanceDescription() {
    if (!this.formData.description) {
      this.formErrors['description'] = 'Veuillez rédiger une description avant de la corriger.';
      return;
    }

    this.enhancingDescription = true;
    this.formErrors['description'] = '';

    this.predictorService.enhanceDescription(this.formData.description).subscribe({
      next: (enhancedText) => {
        this.formData.description = enhancedText;
        this.enhancingDescription = false;
      },
      error: (err) => {
        this.enhancingDescription = false;
        this.formErrors['description'] = 'Erreur IA: ' + err.message;
      }
    });
  }

  getLocation(): void {
    if (!navigator.geolocation) {
      alert('La géolocalisation n\'est pas supportée par votre navigateur.');
      return;
    }
    
    // Pour la soutenance, si vous voulez tricher sans bouger,
    // commentez ceci et écrivez this.formData.latitude = 36.4 ; this.formData.longitude = 10.1;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.formData.latitude = position.coords.latitude;
        this.formData.longitude = position.coords.longitude;
        this.onCoordinatesChange();
      },
      (error) => {
        alert('Impossible de récupérer la position. Veuillez autoriser l\'accès GPS ou entrer manuellement.');
      }
    );
  }
}
