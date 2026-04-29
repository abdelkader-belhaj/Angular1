import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CategorieService, Categorie } from '../../services/accommodation/categorie.service';
import { LogementService, LogementRequest } from '../../services/accommodation/logement.service';
import { AuthService } from '../../services/auth.service';
import { HostHubMeta, mergeDescriptionWithMeta } from '../hosthub-meta';
import { AiPricePredictionService } from '../../services/accommodation/ai-price-prediction.service';
import { ReverseGeocodeService } from '../../services/accommodation/reverse-geocode.service';

@Component({
  selector: 'app-hebergeur-logement-create',
  templateUrl: './hebergeur-logement-create.component.html',
  styleUrl: './hebergeur-logement-create.component.css'
})
export class HebergeurLogementCreateComponent implements OnInit {
  // ────────────────────────────────────────────────────────────
  // 🏠 COMPOSANT DE CRÉATION DE LOGEMENT (HÉBERGEUR)
  // ────────────────────────────────────────────────────────────
  // Permet à un HEBERGEUR authentifié de créer un nouveau logement.
  //
  // 🔌 Services utilisés:
  //   - CategorieService: Récupère les catégories disponibles
  //   - LogementService: Crée/modifie le logement (protégé par JWT)
  //   - AuthService: Vérifie l'authentification
  //   - AiPricePredictionService: Prédiction de prix & correction texte
  //
  // 📍 Fonctionnalités:
  //   ✅ Sélection de catégorie (depuis API /api/categories)
  //   ✅ Géolocalisation GPS (browser API)
  //   ✅ Reverse geocoding (Nominatim OpenStreetMap)
  //   ✅ Correction grammaticale (LanguageTool)
  //   ✅ Prédiction de prix (IA)
  //   ✅ Validation avant envoi
  //   ✅ Gestion d'erreurs avec logs détaillés
  //
  // 🔒 Sécurité:
  //   - Le token JWT est automatiquement ajouté par AuthInterceptor
  //   - POST /api/logements nécessite JWT valide
  //   - Les données sont validées côté frontend ET backend
  // ────────────────────────────────────────────────────────────

  private readonly categorieService = inject(CategorieService);
  private readonly logementService = inject(LogementService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly predictorService = inject(AiPricePredictionService);
  private readonly http = inject(HttpClient);
  private readonly reverseGeocodeService = inject(ReverseGeocodeService);
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
  requestSuccess = '';
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
    // Forcer un rechargement FRAIS - pas de cache
    this.categorieService.clearCache();
    
    this.categorieService.getCategories().subscribe({
      next: (data) => {
        console.log('✅ [Hebergeur] Catégories reçues du service:', data);
        this.categories = data;
        if (data.length === 0) {
          console.warn('⚠️ [Hebergeur] Aucune catégorie reçue !');
        } else {
          this.formData.idCategorie = data[0]?.idCategorie || 0;
          console.log('✅ [Hebergeur] Première catégorie sélectionnée:', this.formData.idCategorie);
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ [Hebergeur] Erreur chargement catégories:', err);
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
    
    console.log('[Hebergeur] onCoordinatesChange - lat:', latitude, 'lon:', longitude);
    
    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
      console.log('[Hebergeur] Coordonnées vides, pas de geocoding');
      this.resolvingLocation = false;
      this.formErrors['gps'] = '';
      return;
    }

    // Valider les coordonnées
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      console.warn('[Hebergeur] Coordonnées invalides - lat:', latitude, 'lon:', longitude);
      this.formErrors['gps'] = 'Coordonnées GPS invalides (lat: -90 à 90, lon: -180 à 180).';
      this.resolvingLocation = false;
      return;
    }

    console.log('[Hebergeur] Coordonnées valides, lancement du geocoding reverse...');
    this.resolvingLocation = true;
    this.formErrors['gps'] = '';

    this.reverseGeocodeTimer = setTimeout(() => {
      this.reverseGeocodeCoordinates(latitude, longitude);
    }, 450);
  }

  private reverseGeocodeCoordinates(latitude: number, longitude: number): void {
    const requestId = ++this.locationRequestId;
    
    console.log('[Geocoding] 🌍 Appel VRAI reverse geocoding via API backend...');
    console.log('[Geocoding] Coordonnées: lat=', latitude, 'lon=', longitude);
    
    // ✅ NOUVEAU: Appelle l'API du backend (Nominatim) au lieu de generateLocalAddress()
    this.reverseGeocodeService.reverseGeocode(latitude, longitude).subscribe({
      next: (response) => {
        if (requestId !== this.locationRequestId) {
          console.log('[Geocoding] Request ID mismatch, ignorant la réponse');
          return;
        }

        console.log('[Geocoding] ✅ Réponse reçue:', response);
        
        // Transformer la réponse pour correspondre au format attendu par updateAddressFields()
        // Format: "Ville, Adresse" (ville d'abord, puis adresse)
        const addressData = {
          address: {
            city: response.city || '',
            road: response.address || ''
          },
          display_name: `${response.city}, ${response.address}`.trim()
        };

        this.updateAddressFields(addressData);
      },
      error: (error) => {
        console.error('[Geocoding] ❌ Erreur reverse geocoding:', error);
        this.resolvingLocation = false;
        this.formErrors['gps'] = 'Erreur lors de la détection d\'adresse. Veuillez vérifier vos coordonnées.';
      }
    });
  }

  private generateLocalAddress(lat: number, lon: number): any {
    // Génération d'adresse basée sur les coordonnées GPS (Tunisie)
    let city = '';
    let governorate = '';
    const country = 'Tunisie';
    
    // Détermination de la ville basée sur les coordonnées
    if (lat >= 36.7 && lat <= 36.9 && lon >= 10.0 && lon <= 10.4) {
      city = 'Tunis'; governorate = 'Tunis';
    } else if (lat >= 34.6 && lat <= 34.8 && lon >= 10.6 && lon <= 10.9) {
      city = 'Sfax'; governorate = 'Sfax';
    } else if (lat >= 35.7 && lat <= 35.9 && lon >= 10.5 && lon <= 10.8) {
      city = 'Sousse'; governorate = 'Sousse';
    } else if (lat >= 36.4 && lat <= 36.6 && lon >= 10.6 && lon <= 10.9) {
      city = 'Nabeul'; governorate = 'Nabeul';
    } else if (lat >= 35.5 && lat <= 35.7 && lon >= 10.8 && lon <= 11.1) {
      city = 'Monastir'; governorate = 'Monastir';
    } else if (lat >= 33.8 && lat <= 34.0 && lon >= 10.0 && lon <= 10.3) {
      city = 'Gabès'; governorate = 'Gabès';
    } else if (lat >= 36.7 && lat <= 36.9 && lon >= 10.0 && lon <= 10.2) {
      city = 'Ariana'; governorate = 'Ariana';
    } else if (lat >= 36.8 && lat <= 37.0 && lon >= 9.9 && lon <= 10.1) {
      city = 'Manouba'; governorate = 'Manouba';
    } else if (lat >= 36.4 && lat <= 36.6 && lon >= 10.3 && lon <= 10.5) {
      city = 'Ben Arous'; governorate = 'Ben Arous';
    } else {
      city = 'Tunis'; governorate = 'Tunis'; // Valeur par défaut
    }
    
    // Génération d'une adresse plausible
    const streetNumbers = ['1', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50'];
    const streetNames = ['Avenue Habib Bourguiba', 'Rue de la République', 'Avenue Farhat Hached', 'Rue Charles de Gaulle', 'Avenue Mohamed V'];
    
    const randomStreetNumber = streetNumbers[Math.floor(Math.random() * streetNumbers.length)];
    const randomStreetName = streetNames[Math.floor(Math.random() * streetNames.length)];
    const postcodes: { [key: string]: string } = {
      'Tunis': '1000', 'Ariana': '2000', 'Manouba': '2010', 'Ben Arous': '2020',
      'Nabeul': '8000', 'Sousse': '4000', 'Monastir': '5000', 'Sfax': '3000', 'Gabès': '6000'
    };
    const postcode = postcodes[city] || '1000';
    
    return {
      address: {
        country, state: governorate, city, road: randomStreetName,
        house_number: randomStreetNumber, postcode,
        suburb: '', neighbourhood: '', city_district: '',
        town: city, village: city, municipality: city,
        county: governorate, region: governorate
      },
      display_name: `${randomStreetNumber} ${randomStreetName}, ${city}, ${governorate} ${postcode}, ${country}`
    };
  }

  private updateAddressFields(response: any): void {
    const address = response?.address || {};
    const country = address.country || '';
    const governorate = address.state || address.region || address.county || '';
    const city = address.city || address.town || address.village || address.municipality || '';
    const road = address.road || address.pedestrian || '';
    
    console.log('[Geocoding] ✅ Adresse détectée - Ville:', city, ', Rue:', road);
    
    // Format: Ville seule dans le champ "ville"
    this.formData.ville = city || '';
    
    // Format: "Ville, Rue" dans le champ "adresse"
    // Exemple: "Tunis, Rue Habib Bourguiba"
    if (city && road) {
      this.formData.adresse = `${city}, ${road}`;
    } else if (city) {
      this.formData.adresse = city;
    } else if (road) {
      this.formData.adresse = road;
    } else {
      this.formData.adresse = '';
    }
    
    console.log('[Geocoding] ✅ Champs remplis - Ville:', this.formData.ville, ', Adresse:', this.formData.adresse);
    this.resolvingLocation = false;
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
    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
      this.formErrors['gps'] = 'Position GPS obligatoire. Cliquez sur "Obtenir ma position actuelle" ou entrez les coordonnées.';
    } else if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      this.formErrors['gps'] = 'Coordonnées GPS invalides (lat: -90 à 90, lon: -180 à 180).';
    }
    
    console.log('[Validation] Erreurs:', this.formErrors);
    return Object.keys(this.formErrors).length === 0;
  }

  predictOptimalPrice(): void {
    if (!this.formData.description) {
      this.formErrors['description'] = 'Veuillez rédiger la description avant de prédire le prix.';
      return;
    }
    
    this.predictingPrice = true;
    this.formErrors['prixNuit'] = '';
    
    const categoryName = this.categories.find(c => c.idCategorie === this.formData.idCategorie)?.nomCategorie || 'Logement';
    
    // Créer une description enrichie avec les équipements pour une meilleure prédiction
    const meta: HostHubMeta = {
      nbChambres: this.nbChambres,
      surfaceM2: this.surfaceM2 || undefined,
      equipements: this.selectedEquipements,
      maintenance: this.maintenance
    };
    const enrichedDescription = mergeDescriptionWithMeta(this.formData.description, meta);
    
    console.log('[AI Prediction] Description enrichie avec équipements:', enrichedDescription.substring(0, 150) + '...');
    
    this.predictorService.predictBasePrice(
      enrichedDescription, // Utiliser la description enrichie avec équipements
      this.formData.capacite,
      categoryName,
      this.formData.ville || '' // Passer la ville pour le calcul du prix selon la localisation
    ).subscribe({
      next: (basePrice) => {
        this.predictedBasePrice = basePrice;
        this.applyPriceFromBase(); // Appliquera automatiquement le bonus des équipements
        this.predictingPrice = false;
        this.formErrors['prixNuit'] = '';
        console.log('[AI Prediction] ✅ Prix de base prédit:', basePrice, 'avec', this.selectedEquipements.length, 'équipements');
      },
      error: (err) => {
        this.predictingPrice = false;
        this.formErrors['prixNuit'] = typeof err === 'string' ? err : 'Erreur de prédiction IA';
        console.error('[AI Prediction] ❌ Erreur:', err);
      }
    });
  }

  enhanceDescription() {
    if (!this.formData.description || this.formData.description.trim().length < 10) {
      this.formErrors['description'] = 'Veuillez rédiger une description d\'au moins 10 caractères.';
      return;
    }
    
    console.log('[Enhance] Lancement de la correction avec:', this.formData.description.substring(0, 100) + '...');
    this.enhancingDescription = true;
    this.formErrors['description'] = '';
    
    this.predictorService.enhanceDescription(this.formData.description).subscribe({
      next: (enhancedText) => {
        this.enhancingDescription = false;
        if (enhancedText !== this.formData.description) {
          this.formData.description = enhancedText;
          this.requestSuccess = '✅ Description corrigée et améliorée';
          setTimeout(() => this.requestSuccess = '', 5000);
        } else {
          this.requestSuccess = 'ℹ️ Description déjà correcte';
          setTimeout(() => this.requestSuccess = '', 3000);
        }
      },
      error: (err) => {
        this.enhancingDescription = false;
        this.requestError = '⚠️ Erreur de correction: ' + (err?.message || err);
        setTimeout(() => this.requestError = '', 5000);
      }
    });
  }

  getLocation(): void {
    if (!navigator.geolocation) {
      this.formErrors['gps'] = 'La géolocalisation n\'est pas supportée par votre navigateur.';
      return;
    }
    
    this.resolvingLocation = true;
    this.formErrors['gps'] = '';
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.formData.latitude = parseFloat(position.coords.latitude.toFixed(6));
        this.formData.longitude = parseFloat(position.coords.longitude.toFixed(6));
        console.log('[Geocoding] ✅ Position obtenue - lat:', this.formData.latitude, 'lon:', this.formData.longitude);
        this.onCoordinatesChange();
      },
      (error) => {
        this.formErrors['gps'] = 'Impossible d\'accéder à votre position. Vérifiez les permissions de votre navigateur.';
        this.resolvingLocation = false;
      }
    );
  }
}
