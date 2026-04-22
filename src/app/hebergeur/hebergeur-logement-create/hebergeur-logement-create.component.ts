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
    const endpoint = 'https://nominatim.openstreetmap.org/reverse';
    const url = `${endpoint}?format=jsonv2&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}&addressdetails=1&zoom=18&accept-language=fr`;

    console.log('[Geocoding] Appel Nominatim:', url);
    this.http.get<any>(url).subscribe({
      next: (response) => {
        console.log('[Geocoding] ✅ Réponse Nominatim:', response);
        if (requestId !== this.locationRequestId) {
          console.log('[Geocoding] Request ID mismatch, ignorant');
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
        console.log('[Geocoding] ✅ Succès - Ville:', this.formData.ville, 'Adresse:', this.formData.adresse);
      },
      error: (err) => {
        console.error('[Geocoding] ❌ Erreur:', err);
        if (requestId !== this.locationRequestId) {
          return;
        }
        this.formErrors['gps'] = 'Impossible de déterminer la ville/adresse. Complétez manuellement.';
        this.resolvingLocation = false;
      }
    });
  }

  private validate(): boolean {
    // ✅ Validation complète AVANT d'envoyer au backend
    // Si une erreur est trouvée, elle s'affiche dans le formulaire
    // Le backend fera aussi sa propre validation (ne pas faire confiance au client)
    
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
    if (!this.formData.description || this.formData.description.trim().length === 0) {
      this.formErrors['description'] = 'Veuillez rédiger une description avant de la corriger.';
      return;
    }

    console.log('[Enhance] Lancement de la correction avec:', this.formData.description.substring(0, 50) + '...');
    this.enhancingDescription = true;
    this.formErrors['description'] = '';

    this.predictorService.enhanceDescription(this.formData.description).subscribe({
      next: (enhancedText) => {
        console.log('[Enhance] ✅ Texte amélioré:', enhancedText.substring(0, 50) + '...');
        
        // Show improvement if text actually changed
        if (enhancedText !== this.formData.description) {
          this.formData.description = enhancedText;
          this.requestSuccess = '✅ Description corrigée et améliorée';
          setTimeout(() => this.requestSuccess = '', 5000);
        } else {
          this.requestSuccess = 'ℹ️ Description déjà correcte';
          setTimeout(() => this.requestSuccess = '', 3000);
        }
        
        this.enhancingDescription = false;
      },
      error: (err) => {
        console.error('[Enhance] ❌ Erreur:', err);
        this.enhancingDescription = false;
        const errorMsg = typeof err === 'string' ? err : (err?.message || 'Erreur lors de la correction.');
        this.requestError = '⚠️ Erreur de correction: ' + errorMsg;
        setTimeout(() => this.requestError = '', 5000);
      }
    });
  }

  getLocation(): void {
    if (!navigator.geolocation) {
      this.formErrors['gps'] = 'La géolocalisation n\'est pas supportée par votre navigateur.';
      return;
    }
    
    console.log('[Geolocation] Demande de position GPS...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.formData.latitude = parseFloat(position.coords.latitude.toFixed(6));
        this.formData.longitude = parseFloat(position.coords.longitude.toFixed(6));
        console.log('[Geolocation] ✅ Position obtenue - lat:', this.formData.latitude, 'lon:', this.formData.longitude);
        this.onCoordinatesChange();
      },
      (error) => {
        console.error('[Geolocation] ❌ Erreur:', error);
        this.formErrors['gps'] = 'Impossible d\'accéder à votre position. Vérifiez les permissions du navigateur.';
      }
    );
  }
}
