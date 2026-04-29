import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as L from 'leaflet';
import { DiscountInfo, EventActivity, EventReview, EventReviewRequest, WeatherData } from '../../models/event.model';
import { EventService } from '../../../services/events/event.service';
import { ReservationService } from '../../../services/events/reservation.service';
import { calculateDiscount, defaultEventImage } from '../../utils/discount.util';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.component.html',
  styleUrls: ['./event-detail.component.css']
})
export class EventDetailComponent implements OnInit {
  event: EventActivity | null = null;
  resolvedLatitude: number | null = null;
  resolvedLongitude: number | null = null;
  weather: WeatherData | null = null;
  hideBackButton = false;
  showLocationModal = false;
  locationTab: 'map' | 'street' = 'map';
  discount: DiscountInfo = {
    hasDiscount: false,
    percent: 0,
    discountPercent: 0,
    finalPrice: 0,
    discountedPrice: 0,
    originalPrice: 0,
    label: '',
    reason: '',
  };
  loading = true;
  reserving = false;
  isReserved = false;
  errorMsg = '';
  numberOfTickets = 1;
  reviews: EventReview[] = [];
  reviewRating = 5;
  reviewComment = '';
  reviewError = '';
  reviewSuccess = '';
  hasConfirmedReservationForEvent = false;
  private locationMap: L.Map | null = null;
  private locationMarker: L.CircleMarker | null = null;

  get isLoggedIn(): boolean { return !!this.auth.getToken(); }
  get isClient(): boolean { return this.auth.getCurrentUser()?.role === 'CLIENT_TOURISTE'; }
  get totalPrice(): number {
    if (!this.event) return 0;
    const base = this.discount.hasDiscount ? this.discount.finalPrice : this.event.price;
    return +(base * this.numberOfTickets).toFixed(2);
  }

  get averageRating(): number {
    if (!this.reviews.length) return 0;
    const sum = this.reviews.reduce((acc, r) => acc + r.rating, 0);
    return +(sum / this.reviews.length).toFixed(1);
  }

  get averageRatingRounded(): number {
    return Math.round(this.averageRating);
  }

  get isEventFinished(): boolean {
    if (!this.event?.endDate) return false;
    return new Date(this.event.endDate).getTime() <= Date.now();
  }

  get canReview(): boolean {
    return this.isLoggedIn && this.isClient && this.isEventFinished && this.hasConfirmedReservationForEvent;
  }

  get reviewEligibilityMessage(): string {
    if (!this.isLoggedIn || !this.isClient) {
      return 'Connectez-vous en tant que client pour laisser un avis.';
    }
    if (!this.hasConfirmedReservationForEvent) {
      return 'Vous pouvez laisser un avis uniquement après une réservation confirmée (paiement validé).';
    }
    if (!this.isEventFinished) {
      return 'Vous pourrez laisser un avis dès la fin de cet événement.';
    }
    return '';
  }

  get mapEmbedUrl(): SafeResourceUrl | null {
    if (!this.event) {
      return null;
    }

    const lat = this.effectiveLatitude;
    const lng = this.effectiveLongitude;
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const q = hasCoords
      ? encodeURIComponent(`${lat},${lng}`)
      : encodeURIComponent(`${this.event.address}, ${this.event.city}, Tunisia`);
    const url = `https://maps.google.com/maps?hl=fr&q=${q}&z=16&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  get hasCoordinates(): boolean {
    return !!this.event && (!!this.hasExactCoordinates || !!this.hasAddressFallback);
  }

  private get hasExactCoordinates(): boolean {
    return (
      Number.isFinite(this.effectiveLatitude) &&
      Number.isFinite(this.effectiveLongitude)
    );
  }

  private get hasAddressFallback(): boolean {
    return !!this.event?.address?.trim() || !!this.event?.city?.trim();
  }

  private get effectiveLatitude(): number {
    if (Number.isFinite(this.resolvedLatitude)) {
      return Number(this.resolvedLatitude);
    }

    return Number(this.event?.latitude);
  }

  private get effectiveLongitude(): number {
    if (Number.isFinite(this.resolvedLongitude)) {
      return Number(this.resolvedLongitude);
    }

    return Number(this.event?.longitude);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private resService: ReservationService,
    private auth: AuthService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    const id = +this.route.snapshot.paramMap.get('id')!;
    this.hideBackButton = this.route.snapshot.queryParamMap.get('source') === 'organisateur';
    this.eventService.getPublishedById(id).subscribe({
      next: ev => {
        this.event = ev;
        void this.resolveEventCoordinates(ev);
        this.discount = calculateDiscount(ev.price, ev.startDate, ev.categoryName, {
          promoType: ev.promoType,
          promoPercent: ev.promoPercent,
          promoCode: ev.promoCode,
          promoStartDate: ev.promoStartDate,
          promoEndDate: ev.promoEndDate,
        });
        this.loadReviews(ev.id);
        this.loading = false;
        this.eventService.getEventWeather(id).subscribe({ next: w => this.weather = w, error: () => {} });
        if (this.isLoggedIn) this.checkReservation();
      },
      error: () => { this.loading = false; }
    });
  }

  checkReservation(): void {
    this.resService.getMesReservationsEvent().subscribe({
      next: rs => {
        this.isReserved = rs.some(r => r.eventId === this.event?.id && r.status !== 'CANCELLED');
        this.hasConfirmedReservationForEvent = rs.some(
          r => r.eventId === this.event?.id && r.status === 'CONFIRMED'
        );
      },
      error: () => {}
    });
  }

  reserve(): void {
    if (!this.event) return;
    this.reserving = true; this.errorMsg = '';
    this.resService.create({ numberOfTickets: this.numberOfTickets, eventId: this.event.id }).subscribe({
      next: r => { this.reserving = false; this.router.navigate(['/payment', r.id]); },
      error: err => { this.reserving = false; this.errorMsg = err.error?.message || 'Erreur lors de la réservation.'; }
    });
  }

  incrementTickets(): void {
    if (!this.event) return;
    if (this.numberOfTickets < this.event.availableSeats) {
      this.numberOfTickets += 1;
    }
  }

  decrementTickets(): void {
    if (this.numberOfTickets > 1) {
      this.numberOfTickets -= 1;
    }
  }

  getImage(): string {
    return this.event?.imageUrl || defaultEventImage(this.event?.type || '', this.event?.categoryName);
  }

  openGoogleMaps(): void {
    if (!this.event) return;
    const q = encodeURIComponent(`${this.event.address}, ${this.event.city}, Tunisia`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  openLocationModal(): void {
    this.locationTab = 'map';
    this.showLocationModal = true;
    this.scheduleLocationMapRender();
  }

  closeLocationModal(): void {
    this.showLocationModal = false;
  }

  selectLocationTab(tab: 'map' | 'street'): void {
    this.locationTab = tab;
    if (tab === 'map') {
      this.scheduleLocationMapRender();
    }
  }

  openStreetViewInNewTab(): void {
    if (!this.event) {
      return;
    }

    if (!this.hasExactCoordinates) {
      const q = encodeURIComponent(
        `${this.event.address} ${this.event.city} Tunisia`,
      );
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${q}`,
        '_blank',
      );
      return;
    }

    const lat = this.effectiveLatitude;
    const lng = this.effectiveLongitude;
    const primaryUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    window.open(primaryUrl, '_blank');
  }

  private scheduleLocationMapRender(): void {
    setTimeout(() => this.renderLocationMap(), 0);
  }

  private renderLocationMap(): void {
    if (!this.showLocationModal || this.locationTab !== 'map') {
      return;
    }

    const container = document.getElementById('event-detail-leaflet-map');
    if (!container) {
      return;
    }

    const hasCoords = this.hasExactCoordinates;
    const mapLat = hasCoords ? this.effectiveLatitude : 36.8065;
    const mapLng = hasCoords ? this.effectiveLongitude : 10.1815;
    const inTunisia = this.isInTunisia(mapLat, mapLng);
    const lat = inTunisia ? mapLat : 36.8065;
    const lng = inTunisia ? mapLng : 10.1815;
    const zoom = hasCoords ? 16 : 11;
    const tunisiaBounds = L.latLngBounds(
      L.latLng(30.0, 7.0),
      L.latLng(37.8, 12.5),
    );

    if (!this.locationMap) {
      this.locationMap = L.map(container, {
        zoomControl: true,
        scrollWheelZoom: true,
        maxBounds: tunisiaBounds,
        maxBoundsViscosity: 0.9,
      }).setView([lat, lng], zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(this.locationMap);
    } else {
      this.locationMap.setMaxBounds(tunisiaBounds);
      this.locationMap.setView([lat, lng], zoom, { animate: false });
      this.locationMap.invalidateSize();
    }

    if (this.locationMarker) {
      this.locationMarker.remove();
      this.locationMarker = null;
    }

    if (hasCoords && inTunisia) {
      this.locationMarker = L.circleMarker([lat, lng], {
        radius: 9,
        color: '#0d588d',
        weight: 3,
        fillColor: '#2f9bcf',
        fillOpacity: 0.5,
      }).addTo(this.locationMap);

      this.locationMarker.bindPopup(this.event?.address || 'Lieu evenement').openPopup();
    }
  }

  private isInTunisia(lat: number, lng: number): boolean {
    return lat >= 30.0 && lat <= 37.8 && lng >= 7.0 && lng <= 12.5;
  }

  ngOnDestroy(): void {
    if (this.locationMarker) {
      this.locationMarker.remove();
      this.locationMarker = null;
    }

    if (this.locationMap) {
      this.locationMap.remove();
      this.locationMap = null;
    }
  }

  private async resolveEventCoordinates(ev: EventActivity): Promise<void> {
    const storedLat = Number(ev.latitude);
    const storedLng = Number(ev.longitude);
    const hasStoredCoords = Number.isFinite(storedLat) && Number.isFinite(storedLng);

    const normalizedContext = this.normalizeText(
      `${ev.title} ${ev.address} ${ev.city}`,
    );

    // Hard fallback for a common legacy bad-mapping case.
    if (
      normalizedContext.includes('el jem') &&
      (normalizedContext.includes('amphitheatre') ||
        normalizedContext.includes('amphitheatre romain'))
    ) {
      // Exact monument point (not city center): Amphitheatre d'El Jem.
      this.resolvedLatitude = 35.2964132;
      this.resolvedLongitude = 10.7075096;
      this.scheduleLocationMapRender();
      return;
    }

    if (hasStoredCoords) {
      this.resolvedLatitude = storedLat;
      this.resolvedLongitude = storedLng;
    }

    const normalizedAddress = this.normalizeText(ev.address || '');
    const normalizedTitle = this.normalizeText(ev.title || '');
    const normalizedCity = this.normalizeText(ev.city || '');
    const normalizedFreeQuery =
      `${normalizedTitle} ${normalizedAddress} ${normalizedCity} tunisia`.trim();

    const queries = [
      `${ev.title}, ${ev.address}, ${ev.city}, Tunisia`,
      `${ev.address}, ${ev.city}, Tunisia`,
      `${ev.title}, ${ev.address}, Tunisia`,
      `${ev.title}, ${ev.city}, Tunisia`,
      `${ev.address}, Tunisia`,
      normalizedFreeQuery,
      normalizedAddress ? `${normalizedAddress} tunisia` : '',
      normalizedTitle ? `${normalizedTitle} ${normalizedCity} tunisia` : '',
      normalizedContext.includes('el jem') ? 'el jem amphitheatre tunisia' : '',
    ].filter((q) => q.trim().length > 0);

    for (const rawQuery of queries) {
      const query = encodeURIComponent(rawQuery);

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=1&viewbox=7.0,37.8,12.5,30.0&bounded=1&q=${query}`,
          {
            headers: {
              Accept: 'application/json',
            },
          },
        );

        if (!response.ok) {
          continue;
        }

        const results = (await response.json()) as Array<{
          lat?: string;
          lon?: string;
          display_name?: string;
          name?: string;
          class?: string;
          type?: string;
          importance?: number;
        }>;

        const first = this.pickBestGeocodingResult(ev, results);
        const resolvedLat = Number(first?.lat);
        const resolvedLng = Number(first?.lon);

        if (Number.isFinite(resolvedLat) && Number.isFinite(resolvedLng)) {
          if (!hasStoredCoords) {
            this.resolvedLatitude = resolvedLat;
            this.resolvedLongitude = resolvedLng;
            this.scheduleLocationMapRender();
            return;
          }

          const driftKm = this.distanceKm(
            storedLat,
            storedLng,
            resolvedLat,
            resolvedLng,
          );

          // If old saved coordinates are far from the resolved venue point,
          // prefer the geocoded location for map + 360 opening.
          if (driftKm > 5) {
            this.resolvedLatitude = resolvedLat;
            this.resolvedLongitude = resolvedLng;
          }

          this.scheduleLocationMapRender();
          return;
        }
      } catch {
        // Ignore geocoding failures and keep address fallback.
      }
    }

    if (!hasStoredCoords) {
      this.resolvedLatitude = null;
      this.resolvedLongitude = null;
    }
  }

  private distanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthKm * c;
  }

  private pickBestGeocodingResult(
    ev: EventActivity,
    results: Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
      name?: string;
      class?: string;
      type?: string;
      importance?: number;
    }>,
  ) {
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const target = this.normalizeText(`${ev.title} ${ev.address} ${ev.city}`);
    const city = this.normalizeText(ev.city || '');
    const addressLead = this.normalizeText((ev.address || '').split(',')[0] || '');
    const targetTokens = target
      .split(/\s+/)
      .filter((token) => token.length >= 4);

    let best = results[0];
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const item of results) {
      const text = this.normalizeText(
        `${item.display_name || ''} ${item.name || ''}`,
      );

      let score = 0;

      const matchedTokens = targetTokens.filter((token) => text.includes(token));
      score += matchedTokens.length * 6;

      if (city && text.includes(city)) {
        score += 8;
      }

      if (addressLead && text.includes(addressLead)) {
        score += 16;
      }

      if (item.class === 'tourism' || item.class === 'amenity' || item.class === 'historic') {
        score += 18;
      }

      if (item.type === 'attraction' || item.type === 'theatre' || item.type === 'stadium' || item.type === 'museum' || item.type === 'monument') {
        score += 16;
      }

      if (item.type === 'city' || item.type === 'town' || item.type === 'village' || item.type === 'county' || item.type === 'state') {
        score -= 40;
      }

      if (item.class === 'boundary') {
        score -= 30;
      }

      const importance = Number(item.importance);
      if (Number.isFinite(importance)) {
        score += importance * 8;
      }

      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    return best;
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  goBack(): void { void this.router.navigate(['/events']); }

  setReviewRating(stars: number): void {
    this.reviewRating = stars;
  }

  submitReview(): void {
    this.reviewError = '';
    this.reviewSuccess = '';

    if (!this.event) return;
    if (!this.isLoggedIn || !this.isClient) {
      this.reviewError = 'Connectez-vous en tant que client pour laisser un avis.';
      return;
    }

    if (!this.hasConfirmedReservationForEvent) {
      this.reviewError = 'Avis autorisé uniquement après paiement confirmé pour cet événement.';
      return;
    }

    if (!this.isEventFinished) {
      this.reviewError = 'Vous pourrez publier votre avis après la fin de l\'événement.';
      return;
    }

    const message = this.reviewComment.trim();
    if (message.length < 10) {
      this.reviewError = 'Votre avis doit contenir au moins 10 caractères.';
      return;
    }

    const payload: EventReviewRequest = {
      rating: this.reviewRating,
      comment: message,
    };

    this.eventService.submitReview(this.event.id, payload).subscribe({
      next: () => {
        this.reviewSuccess = 'Merci, votre avis a été publié.';
        this.reviewComment = '';
        this.reviewRating = 5;
        this.loadReviews(this.event!.id);
      },
      error: err => {
        this.reviewError = err?.error?.message || 'Impossible de publier votre avis pour le moment.';
      }
    });
  }

  private loadReviews(eventId: number): void {
    this.eventService.getReviews(eventId).subscribe({
      next: reviews => {
        this.reviews = Array.isArray(reviews) ? reviews : [];
      },
      error: () => {
        this.reviews = [];
      }
    });
  }
}