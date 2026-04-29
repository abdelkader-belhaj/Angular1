// src/app/features/transport/courses/client/demander-course/demander-course.component.ts
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  DemandeCourseService,
  DemandePreauthResponse,
  EstimatePriceResponse,
} from '../../../core/services/demande-course.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TypeVehicule } from '../../../core/models';
import { AuthService } from '../../../../../services/auth.service';
import { ApiService } from '../../../core/services/api.service';

declare const L: any;

interface GeoPoint {
  latitude: number;
  longitude: number;
  adresse?: string;
}

interface LocationSuggestion {
  displayName: string;
  latitude: number;
  longitude: number;
}

const TUNISIA_FALLBACK_SUGGESTIONS: LocationSuggestion[] = [
  { displayName: 'Tunis, Tunisie', latitude: 36.8065, longitude: 10.1815 },
  { displayName: 'Sfax, Tunisie', latitude: 34.7406, longitude: 10.7603 },
  { displayName: 'Sousse, Tunisie', latitude: 35.8256, longitude: 10.6411 },
  { displayName: 'Kairouan, Tunisie', latitude: 35.6781, longitude: 10.0963 },
  {
    displayName: 'Bizerte, Tunisie',
    latitude: 37.2744,
    longitude: 9.8739,
  },
  {
    displayName: 'Nabeul, Tunisie',
    latitude: 36.4561,
    longitude: 10.7376,
  },
  { displayName: 'Gabes, Tunisie', latitude: 33.8815, longitude: 10.0982 },
  { displayName: 'Monastir, Tunisie', latitude: 35.7643, longitude: 10.8113 },
  {
    displayName: 'Medenine, Tunisie',
    latitude: 33.3549,
    longitude: 10.5055,
  },
  { displayName: 'Gafsa, Tunisie', latitude: 34.425, longitude: 8.7842 },
  { displayName: 'Tozeur, Tunisie', latitude: 33.9197, longitude: 8.1335 },
  { displayName: 'Mahdia, Tunisie', latitude: 35.5047, longitude: 11.0622 },
  { displayName: 'Ariana, Tunisie', latitude: 36.8625, longitude: 10.1956 },
  {
    displayName: 'Ben Arous, Tunisie',
    latitude: 36.7531,
    longitude: 10.2189,
  },
  {
    displayName: 'Hammamet, Tunisie',
    latitude: 36.4,
    longitude: 10.6167,
  },
];

@Component({
  selector: 'app-demander-course',
  templateUrl: './demander-course.component.html',
  styleUrls: ['./demander-course.component.css'],
})
export class DemanderCourseComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('mapPicker', { static: false })
  mapPickerRef?: ElementRef<HTMLDivElement>;

  demandeForm!: FormGroup;

  isLoading = false;
  isGeolocating = false;
  estimatedPrice: number | null = null;
  estimatedDistance: number | null = null;
  estimatedDuration: number | null = null;
  departCoords: GeoPoint | null = null;
  arriveeCoords: GeoPoint | null = null;
  selectionMode: 'depart' | 'arrivee' = 'depart';
  departSuggestions: LocationSuggestion[] = [];
  arriveeSuggestions: LocationSuggestion[] = [];
  isLoadingDepartSuggestions = false;
  isLoadingArriveeSuggestions = false;

  private map: any;
  private departMarker: any;
  private arriveeMarker: any;
  private routeLine: any;
  private departSuggestionDebounceHandle: ReturnType<typeof setTimeout> | null =
    null;
  private arriveeSuggestionDebounceHandle: ReturnType<
    typeof setTimeout
  > | null = null;
  private departSuggestionRequestId = 0;
  private arriveeSuggestionRequestId = 0;

  // Modal de paiement pour pre-auth penalty 20%
  cardModalOpen = false;
  paymentIntentIdFromCard: string | null = null;

  readonly TypeVehicule = TypeVehicule;

  typesVehicule = [
    { value: TypeVehicule.ECONOMY, label: 'Économie', icon: '🚕' },
    { value: TypeVehicule.PREMIUM, label: 'Premium', icon: '🚖' },
    { value: TypeVehicule.VAN, label: 'Van', icon: '🚌' },
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private demandeCourseService: DemandeCourseService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    if (this.departSuggestionDebounceHandle) {
      clearTimeout(this.departSuggestionDebounceHandle);
      this.departSuggestionDebounceHandle = null;
    }
    if (this.arriveeSuggestionDebounceHandle) {
      clearTimeout(this.arriveeSuggestionDebounceHandle);
      this.arriveeSuggestionDebounceHandle = null;
    }
    if (this.map) {
      this.map.remove();
    }
  }

  onAddressInput(field: 'depart' | 'arrivee'): void {
    const query = this.getAddressValue(field);
    const timeoutRef =
      field === 'depart'
        ? this.departSuggestionDebounceHandle
        : this.arriveeSuggestionDebounceHandle;

    if (timeoutRef) {
      clearTimeout(timeoutRef);
    }

    if (query.length < 2) {
      this.clearSuggestions(field);
      if (field === 'depart') {
        this.departCoords = null;
      } else {
        this.arriveeCoords = null;
      }
      return;
    }

    const handle = setTimeout(() => {
      void this.loadAddressSuggestions(field, query);
    }, 280);

    if (field === 'depart') {
      this.departSuggestionDebounceHandle = handle;
    } else {
      this.arriveeSuggestionDebounceHandle = handle;
    }
  }

  onAddressFocus(field: 'depart' | 'arrivee'): void {
    const query = this.getAddressValue(field);
    const suggestions =
      field === 'depart' ? this.departSuggestions : this.arriveeSuggestions;

    if (query.length >= 2 && suggestions.length === 0) {
      void this.loadAddressSuggestions(field, query);
    }
  }

  onAddressBlur(field: 'depart' | 'arrivee'): void {
    setTimeout(() => {
      this.clearSuggestions(field);
    }, 160);
  }

  selectAddressSuggestion(
    field: 'depart' | 'arrivee',
    suggestion: LocationSuggestion,
  ): void {
    if (field === 'depart') {
      this.departCoords = {
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        adresse: suggestion.displayName,
      };
      this.demandeForm.patchValue({ adresseDepart: suggestion.displayName });
    } else {
      this.arriveeCoords = {
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        adresse: suggestion.displayName,
      };
      this.demandeForm.patchValue({ adresseArrivee: suggestion.displayName });
    }

    this.clearSuggestions(field);
    this.updateRideMetrics();
    this.syncMapElements();
  }

  setSelectionMode(mode: 'depart' | 'arrivee'): void {
    this.selectionMode = mode;
  }

  swapRidePoints(): void {
    const previousDepart = this.departCoords;
    const previousArrivee = this.arriveeCoords;
    const previousDepartAddress = this.demandeForm.value.adresseDepart;
    const previousArriveeAddress = this.demandeForm.value.adresseArrivee;

    this.departCoords = previousArrivee;
    this.arriveeCoords = previousDepart;

    this.demandeForm.patchValue({
      adresseDepart: this.departCoords?.adresse ?? previousArriveeAddress,
      adresseArrivee: this.arriveeCoords?.adresse ?? previousDepartAddress,
    });

    this.updateRideMetrics();
    this.syncMapElements();
  }

  private initForm(): void {
    this.demandeForm = this.fb.group({
      adresseDepart: ['', Validators.required],
      adresseArrivee: ['', Validators.required],
      typeVehiculeDemande: [TypeVehicule.ECONOMY, Validators.required],
      acceptCancellationPolicy: [false, Validators.requiredTrue],
    });
  }

  get canEstimateRequest(): boolean {
    const depart = (this.demandeForm?.get('adresseDepart')?.value ?? '')
      .toString()
      .trim();
    const arrivee = (this.demandeForm?.get('adresseArrivee')?.value ?? '')
      .toString()
      .trim();
    const type = this.demandeForm?.get('typeVehiculeDemande')?.value;

    return !!depart && !!arrivee && !!type;
  }

  get hasConfirmedCard(): boolean {
    return !!this.paymentIntentIdFromCard;
  }

  get hasAcceptedPolicy(): boolean {
    return !!this.demandeForm?.get('acceptCancellationPolicy')?.value;
  }

  get canSubmitDemande(): boolean {
    return (
      !this.isLoading &&
      this.estimatedPrice !== null &&
      this.hasConfirmedCard &&
      this.hasAcceptedPolicy
    );
  }

  get submitBlockingMessage(): string {
    if (this.estimatedPrice === null) {
      return 'Commencez par calculer le prix.';
    }
    if (!this.hasAcceptedPolicy) {
      return 'Veuillez accepter la politique d annulation.';
    }
    if (!this.hasConfirmedCard) {
      return 'Ajoutez et confirmez votre carte avant de demander la course.';
    }

    return '';
  }

  async estimerPrix(): Promise<void> {
    if (!this.canEstimateRequest) {
      this.notificationService.warning(
        'Formulaire incomplet',
        'Veuillez remplir les deux adresses',
      );
      return;
    }

    this.isLoading = true;

    try {
      await this.resolveRouteCoordinates();

      if (!this.departCoords || !this.arriveeCoords) {
        this.notificationService.warning(
          'Localisation',
          "Impossible de localiser le départ ou l'arrivée.",
        );
        return;
      }

      this.updateRideMetrics();
      this.syncMapElements();

      const estimatePayload = {
        departLatitude: this.departCoords.latitude,
        departLongitude: this.departCoords.longitude,
        arriveeLatitude: this.arriveeCoords.latitude,
        arriveeLongitude: this.arriveeCoords.longitude,
        typeVehiculeDemande: this.demandeForm.value.typeVehiculeDemande,
      };

      const estimate = (await firstValueFrom(
        this.demandeCourseService.estimatePrice(estimatePayload),
      )) as EstimatePriceResponse;

      this.estimatedPrice = Number(estimate?.prixEstimeCalcule ?? 0);
      this.estimatedDistance = Number(estimate?.distanceKm ?? 0);
      this.estimatedDuration = Math.max(
        1,
        Math.round(Number(estimate?.dureeEstimeeMinutes ?? 0)),
      );

      if (!Number.isFinite(this.estimatedPrice) || this.estimatedPrice <= 0) {
        throw new Error('Invalid estimate response');
      }

      this.notificationService.info(
        'Prix calculé',
        `Distance ≈ ${this.estimatedDistance} km`,
      );
    } catch {
      const fallback = this.estimatePriceLocally();
      if (fallback != null) {
        this.estimatedPrice = fallback;
        this.notificationService.warning(
          'Estimation locale',
          'Tarif serveur indisponible. Un calcul local a été appliqué.',
        );
      } else {
        this.notificationService.error(
          'Estimation',
          'Impossible de récupérer le prix serveur. Vérifiez les adresses puis réessayez.',
        );
        this.estimatedPrice = null;
      }
    } finally {
      this.isLoading = false;
    }
  }

  openCardModal(): void {
    if (!this.estimatedPrice) {
      this.notificationService.warning(
        'Erreur',
        'Veuillez d abord calculer le prix.',
      );
      return;
    }
    if (!this.hasAcceptedPolicy) {
      this.notificationService.warning(
        'Pré-autorisation',
        'Veuillez accepter la pré-autorisation avant d ajouter la carte.',
      );
      return;
    }
    this.cardModalOpen = true;
  }

  onCardConfirmed(paymentIntent: any): void {
    if (paymentIntent?.paymentIntentId) {
      this.paymentIntentIdFromCard = paymentIntent.paymentIntentId;
      this.cardModalOpen = false;
      this.notificationService.success('Succès', 'Carte ajoutée avec succès.');
    }
  }

  onCardCancelled(): void {
    this.cardModalOpen = false;
    this.notificationService.info(
      'Annulation',
      'Veuillez ajouter une carte pour continuer.',
    );
  }

  async demanderCourse(): Promise<void> {
    if (this.estimatedPrice === null) {
      this.notificationService.warning(
        'Attention',
        'Veuillez d abord calculer le prix.',
      );
      return;
    }

    if (!this.hasConfirmedCard) {
      this.notificationService.error(
        'Paiement',
        'Veuillez d abord ajouter et confirmer votre carte pour proceder.',
      );
      return;
    }

    if (!this.hasAcceptedPolicy) {
      this.notificationService.warning(
        'Confirmation requise',
        'Veuillez accepter la politique d annulation avant de continuer.',
      );
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.notificationService.error(
        'Authentification',
        'Utilisateur non connecté.',
      );
      return;
    }

    this.isLoading = true;

    await this.resolveRouteCoordinates();

    if (!this.departCoords || !this.arriveeCoords) {
      this.isLoading = false;
      this.notificationService.warning(
        'Localisation',
        'Vérifiez les adresses pour obtenir des coordonnées GPS valides.',
      );
      return;
    }

    const departId = await this.resolveLocalisationId(
      this.departCoords,
      'départ',
    );
    const arriveeId = await this.resolveLocalisationId(
      this.arriveeCoords,
      'arrivée',
    );

    if (!departId || !arriveeId) {
      this.isLoading = false;
      this.notificationService.error(
        'Localisation',
        'Impossible de créer les points GPS réels. Réessayez, puis recalculez le prix.',
      );
      return;
    }

    const request: any = {
      clientId: currentUser.id,
      localisationDepartId: departId,
      localisationArriveeId: arriveeId,
      typeVehiculeDemande: this.demandeForm.value.typeVehiculeDemande,
      prixEstime: this.estimatedPrice,

      // Compatibilité avec d'autres DTO backend possibles
      client: { id: currentUser.id },
      localisationDepart: {
        idLocalisation: departId,
        latitude: this.departCoords.latitude,
        longitude: this.departCoords.longitude,
        adresse: this.demandeForm.value.adresseDepart,
      },
      localisationArrivee: {
        idLocalisation: arriveeId,
        latitude: this.arriveeCoords.latitude,
        longitude: this.arriveeCoords.longitude,
        adresse: this.demandeForm.value.adresseArrivee,
      },
    };

    // 1. On crée la demande
    this.demandeCourseService.createDemande(request).subscribe({
      next: (response) => {
        const idDemande = response.idDemande ?? (response as any).id;

        if (idDemande) {
          // Use backend-confirmed estimate and round up to guarantee >= 20%.
          const backendEstimatedPrice = Number(response.prixEstime);
          const localEstimatedPrice = Number(this.estimatedPrice ?? 0);
          const estimatedBase = Math.max(
            Number.isFinite(backendEstimatedPrice) ? backendEstimatedPrice : 0,
            Number.isFinite(localEstimatedPrice) ? localEstimatedPrice : 0,
          );
          const penaltyHold = Math.ceil(estimatedBase * 0.2 * 100) / 100;
          this.demandeCourseService
            .preAuthorizePenalty(
              idDemande,
              penaltyHold,
              this.paymentIntentIdFromCard ?? 'CARD',
            )
            .subscribe({
              next: (preauth: DemandePreauthResponse) => {
                if (!preauth?.authorized) {
                  this.notificationService.error(
                    'Paiement',
                    'Pré-autorisation refusée. Impossible de lancer la course.',
                  );
                  this.isLoading = false;
                  return;
                }

                // 3. Matching uniquement après hold paiement validé.
                this.demandeCourseService.startMatching(idDemande).subscribe({
                  next: () => {
                    this.notificationService.success(
                      'Succès',
                      'Recherche de chauffeur lancée !',
                    );

                    this.router.navigate(['/transport/attente-chauffeur'], {
                      state: { demandeId: idDemande },
                    });
                  },
                  error: () => {
                    this.notificationService.error(
                      'Erreur',
                      'Demande créée, mais matching non démarré.',
                    );
                    this.isLoading = false;
                  },
                });
              },
              error: () => {
                this.notificationService.error(
                  'Paiement',
                  'Pré-autorisation échouée. Vérifiez votre moyen de paiement.',
                );
                this.isLoading = false;
              },
            });
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('[DEMANDE DEBUG] payload rejected', { request, err });
        this.notificationService.error(
          'Erreur',
          'Impossible de créer la demande.',
        );
      },
    });
  }

  utiliserMaPositionPourDepart(): void {
    if (!navigator.geolocation) {
      this.notificationService.warning(
        'Localisation',
        'Géolocalisation non supportée par ce navigateur.',
      );
      return;
    }

    this.isGeolocating = true;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        this.departCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        const reverseAddress = await this.reverseGeocode(
          this.departCoords.latitude,
          this.departCoords.longitude,
        );

        if (reverseAddress) {
          this.demandeForm.patchValue({ adresseDepart: reverseAddress });
          this.departCoords.adresse = reverseAddress;
        }

        this.updateRideMetrics();
        this.syncMapElements();

        this.isGeolocating = false;
      },
      () => {
        this.isGeolocating = false;
        this.notificationService.warning(
          'Localisation',
          'Impossible de récupérer votre position actuelle.',
        );
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  private initMap(): void {
    if (!this.mapPickerRef?.nativeElement || this.map) {
      return;
    }

    this.map = L.map(this.mapPickerRef.nativeElement, {
      zoomControl: true,
      attributionControl: true,
    }).setView([36.8065, 10.1815], 12);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
    ).addTo(this.map);

    this.map.on('click', (event: any) => {
      this.handleMapSelection(event.latlng.lat, event.latlng.lng);
    });

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private async handleMapSelection(
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const point: GeoPoint = { latitude, longitude };
    const reverseAddress = await this.reverseGeocode(latitude, longitude);

    if (this.selectionMode === 'depart') {
      this.departCoords = { ...point, adresse: reverseAddress ?? undefined };
      this.demandeForm.patchValue({
        adresseDepart:
          reverseAddress ?? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      });
    } else {
      this.arriveeCoords = { ...point, adresse: reverseAddress ?? undefined };
      this.demandeForm.patchValue({
        adresseArrivee:
          reverseAddress ?? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      });
    }

    this.updateRideMetrics();
    this.syncMapElements();
  }

  private syncMapElements(): void {
    if (!this.map) {
      return;
    }

    if (this.departCoords) {
      if (!this.departMarker) {
        this.departMarker = L.circleMarker(
          [this.departCoords.latitude, this.departCoords.longitude],
          {
            radius: 8,
            color: '#14b8a6',
            fillColor: '#14b8a6',
            fillOpacity: 0.9,
          },
        ).addTo(this.map);
      } else {
        this.departMarker.setLatLng([
          this.departCoords.latitude,
          this.departCoords.longitude,
        ]);
      }
    }

    if (this.arriveeCoords) {
      if (!this.arriveeMarker) {
        this.arriveeMarker = L.circleMarker(
          [this.arriveeCoords.latitude, this.arriveeCoords.longitude],
          {
            radius: 8,
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.9,
          },
        ).addTo(this.map);
      } else {
        this.arriveeMarker.setLatLng([
          this.arriveeCoords.latitude,
          this.arriveeCoords.longitude,
        ]);
      }
    }

    if (this.departCoords && this.arriveeCoords) {
      const route = [
        [this.departCoords.latitude, this.departCoords.longitude],
        [this.arriveeCoords.latitude, this.arriveeCoords.longitude],
      ];

      if (!this.routeLine) {
        this.routeLine = L.polyline(route, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.85,
          dashArray: '8 8',
        }).addTo(this.map);
      } else {
        this.routeLine.setLatLngs(route);
      }

      this.map.fitBounds(route as any, { padding: [35, 35] });
    } else if (this.departCoords) {
      this.map.setView(
        [this.departCoords.latitude, this.departCoords.longitude],
        14,
      );
    }
  }

  private async resolveRouteCoordinates(): Promise<void> {
    const depart = (this.demandeForm.value.adresseDepart || '').trim();
    const arrivee = (this.demandeForm.value.adresseArrivee || '').trim();

    if (!depart || !arrivee) {
      return;
    }

    this.departCoords = await this.geocodeAddress(depart);
    this.arriveeCoords = await this.geocodeAddress(arrivee);
    this.updateRideMetrics();
    this.syncMapElements();
  }

  private async geocodeAddress(address: string): Promise<GeoPoint | null> {
    const params = new HttpParams()
      .set('q', address)
      .set('format', 'json')
      .set('limit', '1')
      .set('addressdetails', '1')
      .set('accept-language', 'fr');

    try {
      const response = await firstValueFrom(
        this.http.get<any[]>('https://nominatim.openstreetmap.org/search', {
          params,
        }),
      );

      if (!Array.isArray(response) || response.length === 0) {
        return null;
      }

      const best = response[0];
      const lat = Number(best?.lat);
      const lon = Number(best?.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }

      return {
        latitude: lat,
        longitude: lon,
        adresse: best?.display_name || address,
      };
    } catch {
      return null;
    }
  }

  private getAddressValue(field: 'depart' | 'arrivee'): string {
    const controlName = field === 'depart' ? 'adresseDepart' : 'adresseArrivee';
    return (this.demandeForm?.get(controlName)?.value ?? '').toString().trim();
  }

  private clearSuggestions(field: 'depart' | 'arrivee'): void {
    if (field === 'depart') {
      this.departSuggestions = [];
      this.isLoadingDepartSuggestions = false;
      return;
    }

    this.arriveeSuggestions = [];
    this.isLoadingArriveeSuggestions = false;
  }

  private async loadAddressSuggestions(
    field: 'depart' | 'arrivee',
    query: string,
  ): Promise<void> {
    if (query.length < 2) {
      this.clearSuggestions(field);
      return;
    }

    const requestId =
      field === 'depart'
        ? ++this.departSuggestionRequestId
        : ++this.arriveeSuggestionRequestId;

    if (field === 'depart') {
      this.isLoadingDepartSuggestions = true;
    } else {
      this.isLoadingArriveeSuggestions = true;
    }

    const params = new HttpParams()
      .set('q', query)
      .set('format', 'json')
      .set('limit', '5')
      .set('addressdetails', '1')
      .set('accept-language', 'fr');

    try {
      const response = await firstValueFrom(
        this.http.get<any[]>('https://nominatim.openstreetmap.org/search', {
          params,
        }),
      );

      if (!this.isLatestSuggestionRequest(field, requestId)) {
        return;
      }

      const suggestions = (Array.isArray(response) ? response : [])
        .map((item) => {
          const latitude = Number(item?.lat);
          const longitude = Number(item?.lon);
          const displayName = String(item?.display_name ?? '').trim();

          if (
            !displayName ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
          ) {
            return null;
          }

          return {
            displayName,
            latitude,
            longitude,
          } as LocationSuggestion;
        })
        .filter((item): item is LocationSuggestion => !!item);

      const finalSuggestions =
        suggestions.length > 0
          ? suggestions
          : this.getTunisiaFallbackSuggestions(query);

      if (field === 'depart') {
        this.departSuggestions = finalSuggestions;
        this.isLoadingDepartSuggestions = false;
      } else {
        this.arriveeSuggestions = finalSuggestions;
        this.isLoadingArriveeSuggestions = false;
      }
    } catch {
      if (!this.isLatestSuggestionRequest(field, requestId)) {
        return;
      }

      const fallback = this.getTunisiaFallbackSuggestions(query);
      if (field === 'depart') {
        this.departSuggestions = fallback;
        this.isLoadingDepartSuggestions = false;
      } else {
        this.arriveeSuggestions = fallback;
        this.isLoadingArriveeSuggestions = false;
      }
    }
  }

  private getTunisiaFallbackSuggestions(query: string): LocationSuggestion[] {
    const normalizedQuery = this.normalizeForSearch(query);
    if (normalizedQuery.length < 2) {
      return [];
    }

    return TUNISIA_FALLBACK_SUGGESTIONS.filter((item) =>
      this.normalizeForSearch(item.displayName).includes(normalizedQuery),
    ).slice(0, 5);
  }

  private normalizeForSearch(value: string): string {
    return String(value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private isLatestSuggestionRequest(
    field: 'depart' | 'arrivee',
    requestId: number,
  ): boolean {
    return field === 'depart'
      ? requestId === this.departSuggestionRequestId
      : requestId === this.arriveeSuggestionRequestId;
  }

  private async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<string | null> {
    const params = new HttpParams()
      .set('lat', String(latitude))
      .set('lon', String(longitude))
      .set('format', 'json')
      .set('accept-language', 'fr');

    try {
      const response = await firstValueFrom(
        this.http.get<any>('https://nominatim.openstreetmap.org/reverse', {
          params,
        }),
      );

      return response?.display_name ?? null;
    } catch {
      return null;
    }
  }

  private updateRideMetrics(): void {
    if (!this.departCoords || !this.arriveeCoords) {
      return;
    }

    const distanceKm = this.computeDistanceKm(
      this.departCoords.latitude,
      this.departCoords.longitude,
      this.arriveeCoords.latitude,
      this.arriveeCoords.longitude,
    );

    this.estimatedDistance = Math.round(distanceKm * 10) / 10;
    this.estimatedDuration = Math.max(4, Math.round(distanceKm * 2.5 + 4));
  }

  private async resolveLocalisationId(
    point: GeoPoint,
    label: 'départ' | 'arrivée',
  ): Promise<number | null> {
    const payload = {
      latitude: point.latitude,
      longitude: point.longitude,
      adresse: point.adresse,
    };

    const endpointCandidates = ['/localisations', '/localisation'];

    for (const endpoint of endpointCandidates) {
      try {
        const created = await firstValueFrom(
          this.apiService.post<any>(endpoint, payload),
        );
        const id = this.extractLocalisationId(created);
        if (id) {
          return id;
        }
      } catch {
        // Try next endpoint candidate.
      }
    }

    console.warn(
      `[DEMANDE DEBUG] impossible de créer la localisation ${label}`,
      payload,
    );
    return null;
  }

  private extractLocalisationId(payload: any): number | null {
    const id = Number(
      payload?.idLocalisation ??
        payload?.id ??
        payload?.localisation?.idLocalisation ??
        payload?.data?.idLocalisation ??
        0,
    );

    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private computeDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const earthRadiusKm = 6371;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private estimatePriceLocally(): number | null {
    const distance = Number(this.estimatedDistance ?? 0);
    const duration = Number(this.estimatedDuration ?? 0);
    if (
      !Number.isFinite(distance) ||
      !Number.isFinite(duration) ||
      distance <= 0
    ) {
      return null;
    }

    const type = this.demandeForm.value.typeVehiculeDemande as TypeVehicule;
    const baseFee = 5;

    const perKm =
      type === TypeVehicule.PREMIUM
        ? 3.8
        : type === TypeVehicule.VAN
          ? 4.5
          : 2.5;

    const perMin =
      type === TypeVehicule.PREMIUM
        ? 0.6
        : type === TypeVehicule.VAN
          ? 0.7
          : 0.4;

    const value = baseFee + distance * perKm + duration * perMin;
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }
}
