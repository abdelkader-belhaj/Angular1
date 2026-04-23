import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as L from 'leaflet';
import jsQR from 'jsqr';
import { firstValueFrom } from 'rxjs';
import {
  EventActivity,
  EventActivityRequest,
  EventReservation,
  EventQrScanResult,
  EventCategory,
  EventStatus,
  EventType,
  WeatherInfo,
} from '../event/models/event.model';
import {
  EventAiAssistantService,
  PriceSuggestionResponse,
} from '../services/events/event-ai-assistant.service';
import { EventService } from '../services/events/event.service';
import { ReservationService } from '../services/events/reservation.service';
import { AuthService } from '../services/auth.service';
import { ForecastWeatherInfo, WeatherService } from '../services/events/Weather.service';


@Component({
  selector: 'app-organisateur-page',
  templateUrl: './organisateur-page.component.html',
  styleUrl: './organisateur-page.component.css',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
})
export class OrganisateurPageComponent implements OnInit, OnDestroy {
  private static readonly MIN_TITLE_REAL_LENGTH = 15;
  private static readonly MIN_DESCRIPTION_REAL_LENGTH = 20;

  activeTab: 'events' | 'create' | 'carte' | 'calendar' | 'reservations' | 'qr' | 'stats' = 'events';
  formStep: 1 | 2 | 3 | 4 = 1;
  private readonly resolvedCoords = new Map<number, { lat: number; lng: number }>();
  private readonly geocodeCache = new Map<string, { lat: number; lng: number }>();
  private readonly tunisiaBounds = {
    minLat: 30.23,
    maxLat: 37.35,
    minLng: 7.52,
    maxLng: 11.88,
  };
  private leafletMap: L.Map | null = null;
  private tunisiaOverlay: L.ImageOverlay | null = null;
  private leafletMarkers = new Map<number, L.Marker>();
  private mapInitialized = false;
  private formPickerMap: L.Map | null = null;
  private formPickerMarker: L.Marker | null = null;
  mapFilter: 'ALL' | 'PUBLISHED' | 'DRAFT' = 'ALL';
  showFormMapPicker = false;
  geolocatingInProgress = false;
  private failedGeocodingRetries = new Map<number, number>();
  calendarAnchorDate = new Date();
  calendarSelectedDateKey = this.toDateKey(new Date());

  loading = true;
  errorMsg = '';
  actionMsg = '';
  hoveredPin: { id: number; xPct: number; yPct: number; title: string; city: string; status: EventStatus } | null = null;
  highlightedId: number | null = null;

  events: EventActivity[] = [];
  categories: EventCategory[] = [];
  eventQuickSearch = '';
  eventQuickStatus: 'ALL' | 'PUBLISHED' | 'DRAFT' | 'REJECTED' | 'CANCELLED' = 'ALL';
  eventQuickDate = '';
  reservationsByEvent: Record<number, EventReservation[]> = {};
  allReservations: EventReservation[] = [];
  reservationsFiltrees: EventReservation[] = [];

  filtreStatutReservation = '';
  filtreEventId = '';
  filtreQrReservation = '';

  qrPayload = '';
  scanResult: EventQrScanResult | null = null;
  validating = false;
  aiQrHint = '';
  cameraScanning = false;
  cameraSupported = typeof window !== 'undefined' && !!navigator?.mediaDevices?.getUserMedia;
  barcodeDetectorSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  private qrStream: MediaStream | null = null;
  private qrScanLoopHandle: number | null = null;
  private priceAutoManaged = true;
  priceAiLoading = false;
  priceAiError = '';
  aiPriceSuggestion: PriceSuggestionResponse | null = null;
  private priceSuggestionTimer: ReturnType<typeof setTimeout> | null = null;
  private priceSuggestionRequestKey = '';
  dateAvailabilityNotice = '';

  formWeather: WeatherInfo | null = null;
  weatherForecastTime: string | null = null;
  weatherSource: 'forecast' | 'current' | null = null;
  dateAvailability: {
    date: string;
    eventsCount: number;
    status: 'AVAILABLE' | 'BUSY' | 'SATURATED' | string;
    message: string;
    suggestions: string[];
  } | null = null;
  weatherLoading = false;
  geoLoading = false;
  localImagePreview = '';

  saving = false;
  formMode: 'create' | 'edit' = 'create';
  editingId: number | null = null;
  form: EventActivityRequest = this.createEmptyForm();

  showConfirm = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmEventId: number | null = null;
  confirmCancellationReason = '';
  confirmCancellationRisk: { score: number; label: string; reason: string } = { score: 0, label: '', reason: '' };
  showCancelBlockedModal = false;
  cancelBlockedTitle = '';
  cancelBlockedMessage = '';
  hoveredCategorySegment: { name: string; pct: number; color: string } | null = null;
  private confirmAction: ((reason: string) => void) | null = null;

  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('qrVideo') private qrVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('qrCanvas') private qrCanvas?: ElementRef<HTMLCanvasElement>;

  constructor(
    private readonly eventService: EventService,
    private readonly eventAiAssistantService: EventAiAssistantService,
    private readonly reservationService: ReservationService,
    private readonly authService: AuthService,
    private readonly weatherService: WeatherService,
    private readonly sanitizer: DomSanitizer,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  get organizerEmail(): string {
    return this.authService.getCurrentUser()?.email ?? 'inconnu';
  }

  get qrResultUsed(): boolean {
    if (!this.scanResult || this.scanResult.valid) return false;
    return /deja|déjà|utilis/i.test(this.scanResult.message);
  }

  get qrResultPending(): boolean {
    if (!this.scanResult || this.scanResult.valid) return false;
    return /non confirm|paiement/i.test(this.scanResult.message);
  }

  get qrResultTitle(): string {
    if (!this.scanResult) return '';
    if (this.scanResult.valid) return 'Ticket Valide !';
    if (this.qrResultUsed) return 'Déjà Utilisé !';
    if (this.qrResultPending) return 'Paiement non confirmé !';
    return 'Ticket invalide';
  }

  get qrResultIcon(): string {
    if (!this.scanResult) return '';
    if (this.scanResult.valid) return '✅';
    if (this.qrResultUsed) return '❌';
    if (this.qrResultPending) return '⚠️';
    return '❌';
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadOrganizerData();
  }

  ngOnDestroy(): void {
    if (this.priceSuggestionTimer) {
      clearTimeout(this.priceSuggestionTimer);
      this.priceSuggestionTimer = null;
    }
    this.stopAiQrCamera();
    this.destroyLeafletMap();
    this.destroyFormPickerMap();
  }

  get categoriesForType(): EventCategory[] {
    return this.categories.filter(c => c.type === this.form.type);
  }

  get formProgressPct(): number {
    return (this.formStep / 4) * 100;
  }

  get canGoStep2(): boolean {
    return !!(
      this.form.title.trim() &&
      this.form.description.trim() &&
      !this.hasFakeContent &&
      this.form.categoryId
    );
  }

  get titleRealLength(): number {
    return this.realTextLength(this.form.title);
  }

  get descriptionRealLength(): number {
    return this.realTextLength(this.form.description);
  }

  get hasFakeContent(): boolean {
    const text = `${this.form.title} ${this.form.description} ${this.form.city}`.toLowerCase();
    return [
      /\btest\b/,
      /\baaa+\b/,
      /\bxxx+\b/,
      /\basdf\b/,
      /\bqwerty\b/,
      /\blorem\b/,
      /\bdemo\b/
    ].some((pattern) => pattern.test(text));
  }

  get canGoStep3(): boolean {
    return !!(
      this.form.city.trim() &&
      this.form.address.trim() &&
      this.form.startDate &&
      this.form.endDate
    );
  }

  get projectedRevenue(): number {
    return this.events.reduce((sum, ev) => sum + this.getEventRevenue(ev.id), 0);
  }

  get occupancyRate(): number {
    const totalCapacity = this.events.reduce((sum, ev) => sum + ev.capacity, 0);
    if (!totalCapacity) return 0;
    const used = this.events.reduce((sum, ev) => sum + (ev.capacity - ev.availableSeats), 0);
    return Math.round((used / totalCapacity) * 100);
  }

  get totalReservations(): number {
    return Object.values(this.reservationsByEvent).reduce((sum, list) => sum + list.length, 0);
  }

  get confirmedReservations(): number {
    return Object.values(this.reservationsByEvent)
      .flat()
      .filter(r => r.status === 'CONFIRMED')
      .length;
  }

  get confirmImpactedClients(): number {
    return this.confirmEventId ? this.getEventConfirmedCount(this.confirmEventId) : 0;
  }

  get confirmEstimatedRefund(): number {
    return this.confirmEventId ? this.getEventRevenue(this.confirmEventId) : 0;
  }

  get filteredOrganizerEvents(): EventActivity[] {
    const query = this.eventQuickSearch.trim().toLowerCase();
    return this.events.filter((ev) => {
      const matchStatus = this.eventQuickStatus === 'ALL' || ev.status === this.eventQuickStatus;
      const matchQuery = !query
        || ev.title.toLowerCase().includes(query)
        || ev.city.toLowerCase().includes(query)
        || (ev.categoryName ?? '').toLowerCase().includes(query);
      const eventDateKey = this.toDateKey(new Date(ev.startDate));
      const matchDate = !this.eventQuickDate || eventDateKey === this.eventQuickDate;
      return matchStatus && matchQuery && matchDate;
    });
  }

  get successPrediction(): {
    score: number;
    label: string;
    reason: string;
    recommendation: string;
    factors: Array<{ label: string; score: number; max: number; comment: string }>;
  } {
    const categoryName = this.selectedCategoryName().toLowerCase();
    const city = this.form.city.trim().toLowerCase();
    const day = this.form.startDate ? new Date(this.form.startDate).getDay() : -1;
    const month = this.form.startDate ? new Date(this.form.startDate).getMonth() + 1 : -1;
    const factors: Array<{ label: string; score: number; max: number; comment: string }> = [];

    // Facteur 1 - Categorie x Saison (25)
    let catScore = 10;
    let catComment = 'Categorie standard';
    if (categoryName.includes('concert') || categoryName.includes('jazz') || categoryName.includes('festival')) {
      catScore = month >= 4 && month <= 10 ? 25 : 15;
      catComment = month >= 4 && month <= 10
        ? 'Festival/concert en saison haute.'
        : 'Festival hors saison - public reduit.';
    } else if (categoryName.includes('plage') || categoryName.includes('nautique') || categoryName.includes('sailing')) {
      catScore = month >= 5 && month <= 9 ? 25 : 8;
      catComment = month >= 5 && month <= 9
        ? 'Activite nautique en ete.'
        : 'Activite nautique hors saison.';
    } else if (categoryName.includes('randonnee') || categoryName.includes('trek')) {
      catScore = (month >= 3 && month <= 5) || (month >= 9 && month <= 11) ? 22 : 12;
      catComment = 'Printemps/automne ideal pour randonnee.';
    } else if (categoryName.includes('yoga') || categoryName.includes('atelier') || categoryName.includes('artisan')) {
      catScore = 18;
      catComment = 'Activite stable toute l annee.';
    }
    factors.push({ label: 'Categorie x Saison', score: catScore, max: 25, comment: catComment });

    // Facteur 2 - Prix (20)
    let priceScore = 10;
    let priceComment = '';
    if (this.form.price === 0) {
      priceScore = 14;
      priceComment = 'Gratuit - fort attrait public.';
    } else if (this.form.price <= 30) {
      priceScore = 20;
      priceComment = 'Prix tres accessible.';
    } else if (this.form.price <= 70) {
      priceScore = 16;
      priceComment = 'Prix dans la moyenne du marche.';
    } else if (this.form.price <= 150) {
      priceScore = 10;
      priceComment = 'Prix eleve - public cible reduit.';
    } else {
      priceScore = 5;
      priceComment = 'Prix premium - niche limitee.';
    }
    factors.push({ label: 'Prix', score: priceScore, max: 20, comment: priceComment });

    // Facteur 3 - Jour semaine (15)
    let dayScore = 8;
    let dayComment = '';
    if (day === 5 || day === 6) {
      dayScore = 15;
      dayComment = 'Vendredi/Samedi - pic de disponibilite.';
    } else if (day === 0) {
      dayScore = 12;
      dayComment = 'Dimanche - bon pour familles.';
    } else if (day === 4) {
      dayScore = 10;
      dayComment = 'Jeudi - debut de week-end.';
    } else {
      dayScore = 5;
      dayComment = 'Semaine - public reduit.';
    }
    factors.push({ label: 'Jour de la semaine', score: dayScore, max: 15, comment: dayComment });

    // Facteur 4 - Meteo (20)
    let weatherScore = 10;
    let weatherComment = 'Meteo non chargee.';
    if (this.formWeather) {
      const temp = this.formWeather.temperature;
      const desc = (this.formWeather.description ?? '').toLowerCase();
      const hasRain = desc.includes('pluie') || desc.includes('rain');
      if (hasRain) {
        weatherScore = 3;
        weatherComment = 'Pluie prevue - impact negatif.';
      } else if (temp >= 20 && temp <= 30) {
        weatherScore = 20;
        weatherComment = 'Meteo ideale.';
      } else if (temp > 30 && temp <= 35) {
        weatherScore = 12;
        weatherComment = 'Chaud - prevoir ombre.';
      } else if (temp > 35) {
        weatherScore = 4;
        weatherComment = 'Canicule - risque eleve.';
      } else if (temp < 12) {
        weatherScore = 6;
        weatherComment = 'Froid - participation reduite.';
      } else {
        weatherScore = 14;
        weatherComment = 'Meteo acceptable.';
      }
    }
    factors.push({ label: 'Meteo prevue', score: weatherScore, max: 20, comment: weatherComment });

    // Facteur 5 - Ville (10)
    let cityScore = 6;
    let cityComment = 'Ville secondaire.';
    const bigCities = ['tunis', 'sousse', 'hammamet', 'sfax', 'monastir', 'djerba', 'nabeul'];
    const touristCities = ['sidi bou said', 'carthage', 'gammarth', 'tabarka', 'tozeur'];
    if (bigCities.some(c => city.includes(c))) {
      cityScore = 10;
      cityComment = 'Grande ville - audience large.';
    } else if (touristCities.some(c => city.includes(c))) {
      cityScore = 9;
      cityComment = 'Ville touristique - bon potentiel.';
    }
    factors.push({ label: 'Ville', score: cityScore, max: 10, comment: cityComment });

    // Facteur 6 - Disponibilite de la date (10)
    let dateLoadScore = 8;
    let dateLoadComment = 'Date libre ou peu chargee.';
    const selectedDate = this.form.startDate ? this.form.startDate.slice(0, 10) : '';
    const availability = this.dateAvailability;
    if (selectedDate && availability && availability.date === selectedDate) {
      const count = availability.eventsCount ?? 0;
      if (count === 0) {
        dateLoadScore = 10;
        dateLoadComment = 'Aucun autre evenement ce jour.';
      } else if (count <= 2) {
        dateLoadScore = 7;
        dateLoadComment = 'Concurrence moderee ce jour.';
      } else if (count <= 5) {
        dateLoadScore = 4;
        dateLoadComment = 'Date chargee, impact possible sur la demande.';
      } else {
        dateLoadScore = 2;
        dateLoadComment = 'Date saturee, risque de baisse des reservations.';
      }
    }
    factors.push({ label: 'Disponibilite date', score: dateLoadScore, max: 10, comment: dateLoadComment });

    const totalScore = Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.score, 0)));
    const label = totalScore >= 75 ? 'Forte' : totalScore >= 55 ? 'Bonne' : totalScore >= 35 ? 'Moyenne' : 'Faible';
    const reason = totalScore >= 75
      ? 'Excellent contexte - categorie, prix, timing et meteo alignes.'
      : totalScore >= 55
        ? 'Bon potentiel - quelques facteurs a optimiser.'
        : 'Risque de faible participation - revoir prix, date ou ville.';
    const recommendation = totalScore >= 75
      ? 'Oui, cet evenement a de fortes chances de succes. Continuez sur ce positionnement.'
      : totalScore >= 55
        ? 'Cet evenement a un bon potentiel. Renforcez la communication avant la date de lancement.'
        : totalScore >= 35
          ? 'Potentiel moyen. Ajustez le prix, l horaire ou la ville pour augmenter la demande.'
          : 'Potentiel faible. Revoir le ciblage et le positionnement avant publication.';

    return { score: totalScore, label, reason, recommendation, factors };
  }

  get weatherAdvice(): string {
    if (!this.formWeather) return 'Renseignez ville et date pour obtenir une recommandation meteo.';

    const temp = this.formWeather.temperature;
    const desc = (this.formWeather.description ?? '').toLowerCase();
    const title = this.form.title.toLowerCase();
    const category = this.selectedCategoryName().toLowerCase();
    const isOutdoor = ['plage', 'randonnee', 'quad', 'yoga', 'concert', 'festival', 'sailing', 'marathon']
      .some(k => title.includes(k) || category.includes(k));
    const hasRain = desc.includes('pluie') || desc.includes('rain') || desc.includes('orage');
    const hasWind = (this.formWeather.windSpeed ?? 0) > 10;

    if (isOutdoor) {
      if (hasRain) return 'Pluie prevue - evenement outdoor fortement deconseille. Prevoir un plan B indoor ou reporter.';
      if (temp > 36) return 'Canicule prevue - eviter 12h-16h, prevoir ombre et hydratation obligatoire.';
      if (temp < 12) return 'Froid - prevoir equipement chaud, envisager horaire de journee.';
      if (hasWind) return 'Vent fort - activites nautiques ou structures legeres deconseillees.';
      if (temp >= 20 && temp <= 30) return 'Meteo ideale pour un evenement outdoor - conditions favorables.';
      return 'Meteo acceptable - surveiller les previsions a J-2.';
    }

    if (hasRain) return 'Pluie prevue mais evenement indoor - impact meteo faible.';
    if (temp >= 18 && temp <= 28) return 'Meteo agreable - bon contexte pour attirer du public.';
    return 'Meteo neutre pour un evenement indoor.';
  }

  get formWeatherLabel(): string {
    if (!this.formWeather) return 'Aucune météo chargée';
    return `${this.formWeather.city} · ${this.formWeather.temperature}°C`;
  }

  get weatherSourceLabel(): string {
    if (!this.formWeather) return '';
    if (this.weatherSource === 'forecast') return 'Prévision à la date de l\'événement';
    return 'Météo actuelle (fallback ville)';
  }

  get weatherGlyph(): string {
    if (!this.formWeather) return '⛅';
    const icon = (this.formWeather.icon ?? '').toLowerCase();
    const description = (this.formWeather.description ?? '').toLowerCase();
    if (icon.includes('rain') || description.includes('pluie') || description.includes('rain')) return '🌧️';
    if (icon.includes('storm') || description.includes('orage')) return '⛈️';
    if (icon.includes('snow') || description.includes('neige')) return '❄️';
    if (icon.includes('sun') || description.includes('dégagé') || description.includes('clear')) return '☀️';
    return '☁️';
  }

  get canRunIntelligence(): boolean {
    return !!(
      this.form.type &&
      this.form.categoryId &&
      this.form.city.trim() &&
      this.form.address.trim() &&
      this.form.startDate
    );
  }

  get mapEmbedUrl(): SafeResourceUrl | null {
    if (this.form.latitude == null || this.form.longitude == null) return null;
    const lat = this.form.latitude;
    const lng = this.form.longitude;
    const d = 0.03;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  get geolocatedEventsCount(): number {
    return this.filteredMapEvents.filter(ev => this.getMapCoordinates(ev) !== null).length;
  }

  get filteredMapEvents(): EventActivity[] {
    if (this.mapFilter === 'ALL') return this.events;
    return this.events.filter(ev => ev.status === this.mapFilter);
  }

  get calendarMonthLabel(): string {
    return this.calendarAnchorDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  get calendarCells(): Array<{ date: Date | null; label: number | null; inMonth: boolean; isToday: boolean; isSelected: boolean; events: EventActivity[] }> {
    const year = this.calendarAnchorDate.getFullYear();
    const month = this.calendarAnchorDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = 42;
    const todayKey = this.toDateKey(new Date());
    const cells: Array<{ date: Date | null; label: number | null; inMonth: boolean; isToday: boolean; isSelected: boolean; events: EventActivity[] }> = [];

    for (let i = 0; i < totalCells; i += 1) {
      const dayIndex = i - startOffset + 1;
      if (dayIndex < 1 || dayIndex > daysInMonth) {
        cells.push({ date: null, label: null, inMonth: false, isToday: false, isSelected: false, events: [] });
        continue;
      }

      const date = new Date(year, month, dayIndex);
      const key = this.toDateKey(date);
      const events = this.eventsOnDate(key);
      cells.push({
        date,
        label: dayIndex,
        inMonth: true,
        isToday: key === todayKey,
        isSelected: key === this.calendarSelectedDateKey,
        events,
      });
    }

    return cells;
  }

  get calendarSelectedDateEvents(): EventActivity[] {
    return this.eventsOnDate(this.calendarSelectedDateKey);
  }

  get calendarSelectedDateLabel(): string {
    const selected = this.calendarCells.find(cell => cell.date && this.toDateKey(cell.date) === this.calendarSelectedDateKey)?.date;
    if (!selected) return 'Sélectionnez une date';
    return selected.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  get tunisiaPins(): Array<{ id: number; xPct: number; yPct: number; title: string; city: string; status: EventStatus }> {
    return this.events
      .map((event) => {
        const coords = this.getEventCoordinates(event);
        if (!coords) return null;
        const projected = this.projectTunisiaPoint(coords.lat, coords.lng);
        return {
          id: event.id,
          xPct: projected.xPct,
          yPct: projected.yPct,
          title: event.title,
          city: event.city,
          status: event.status,
        };
      })
        .filter((pin): pin is { id: number; xPct: number; yPct: number; title: string; city: string; status: EventStatus } => pin !== null);
  }

  highlightPin(id: number | null): void {
    this.highlightedId = id;
    this.hoveredPin = null;

    if (id === null) {
      this.leafletMarkers.forEach((marker, evId) => {
        const ev = this.events.find(item => item.id === evId);
        if (ev) marker.setIcon(this.createLeafletIcon(this.getMarkerColor(ev.status)));
      });
      return;
    }

    this.leafletMarkers.forEach((marker, evId) => {
      const ev = this.events.find(item => item.id === evId);
      if (!ev) return;
      marker.setIcon(
        evId === id
          ? this.createLeafletIconHighlighted(this.getMarkerColor(ev.status))
          : this.createLeafletIcon(this.getMarkerColor(ev.status)),
      );
    });
  }

  private loadOrganizerData(): void {
    this.loading = true;
    this.errorMsg = '';

    this.eventService.getMesEvents().subscribe({
      next: (events) => {
        this.events = [...events].sort(
          (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
        );
        this.notifyLatestCancellationReason();
        void this.resolveMissingCoordinates();
        this.loadReservationsPerEvent();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message ?? 'Impossible de charger vos evenements.';
      },
    });
  }

  private loadCategories(): void {
    this.eventService.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
        if (!this.form.categoryId && this.categoriesForType.length > 0) {
          this.form.categoryId = this.categoriesForType[0].id;
        }
      },
      error: () => {
        this.categories = [];
      },
    });
  }

  private loadReservationsPerEvent(): void {
    if (this.events.length === 0) {
      this.loading = false;
      this.allReservations = [];
      this.reservationsFiltrees = [];
      return;
    }

    let pending = this.events.length;
    for (const ev of this.events) {
      this.reservationService.getByEvent(ev.id).subscribe({
        next: (reservations) => {
          this.reservationsByEvent[ev.id] = reservations;
          pending -= 1;
          if (pending === 0) {
            this.loading = false;
            this.rebuildReservations();
          }
        },
        error: () => {
          this.reservationsByEvent[ev.id] = [];
          pending -= 1;
          if (pending === 0) {
            this.loading = false;
            this.rebuildReservations();
          }
        },
      });
    }
  }

  switchTab(tab: 'events' | 'create' | 'carte' | 'calendar' | 'reservations' | 'qr' | 'stats'): void {
    this.activeTab = tab;
    if (tab === 'reservations') {
      this.filtrerReservations();
    }
    if (tab !== 'qr') {
      this.scanResult = null;
      this.aiQrHint = '';
    }
    if (tab === 'carte') {
      setTimeout(() => this.initLeafletMap(), 80);
    } else {
      this.destroyLeafletMap();
    }
  }

  previousCalendarMonth(): void {
    this.calendarAnchorDate = new Date(this.calendarAnchorDate.getFullYear(), this.calendarAnchorDate.getMonth() - 1, 1);
    this.calendarSelectedDateKey = this.toDateKey(new Date(this.calendarAnchorDate.getFullYear(), this.calendarAnchorDate.getMonth(), 1));
  }

  nextCalendarMonth(): void {
    this.calendarAnchorDate = new Date(this.calendarAnchorDate.getFullYear(), this.calendarAnchorDate.getMonth() + 1, 1);
    this.calendarSelectedDateKey = this.toDateKey(new Date(this.calendarAnchorDate.getFullYear(), this.calendarAnchorDate.getMonth(), 1));
  }

  goToCurrentCalendarMonth(): void {
    const today = new Date();
    this.calendarAnchorDate = new Date(today.getFullYear(), today.getMonth(), 1);
    this.calendarSelectedDateKey = this.toDateKey(today);
  }

  selectCalendarDay(date: Date | null): void {
    if (!date) return;
    this.calendarSelectedDateKey = this.toDateKey(date);
  }

  private eventsOnDate(dateKey: string): EventActivity[] {
    return this.events
      .filter((event) => this.toDateKey(new Date(event.startDate)) === dateKey)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  private toDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  goFormStep(step: 1 | 2 | 3 | 4): void {
    if (step > this.formStep) {
      if (step >= 2 && !this.canGoStep2) {
        this.actionMsg = this.hasFakeContent
          ? '⚠️ Contenu factice détecté'
          : 'Complétez le titre, la description et la catégorie avant de continuer.';
        return;
      }
      if (step >= 3 && !this.canGoStep3) {
        this.actionMsg = 'Renseignez la ville, l\'adresse et les dates avant de continuer.';
        return;
      }
    }
    this.actionMsg = '';
    this.formStep = step;
    if (step === 4 && this.canRunIntelligence && !this.formWeather) {
      this.refreshWeatherAndInsights();
    }
  }

  private initLeafletMap(): void {
    const container = document.getElementById('organisateur-leaflet-map');
    if (!container || this.mapInitialized) return;

    const bounds: L.LatLngBoundsExpression = [
      [this.tunisiaBounds.minLat, this.tunisiaBounds.minLng],
      [this.tunisiaBounds.maxLat, this.tunisiaBounds.maxLng],
    ];

    this.mapInitialized = true;
    this.leafletMap = L.map(container, {
      center: [33.89, 9.54],
      zoom: 7,
      minZoom: 6,
      maxZoom: 13,
      zoomControl: true,
      attributionControl: false,
      maxBounds: bounds,
      maxBoundsViscosity: 1,
    });

    this.tunisiaOverlay = null;
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this.leafletMap);

    this.leafletMap.fitBounds(bounds, { padding: [20, 20] });
    this.renderLeafletMarkers();
    this.fitLeafletBounds();
  }

  private destroyLeafletMap(): void {
    if (!this.leafletMap) return;
    this.leafletMarkers.forEach(marker => marker.remove());
    this.leafletMarkers.clear();
    this.tunisiaOverlay = null;
    this.leafletMap.remove();
    this.leafletMap = null;
    this.mapInitialized = false;
  }

  private renderLeafletMarkers(): void {
    if (!this.leafletMap) return;

    this.leafletMarkers.forEach(marker => marker.remove());
    this.leafletMarkers.clear();

    for (const ev of this.filteredMapEvents) {
      const coords = this.getMapCoordinates(ev);
      if (!coords) continue;

      const marker = L.marker([coords.lat, coords.lng], {
        icon: this.createLeafletIcon(this.getMarkerColor(ev.status)),
      }).addTo(this.leafletMap);

      const popupHtml = `
        <div style="font-family:'Segoe UI',sans-serif;padding:12px 14px;min-width:220px;">
          <div style="font-size:14px;font-weight:700;color:#0e2848;margin-bottom:4px;">${ev.title}</div>
          <div style="font-size:12px;color:#5d7187;margin-bottom:8px;">${ev.city}${ev.address ? ' - ' + ev.address : ''}</div>
          <div style="display:flex;gap:10px;font-size:12px;color:#4d6075;">
            <span><strong>${this.getEventConfirmedCount(ev.id)}</strong> conf.</span>
            <span><strong>${this.getEventReservationsCount(ev.id)}</strong> res.</span>
            <span><strong>${this.getEventRevenue(ev.id).toLocaleString('fr-TN')}</strong> TND</span>
          </div>
          <button data-go-to-event="${ev.id}" style="margin-top:10px;width:100%;padding:8px;border:none;border-radius:8px;background:linear-gradient(135deg,#005ea8,#0093c9);color:#fff;font-weight:700;cursor:pointer;">
            Voir la fiche
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 280 });

      marker.on('mouseover', () => {
        this.highlightPin(ev.id);
        marker.openPopup();
        this.cdr.detectChanges();
      });
      marker.on('mouseout', () => {
        this.highlightPin(null);
        this.cdr.detectChanges();
      });
      marker.on('popupopen', () => {
        const btn = document.querySelector(`button[data-go-to-event="${ev.id}"]`) as HTMLButtonElement | null;
        if (btn) {
          btn.onclick = () => {
            void this.router.navigate(['/events', ev.id], { queryParams: { source: 'organisateur' } });
          };
        }
      });

      this.leafletMarkers.set(ev.id, marker);
    }
  }

  private fitLeafletBounds(): void {
    if (!this.leafletMap || this.leafletMarkers.size === 0) return;
    const group = L.featureGroup(Array.from(this.leafletMarkers.values()));
    this.leafletMap.fitBounds(group.getBounds().pad(0.15));
  }

  private createLeafletIcon(color: string): L.DivIcon {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
        <path d="M16 3C10.477 3 6 7.477 6 13c0 8.5 10 22 10 22s10-13.5 10-22c0-5.523-4.477-10-10-10z"
          fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="13" r="4.5" fill="white" opacity="0.95"/>
      </svg>`;
    return L.divIcon({
      html: svg,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -42],
      className: '',
    });
  }

  private createLeafletIconHighlighted(color: string): L.DivIcon {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
        <path d="M20 3C13.373 3 8 8.373 8 15c0 10 12 27 12 27s12-17 12-27C32 8.373 26.627 3 20 3z"
          fill="${color}" stroke="white" stroke-width="2.5"/>
        <circle cx="20" cy="15" r="5.5" fill="white" opacity="0.95"/>
      </svg>`;
    return L.divIcon({
      html: svg,
      iconSize: [40, 52],
      iconAnchor: [20, 52],
      popupAnchor: [0, -50],
      className: '',
    });
  }

  private getMarkerColor(status: EventStatus): string {
    if (status === 'PUBLISHED') return '#1a8a5a';
    if (status === 'DRAFT') return '#d97706';
    return '#dc2626';
  }

  setMapFilter(filter: 'ALL' | 'PUBLISHED' | 'DRAFT'): void {
    this.mapFilter = filter;
    this.renderLeafletMarkers();
    this.fitLeafletBounds();
  }

  onMapListItemClick(ev: EventActivity): void {
    const coords = this.getMapCoordinates(ev);
    if (coords && this.leafletMap) {
      this.leafletMap.setView([coords.lat, coords.lng], 12, { animate: true });
    }
    const marker = this.leafletMarkers.get(ev.id);
    if (marker) marker.openPopup();
    this.highlightPin(ev.id);
    this.cdr.detectChanges();
  }

  private rebuildReservations(): void {
    this.allReservations = Object.values(this.reservationsByEvent)
      .flat()
      .sort((a, b) => new Date(b.reservationDate).getTime() - new Date(a.reservationDate).getTime());
    this.filtrerReservations();
  }

  filtrerReservations(): void {
    this.reservationsFiltrees = this.allReservations.filter((r) => {
      const okStatus = !this.filtreStatutReservation || r.status === this.filtreStatutReservation;
      const okEvent = !this.filtreEventId || r.eventId === Number(this.filtreEventId);
      const okQr = !this.filtreQrReservation
        || (this.filtreQrReservation === 'USED' ? !!r.qrUsed : !r.qrUsed);
      return okStatus && okEvent && okQr;
    });
  }

  clearFilters(): void {
    this.filtreStatutReservation = '';
    this.filtreEventId = '';
    this.filtreQrReservation = '';
    this.filtrerReservations();
  }

  clearEventQuickFilters(): void {
    this.eventQuickSearch = '';
    this.eventQuickStatus = 'ALL';
    this.eventQuickDate = '';
  }

  goToEvent(id: number): void {
    void this.router.navigate(['/events', id], { queryParams: { source: 'organisateur' } });
  }

  goToTicket(id: number): void {
    void this.router.navigate(['/ticket', id]);
  }

  getEventReservationsCount(eventId: number): number {
    return this.reservationsByEvent[eventId]?.length ?? 0;
  }

  getEventConfirmedCount(eventId: number): number {
    return (this.reservationsByEvent[eventId] ?? []).filter(r => r.status === 'CONFIRMED').length;
  }

  getEventRevenue(eventId: number): number {
    return (this.reservationsByEvent[eventId] ?? [])
      .filter(r => r.status === 'CONFIRMED')
      .reduce((sum, r) => sum + r.totalPrice, 0);
  }

  get canSubmit(): boolean {
    return !!(
      this.form.title.trim() &&
      this.form.description.trim() &&
      this.titleRealLength >= OrganisateurPageComponent.MIN_TITLE_REAL_LENGTH &&
      this.descriptionRealLength >= OrganisateurPageComponent.MIN_DESCRIPTION_REAL_LENGTH &&
      !this.hasFakeContent &&
      this.form.city.trim() &&
      this.form.address.trim() &&
      this.form.startDate &&
      this.form.endDate &&
      this.form.capacity > 0 &&
      this.form.price > 0 &&
      this.form.categoryId
    );
  }

  setType(type: EventType): void {
    if (this.form.type === type) return;
    this.form.type = type;
    const choices = this.categoriesForType;
    this.form.categoryId = choices.length > 0 ? choices[0].id : 0;
    this.scheduleAiPriceSuggestion();
    this.refreshWeatherAndInsights();
  }

  onFormTextChange(): void {
    this.scheduleAiPriceSuggestion();
  }

  onStartDateChange(): void {
    this.scheduleAiPriceSuggestion();
    this.checkDateAvailability();
  }

  onLocationInputChange(): void {
    this.scheduleAiPriceSuggestion();
  }

  private checkDateAvailability(): void {
    if (!this.form.startDate) {
      this.dateAvailability = null;
      return;
    }

    const isoDate = this.form.startDate.slice(0, 10);
    if (!isoDate || isoDate.length !== 10) {
      this.dateAvailability = null;
      return;
    }

    this.eventService.checkDateAvailability(isoDate).subscribe({
      next: (result) => {
        this.dateAvailability = result;
        if ((result?.eventsCount ?? 0) > 0) {
          const suggestedDateTime = this.buildSuggestedDateTime(result.suggestions ?? []);
          const recommendation = suggestedDateTime
            ? `Nous recommandons de faire l'événement par exemple le ${suggestedDateTime} (date encore vide).`
            : 'Nous recommandons de choisir une autre date ou un autre horaire pour éviter la concurrence.';
          this.dateAvailabilityNotice = `${result.eventsCount} événement(s) déjà prévu(s) ce jour. ${recommendation}`;
        } else {
          this.dateAvailabilityNotice = '';
        }
      },
      error: () => {
        this.dateAvailability = null;
        this.dateAvailabilityNotice = '';
      }
    });
  }

  private buildSuggestedDateTime(suggestions: string[]): string {
    if (!suggestions || suggestions.length === 0) return '';
    const firstDate = suggestions[0];
    const source = this.form.startDate ? new Date(this.form.startDate) : new Date();
    const hh = String(source.getHours()).padStart(2, '0');
    const mm = String(source.getMinutes()).padStart(2, '0');
    const displayDate = new Date(`${firstDate}T00:00:00`).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `${displayDate} à ${hh}:${mm}`;
  }

  private notifyLatestCancellationReason(): void {
    const latestCancelled = [...this.events]
      .filter(ev => ev.status === 'CANCELLED' && !!ev.cancellationReason)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

    if (!latestCancelled) return;

    const storageKey = `organizer.cancel.reason.seen.${this.organizerEmail}`;
    const seenValue = localStorage.getItem(storageKey);
    const marker = `${latestCancelled.id}-${latestCancelled.updatedAt}`;
    if (seenValue === marker) return;

    this.actionMsg = `ℹ️ L'admin a annulé "${latestCancelled.title}". Motif: ${latestCancelled.cancellationReason}`;
    localStorage.setItem(storageKey, marker);
  }

  onManualPriceChange(): void {
    this.priceAutoManaged = false;
    this.aiPriceSuggestion = null;
    this.priceAiError = '';
  }

  onPromoTypeChange(): void {
    if (this.form.promoType === 'NONE') {
      this.form.promoPercent = null;
      this.form.promoCode = null;
      this.form.promoStartDate = null;
      this.form.promoEndDate = null;
      return;
    }

    if (this.form.promoType === 'WEEKEND' && (!this.form.promoPercent || this.form.promoPercent <= 0)) {
      this.form.promoPercent = 5;
    }
  }

  private realTextLength(value: string): number {
    return value.replace(/\s+/g, ' ').trim().replace(/[^\p{L}\p{N}]/gu, '').length;
  }

  get suggestedPriceInfo(): PriceSuggestionResponse | null {
    if (!this.isPriceAutoFillable()) {
      return null;
    }

    return this.aiPriceSuggestion;
  }

  private scheduleAiPriceSuggestion(): void {
    if (!this.priceAutoManaged) {
      return;
    }

    if (this.priceSuggestionTimer) {
      clearTimeout(this.priceSuggestionTimer);
    }

    this.priceSuggestionTimer = setTimeout(() => void this.requestAiPriceSuggestion(), 450);
  }

  private isPriceAutoFillable(): boolean {
    return !!(
      this.titleRealLength >= OrganisateurPageComponent.MIN_TITLE_REAL_LENGTH &&
      this.descriptionRealLength >= OrganisateurPageComponent.MIN_DESCRIPTION_REAL_LENGTH &&
      this.form.city.trim() &&
      this.form.address.trim()
    );
  }

  private async requestAiPriceSuggestion(): Promise<void> {
    if (!this.isPriceAutoFillable() || !this.priceAutoManaged) {
      this.priceAiError = '';
      this.aiPriceSuggestion = null;
      return;
    }

    const payload = {
      title: this.form.title.trim(),
      description: this.form.description.trim(),
      type: this.form.type,
      categoryName: this.selectedCategoryName(),
      city: this.form.city.trim(),
      address: this.form.address.trim(),
      capacity: this.form.capacity,
      startDate: this.form.startDate || undefined,
      endDate: this.form.endDate || undefined,
    };
    const requestKey = JSON.stringify(payload);

    if (requestKey === this.priceSuggestionRequestKey && this.aiPriceSuggestion) {
      return;
    }

    this.priceSuggestionRequestKey = requestKey;
    this.priceAiLoading = true;
    this.priceAiError = '';

    try {
      const suggestion = await firstValueFrom(this.eventAiAssistantService.suggestPrice(payload));
      this.aiPriceSuggestion = suggestion;
      if (suggestion.price == null) {
        const fallback = this.buildLocalPriceSuggestion();
        this.form.price = fallback.price ?? 0;
        this.aiPriceSuggestion = fallback;
        this.priceAiError = '';
        return;
      }
      this.form.price = suggestion.price;
      this.priceAiError = '';
      this.priceAutoManaged = true;
    } catch {
      const fallback = this.buildLocalPriceSuggestion();
      this.aiPriceSuggestion = fallback;
      this.form.price = fallback.price ?? 0;
      this.priceAiError = '';
    } finally {
      this.priceAiLoading = false;
      this.cdr.detectChanges();
    }
  }

  private buildLocalPriceSuggestion(): PriceSuggestionResponse {
    const text = `${this.form.title} ${this.form.description} ${this.selectedCategoryName()} ${this.form.city} ${this.form.address}`.toLowerCase();
    let price = this.form.type === 'ACTIVITY' ? 35 : 55;

    const keywords: Array<[RegExp, number]> = [
      [/festival|concert|spectacle|show|music|jazz|art|culture/, 32],
      [/atelier|workshop|formation|masterclass|conférence|conference|startup|business/, 20],
      [/plage|mer|nautique|surf|plong|bateau|yacht/, 28],
      [/randon|trek|nature|quad|sahara|aventure|desert/, 24],
      [/famille|enfant|kids|group|team/, 10],
      [/luxe|vip|premium|gala|soirée|soiree/, 42],
    ];

    for (const [pattern, bonus] of keywords) {
      if (pattern.test(text)) {
        price += bonus;
      }
    }

    if (this.form.type === 'ACTIVITY') {
      price -= 5;
    }

    const category = this.selectedCategoryName().toLowerCase();
    if (category.includes('festival') || category.includes('concert') || category.includes('culture')) {
      price += 10;
    }

    if (this.form.capacity >= 150) {
      price += 15;
    } else if (this.form.capacity >= 80) {
      price += 10;
    } else if (this.form.capacity <= 30) {
      price -= 5;
    }

    const city = this.form.city.trim().toLowerCase();
    if (['tunis', 'sousse', 'hammamet', 'djerba', 'monastir', 'sfax', 'nabeul'].some(item => city.includes(item))) {
      price += 8;
    }

    // Variation deterministe par event (evite des prix repetitifs comme 50 pour tous)
    const signature = `${this.form.title}|${this.form.city}|${this.form.address}|${this.form.startDate}|${this.form.capacity}`;
    let hash = 0;
    for (let i = 0; i < signature.length; i++) {
      hash = ((hash << 5) - hash) + signature.charCodeAt(i);
      hash |= 0;
    }
    price += Math.abs(hash % 11) - 5;

    const start = this.form.startDate ? new Date(this.form.startDate) : null;
    if (start) {
      const day = start.getDay();
      const month = start.getMonth() + 1;
      if (day === 5 || day === 6) price += 8;
      if (month >= 5 && month <= 9 && /plage|mer|nautique|surf|plong|bateau/.test(text)) price += 10;
      if ((month >= 3 && month <= 5) || (month >= 9 && month <= 11)) price += 5;
    }

    const rounded = Math.round(price / 5) * 5;
    const finalPrice = Math.max(0, Math.min(250, rounded));
    return {
      price: finalPrice,
      label: finalPrice >= 120 ? 'Premium' : finalPrice >= 70 ? 'Standard' : 'Accessible',
      rationale: `Estimation locale basée sur ${this.selectedCategoryName() || 'la catégorie'}${this.form.city.trim() ? ` · ${this.form.city.trim()}` : ''}`,
      aiUsed: false,
    };
  }

  startCreate(): void {
    this.actionMsg = '';
    this.formMode = 'create';
    this.editingId = null;
    this.formStep = 1;
    this.activeTab = 'create';
    this.closeFormMapPicker();
    this.form = this.createEmptyForm();
    this.priceAutoManaged = true;
    this.aiPriceSuggestion = null;
    this.priceAiError = '';
    this.priceSuggestionRequestKey = '';
    this.dateAvailability = null;
    if (this.categoriesForType.length > 0) {
      this.form.categoryId = this.categoriesForType[0].id;
    }
    this.formWeather = null;
    this.localImagePreview = '';
  }

  startEdit(ev: EventActivity): void {
    if (!this.canEditEvent(ev)) {
      this.actionMsg = 'Seuls les evenements en statut DRAFT peuvent etre modifies. Creez un nouvel evenement (brouillon) si besoin.';
      return;
    }
    if (ev.status === 'CANCELLED') {
      this.actionMsg = 'Les evenements annules ne peuvent pas etre modifies.';
      return;
    }
    this.actionMsg = '';
    this.formMode = 'edit';
    this.editingId = ev.id;
    this.formStep = 1;
    this.activeTab = 'create';
    this.closeFormMapPicker();
    this.form = {
      title: ev.title,
      description: ev.description,
      price: ev.price,
      capacity: ev.capacity,
      startDate: this.toDateTimeLocal(ev.startDate),
      endDate: this.toDateTimeLocal(ev.endDate),
      city: ev.city,
      address: ev.address,
      latitude: ev.latitude,
      longitude: ev.longitude,
      imageUrl: ev.imageUrl,
      type: ev.type,
      categoryId: ev.categoryId,
      promoType: ev.promoType ?? 'NONE',
      promoPercent: ev.promoPercent ?? null,
      promoCode: ev.promoCode ?? null,
      promoStartDate: ev.promoStartDate ? this.toDateTimeLocal(ev.promoStartDate) : null,
      promoEndDate: ev.promoEndDate ? this.toDateTimeLocal(ev.promoEndDate) : null,
    };
    this.priceAutoManaged = false;
    this.aiPriceSuggestion = null;
    this.priceAiError = '';
    this.localImagePreview = ev.imageUrl ?? '';
    this.checkDateAvailability();
    this.refreshWeatherAndInsights();
  }

  canEditEvent(ev: EventActivity): boolean {
    return ev.status === 'DRAFT' || ev.status === 'REJECTED';
  }

  async saveEvent(): Promise<void> {
    if (!this.canSubmit) {
      if (this.titleRealLength < OrganisateurPageComponent.MIN_TITLE_REAL_LENGTH) {
        this.actionMsg = 'Le titre doit contenir au moins 15 caractères réels.';
      } else if (this.descriptionRealLength < OrganisateurPageComponent.MIN_DESCRIPTION_REAL_LENGTH) {
        this.actionMsg = 'La description doit contenir au moins 20 caractères réels.';
      } else if (this.hasFakeContent) {
        this.actionMsg = '⚠️ Contenu factice détecté';
      } else if (this.form.price <= 0) {
        this.actionMsg = 'Le prix doit être supérieur à 0 TND.';
      } else {
        this.actionMsg = 'Complétez tous les champs requis.';
      }
      return;
    }

    this.saving = true;
    this.actionMsg = '';
    let geocodeMissing = false;

    const lat = this.parseCoordinate(this.form.latitude);
    const lng = this.parseCoordinate(this.form.longitude);
    const hasValidCoords = lat != null && lng != null && this.isWithinTunisiaBounds(lat, lng);

    if (!hasValidCoords) {
      this.form.latitude = null;
      this.form.longitude = null;
      const resolved = await this.resolveFormCoordinates(false);
      geocodeMissing = !resolved;
    }

    const payload: EventActivityRequest = {
      ...this.form,
      title: this.form.title.trim(),
      description: this.form.description.trim(),
      city: this.form.city.trim(),
      address: this.form.address.trim(),
      imageUrl: this.form.imageUrl?.trim() || null,
      startDate: this.normalizeDate(this.form.startDate),
      endDate: this.normalizeDate(this.form.endDate),
      promoType: this.form.promoType ?? 'NONE',
      promoPercent: (this.form.promoPercent ?? 0) > 0 ? this.form.promoPercent ?? null : null,
      promoCode: this.form.promoCode?.trim() || null,
      promoStartDate: this.form.promoStartDate ? this.normalizeDate(this.form.promoStartDate) : null,
      promoEndDate: this.form.promoEndDate ? this.normalizeDate(this.form.promoEndDate) : null,
    };

    const req = this.formMode === 'create'
      ? this.eventService.create(payload)
      : this.eventService.update(this.editingId as number, payload);

    req.subscribe({
      next: (saved) => {
        this.saving = false;
        const moderation = saved?.status === 'PUBLISHED'
          ? '✅ Événement publié avec succès.'
          : saved?.status === 'REJECTED'
            ? `❌ Événement rejeté automatiquement: ${saved?.moderationReason ?? 'raison indisponible'}`
            : 'Événement enregistré.';

        this.actionMsg = this.formMode === 'create'
          ? (geocodeMissing
              ? `${moderation} Localisation introuvable: vérifiez adresse/ville.`
              : moderation)
          : (geocodeMissing
              ? `Mise à jour enregistrée. ${moderation} Localisation introuvable: vérifiez adresse/ville.`
              : `Mise à jour enregistrée. ${moderation}`);

        this.startCreate();
        this.activeTab = 'events';
        this.loadOrganizerData();
      },
      error: (err) => {
        this.saving = false;
        this.actionMsg = this.extractSaveErrorMessage(err);
      },
    });
  }

  private extractSaveErrorMessage(err: unknown): string {
    const fallback = 'Operation impossible.';
    const e = err as {
      error?: {
        message?: string;
        data?: Record<string, string>;
      };
      message?: string;
    };

    const fieldErrors = e?.error?.data;
    if (fieldErrors && typeof fieldErrors === 'object') {
      const detail = Object.entries(fieldErrors)
        .map(([field, message]) => `${field}: ${message}`)
        .join(' | ');
      if (detail.trim()) {
        return detail;
      }
    }

    return e?.error?.message ?? e?.message ?? fallback;
  }

  cancelEvent(ev: EventActivity): void {
    const now = new Date();
    const start = new Date(ev.startDate);
    const hoursLeft = (start.getTime() - now.getTime()) / 3600000;

    if (!this.canCancelEvent(ev)) {
      this.cancelBlockedTitle = 'Annulation indisponible';
      if (start.getTime() <= now.getTime()) {
        this.cancelBlockedMessage = `L'événement ${ev.title} est déjà commencé ou terminé. L'annulation n'est plus disponible.`;
      } else {
        const hours = Math.max(0, Math.ceil(hoursLeft));
        this.cancelBlockedMessage = `L'événement ${ev.title} commence dans ${hours}h. L'annulation est verrouillée à moins de 24h du début.`;
      }
      this.showCancelBlockedModal = true;
      return;
    }

    // Bloquer l'annulation dans les 24h avant le debut.
    if (hoursLeft <= 24) {
      const hours = Math.max(0, Math.ceil(hoursLeft));
      this.cancelBlockedTitle = 'Annulation non autorisee';
      this.cancelBlockedMessage = `L'événement ${ev.title} commence dans ${hours}h. L'annulation est desactivée à moins de 24h du début.`;
      this.showCancelBlockedModal = true;
      return;
    }

    this.confirmTitle = ev.title;
    this.confirmMessage = `${ev.city} · ${new Date(ev.startDate).toLocaleDateString('fr-FR')}`;
    this.confirmEventId = ev.id;
    this.confirmCancellationReason = '';
    this.confirmCancellationRisk = this.estimateEventCancellationRisk(ev);
    this.confirmAction = (reason: string) => this.cancelEventConfirmed(ev.id, reason);
    this.showConfirm = true;
  }

  private estimateEventCancellationRisk(ev: EventActivity): { score: number; label: string; reason: string } {
  const now = new Date();
  const start = new Date(ev.startDate);
  const hoursLeft = (start.getTime() - now.getTime()) / 3600000;
  const daysLeft = hoursLeft / 24;

  const confirmed = this.getEventConfirmedCount(ev.id);
  const revenue = this.getEventRevenue(ev.id);

  let score = 0;

  // 1. Proximité date — toujours présent même sans clients
  if (hoursLeft <= 48)     score += 35;
  else if (daysLeft <= 7)  score += 22;
  else if (daysLeft <= 14) score += 14;
  else if (daysLeft <= 30) score += 8;
  else                     score += 3;

  // 2. Clients ayant payé
  if (confirmed >= 50)      score += 40;
  else if (confirmed >= 20) score += 30;
  else if (confirmed >= 10) score += 20;
  else if (confirmed >= 5)  score += 12;
  else if (confirmed >= 1)  score += 6;

  // 3. Revenu encaissé
  if (revenue >= 5000)      score += 25;
  else if (revenue >= 2000) score += 18;
  else if (revenue >= 500)  score += 12;
  else if (revenue >= 100)  score += 6;

  score = Math.max(5, Math.min(100, Math.round(score)));

  const label = score >= 65 ? 'Élevé' : score >= 35 ? 'Modéré' : 'Faible';

  let reason = '';
  if (hoursLeft <= 48) {
    reason = `Événement dans moins de 48h — annulation très tardive et impactante.`;
  } else if (confirmed >= 1) {
    reason = `${confirmed} client(s) ont payé (${revenue.toLocaleString('fr-TN')} TND encaissés).`;
  } else if (daysLeft <= 7) {
    reason = `Événement dans ${Math.round(daysLeft)} jours — annulation tardive même sans réservations.`;
  } else {
    reason = `Aucun client confirmé — impact client minimal mais coûts organisateur engagés.`;
  }

  return { score, label, reason };
}

  canCancelEvent(ev: EventActivity): boolean {
    if (ev.status !== 'PUBLISHED') return false;
    const now = new Date();
    const start = new Date(ev.startDate);
    const hoursLeft = (start.getTime() - now.getTime()) / 3600000;
    return hoursLeft > 24;
  }

  private cancelEventConfirmed(eventId: number, reason: string): void {
    this.eventService.cancel(eventId, reason).subscribe({
      next: () => {
        this.actionMsg = 'Evenement annule. Les clients seront informes selon votre backend.';
        this.loadOrganizerData();
      },
      error: (err) => {
        this.actionMsg = err?.error?.message ?? 'Annulation impossible.';
      },
    });
  }

  cancelConfirm(): void {
    this.showConfirm = false;
    this.confirmEventId = null;
    this.confirmCancellationReason = '';
    this.confirmCancellationRisk = { score: 0, label: '', reason: '' };
    this.confirmAction = null;
  }

  closeCancelBlockedModal(): void {
    this.showCancelBlockedModal = false;
    this.cancelBlockedTitle = '';
    this.cancelBlockedMessage = '';
  }

  executeConfirm(): void {
    const reason = this.confirmCancellationReason.trim();
    if (reason.length < 10) {
      this.actionMsg = "Motif d'annulation obligatoire (minimum 10 caracteres).";
      return;
    }

    const action = this.confirmAction;
    this.cancelConfirm();
    if (action) action(reason);
  }

  statusClass(status: string): string {
    if (status === 'PUBLISHED') return 'st-pub';
    if (status === 'DRAFT') return 'st-draft';
    if (status === 'REJECTED') return 'st-rej';
    return 'st-cancel';
  }

  refreshWeatherAndInsights(): void {
    if (!this.canRunIntelligence) {
      this.formWeather = null;
      this.weatherForecastTime = null;
      this.weatherSource = null;
      return;
    }

    const city = this.form.city.trim();
    if (!city) {
      this.formWeather = null;
      this.weatherForecastTime = null;
      this.weatherSource = null;
      return;
    }

    this.weatherLoading = true;
    const lat = this.parseCoordinate(this.form.latitude);
    const lng = this.parseCoordinate(this.form.longitude);
    const canUseForecast = lat != null && lng != null && this.isWithinTunisiaBounds(lat, lng) && !!this.form.startDate;

    if (canUseForecast) {
      this.weatherService.getForecastByCoordsAtDate(lat, lng, this.form.startDate).subscribe({
        next: (weather: ForecastWeatherInfo) => {
          this.formWeather = weather;
          this.weatherForecastTime = weather.forecastTime;
          this.weatherSource = 'forecast';
          this.weatherLoading = false;
        },
        error: () => {
          this.loadCurrentWeatherFallback(city);
        },
      });
      return;
    }

    this.loadCurrentWeatherFallback(city);
  }

  private loadCurrentWeatherFallback(city: string): void {
    this.eventService.getWeatherByCity(city).subscribe({
      next: (weather) => {
        this.formWeather = weather;
        this.weatherForecastTime = null;
        this.weatherSource = 'current';
        this.weatherLoading = false;
      },
      error: () => {
        this.formWeather = null;
        this.weatherForecastTime = null;
        this.weatherSource = null;
        this.weatherLoading = false;
      },
    });
  }

  async geocodeAddress(): Promise<void> {
    const ok = await this.resolveFormCoordinates(true);
    if (!ok) {
      this.actionMsg = 'Localisation introuvable. Verifiez ville/adresse.';
    } else if (this.showFormMapPicker) {
      this.placeFormPickerMarker(this.form.latitude, this.form.longitude, true);
    }
    this.refreshWeatherAndInsights();
    this.scheduleAiPriceSuggestion();
  }

  openFormMapPicker(): void {
    this.showFormMapPicker = true;
    setTimeout(() => this.initFormPickerMap(), 60);
  }

  closeFormMapPicker(): void {
    this.showFormMapPicker = false;
    this.destroyFormPickerMap();
  }

  private initFormPickerMap(): void {
    const container = document.getElementById('organisateur-form-map-picker');
    if (!container || !this.showFormMapPicker) return;

    const bounds: L.LatLngBoundsExpression = [
      [this.tunisiaBounds.minLat, this.tunisiaBounds.minLng],
      [this.tunisiaBounds.maxLat, this.tunisiaBounds.maxLng],
    ];

    if (!this.formPickerMap) {
      this.formPickerMap = L.map(container, {
        center: [33.89, 9.54],
        zoom: 7,
        minZoom: 6,
        maxZoom: 13,
        zoomControl: true,
        attributionControl: false,
        maxBounds: bounds,
        maxBoundsViscosity: 1,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(this.formPickerMap);

      this.formPickerMap.on('click', (e: L.LeafletMouseEvent) => {
        this.form.latitude = Number(e.latlng.lat.toFixed(6));
        this.form.longitude = Number(e.latlng.lng.toFixed(6));
        this.placeFormPickerMarker(this.form.latitude, this.form.longitude, false);
        this.actionMsg = '';
      });
    } else {
      this.formPickerMap.invalidateSize();
    }

    const lat = this.parseCoordinate(this.form.latitude);
    const lng = this.parseCoordinate(this.form.longitude);
    if (lat != null && lng != null && this.isWithinTunisiaBounds(lat, lng)) {
      this.placeFormPickerMarker(lat, lng, true);
    } else {
      this.formPickerMap.fitBounds(bounds, { padding: [12, 12] });
    }
  }

  private placeFormPickerMarker(lat: number | null, lng: number | null, centerMap: boolean): void {
    if (!this.formPickerMap || lat == null || lng == null) return;

    if (!this.formPickerMarker) {
      this.formPickerMarker = L.marker([lat, lng], { draggable: true }).addTo(this.formPickerMap);
      this.formPickerMarker.on('dragend', () => {
        const p = this.formPickerMarker?.getLatLng();
        if (!p) return;
        this.form.latitude = Number(p.lat.toFixed(6));
        this.form.longitude = Number(p.lng.toFixed(6));
      });
    } else {
      this.formPickerMarker.setLatLng([lat, lng]);
    }

    if (centerMap) {
      this.formPickerMap.setView([lat, lng], Math.max(this.formPickerMap.getZoom(), 10), { animate: true });
    }
  }

  private destroyFormPickerMap(): void {
    if (this.formPickerMarker) {
      this.formPickerMarker.remove();
      this.formPickerMarker = null;
    }
    if (this.formPickerMap) {
      this.formPickerMap.remove();
      this.formPickerMap = null;
    }
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? '');
      this.localImagePreview = value;
      // Use data URL when backend accepts it; otherwise organizer can replace by hosted URL.
      this.form.imageUrl = value;
    };
    reader.readAsDataURL(file);
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  onImageUrlChange(): void {
    if (this.form.imageUrl && !this.form.imageUrl.startsWith('data:')) {
      this.localImagePreview = '';
    }
  }

  selectedCategoryName(): string {
    const category = this.categories.find(c => c.id === this.form.categoryId);
    return category?.name ?? '';
  }

 async validateFromPayload(): Promise<void> {
    const payload = this.qrPayload.trim();
    if (!payload) {
        this.scanResult = { valid: false, message: 'QR non détecté. Relancez le scan caméra.' };
        return;
    }

    this.validating = true;
    this.scanResult = null;
    this.aiQrHint = 'Validation en cours...';

    try {
        const ticketCode = this.extractTicketCode(payload);

        if (ticketCode) {
          this.scanResult = await firstValueFrom(this.reservationService.scanTicketByCode(ticketCode));
        } else {
          const id = this.extractReservationId(payload);
          if (!id) {
            this.scanResult = {
              valid: false,
              message: 'QR invalide. Format attendu: /ticket/{id}?code=EVT-...'
            };
            this.aiQrHint = 'QR non reconnu.';
            return;
          }
          this.scanResult = await firstValueFrom(this.reservationService.scanQr(id));
        }

        this.aiQrHint = '';

        if (this.scanResult.valid) this.loadOrganizerData();

    } catch (err: unknown) {
        const error = err as { error?: { message?: string } };
        this.scanResult = {
            valid: false,
            message: error?.error?.message ?? 'Erreur lors de la validation du QR.',
        };
        this.aiQrHint = 'Erreur de validation côté serveur.';
    } finally {
        this.validating = false;
    }
}

  async startAiQrCamera(): Promise<void> {
    if (!this.cameraSupported || this.cameraScanning) return;

    try {
      this.aiQrHint = 'Demande d\'accès caméra...';
      this.scanResult = null;
      this.qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      this.cameraScanning = true;

      setTimeout(() => {
        const video = this.qrVideo?.nativeElement;
        if (!video || !this.qrStream) return;
        video.srcObject = this.qrStream;
        video.play().catch(() => undefined);
        this.aiQrHint = 'Caméra prête - montrez le code QR';
        this.runAiQrDetectionLoop();
      }, 60);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Caméra non disponible';
      this.aiQrHint = `❌ Caméra inaccessible. Détail: ${msg}.`;
      this.stopAiQrCamera();
    }
  }

  stopAiQrCamera(): void {
    this.cameraScanning = false;
    if (this.qrScanLoopHandle != null) {
      cancelAnimationFrame(this.qrScanLoopHandle);
      this.qrScanLoopHandle = null;
    }
    if (this.qrStream) {
      this.qrStream.getTracks().forEach(track => track.stop());
      this.qrStream = null;
    }
    const video = this.qrVideo?.nativeElement;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }

  private runAiQrDetectionLoop(): void {
    const DetectorCtor = (window as unknown as { 
        BarcodeDetector?: new (options?: { formats?: string[] }) => { 
            detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> 
        } 
    }).BarcodeDetector;
    
    if (!this.cameraScanning) return;

    const video = this.qrVideo?.nativeElement;
    if (!video) return;

    const tick = async () => {
        if (!this.cameraScanning) return;
        try {
            let raw = '';
            if (DetectorCtor) {
                const detector = new DetectorCtor({ formats: ['qr_code'] });
                const codes = await detector.detect(video);
                raw = codes?.[0]?.rawValue?.trim() ?? '';
            } else {
                raw = this.detectQrWithJsQr(video) ?? '';
                if (!raw) {
                this.aiQrHint = 'Scan en cours... rapprochez le QR et améliorez la luminosité.';
                }
            }

            // ← LE IF MANQUAIT ICI !
            if (raw && raw.length > 3) {
                this.qrPayload = raw;
                this.aiQrHint = '✅ QR détecté, validation en cours...';
                this.stopAiQrCamera();
                await this.validateFromPayload();
                return;
            }

        } catch {
          this.aiQrHint = 'Scan en cours... ajustez la luminosité et gardez le QR stable.';
        }
        this.qrScanLoopHandle = requestAnimationFrame(() => { void tick(); });
    };

    void tick();
}
  private detectQrWithJsQr(video: HTMLVideoElement): string | null {
    const canvas = this.qrCanvas?.nativeElement;
    if (!canvas) return null;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);
    const frame = ctx.getImageData(0, 0, width, height);
    const code = jsQR(frame.data, width, height, { inversionAttempts: 'dontInvert' });
    return code?.data?.trim() || null;
  }

  private extractTicketCode(payload: string): string | null {
    try {
      const parsedUrl = new URL(payload);
      const candidateFromQuery =
        parsedUrl.searchParams.get('code')
        ?? parsedUrl.searchParams.get('ticketCode')
        ?? parsedUrl.searchParams.get('ticket')
        ?? parsedUrl.searchParams.get('qr');
      if (candidateFromQuery && candidateFromQuery.trim().length > 0) {
        return decodeURIComponent(candidateFromQuery.trim());
      }

      const pathCodeMatch = parsedUrl.pathname.match(/\/scan\/([^/?#]+)/i);
      if (pathCodeMatch?.[1]) {
        return decodeURIComponent(pathCodeMatch[1]).trim();
      }
    } catch {
      // payload might be a partial URL or raw code
    }

    const queryMatch = payload.match(/[?&](code|ticketCode|ticket|qr)=([^&]+)/i);
    if (queryMatch?.[2]) {
      return decodeURIComponent(queryMatch[2]).trim();
    }

    if (/^EVT[-_A-Za-z0-9]+$/i.test(payload.trim())) {
      return payload.trim();
    }

    return null;
  }

  private extractReservationId(payload: string): number | null {
    // Essayer d'abord d'extraire depuis une URL complète (/ticket/123)
    let match = payload.match(/\/ticket\/(\d+)/i);
    if (match?.[1]) {
      const id = Number(match[1]);
      if (Number.isFinite(id) && id > 0) return id;
    }
    
    // Si ça échoue, essayer juste un nombre brut (123)
    match = payload.match(/^(\d+)$/);
    if (match?.[1]) {
      const id = Number(match[1]);
      if (Number.isFinite(id) && id > 0) return id;
    }
    
    return null;
  }

  private createEmptyForm(): EventActivityRequest {
    return {
      title: '',
      description: '',
      price: 0,
      capacity: 10,
      startDate: '',
      endDate: '',
      city: '',
      address: '',
      latitude: null,
      longitude: null,
      imageUrl: '',
      type: 'EVENT',
      categoryId: 0,
      promoType: 'NONE',
      promoPercent: null,
      promoCode: null,
      promoStartDate: null,
      promoEndDate: null,
    };
  }

  private normalizeDate(dt: string): string {
    return dt.length === 16 ? `${dt}:00` : dt;
  }

  private toDateTimeLocal(value: string): string {
    if (!value) return '';
    return value.length >= 16 ? value.slice(0, 16) : value;
  }

  onTabChange(tab: string): void {
    if (tab === 'events' || tab === 'create' || tab === 'carte' || tab === 'reservations' || tab === 'qr' || tab === 'stats') {
      this.switchTab(tab);
    }
  }

  private getEventCoordinates(event: EventActivity): { lat: number; lng: number } | null {
    const lat = this.parseCoordinate(event.latitude);
    const lng = this.parseCoordinate(event.longitude);
    if (lat != null && lng != null) {
      return { lat, lng };
    }
    return this.resolvedCoords.get(event.id) ?? null;
  }

  private getMapCoordinates(event: EventActivity): { lat: number; lng: number } {
    const direct = this.getEventCoordinates(event);
    if (direct) return direct;

    // Deterministic fallback inside Tunisia bounds so every event is visible on map.
    const latRange = this.tunisiaBounds.maxLat - this.tunisiaBounds.minLat;
    const lngRange = this.tunisiaBounds.maxLng - this.tunisiaBounds.minLng;
    const hash = Math.abs((event.id * 2654435761) % 9973);
    const lat = this.tunisiaBounds.minLat + ((hash % 1000) / 1000) * latRange;
    const lng = this.tunisiaBounds.minLng + ((((hash * 37) % 1000) / 1000) * lngRange);
    return { lat, lng };
  }

  private projectTunisiaPoint(lat: number, lng: number): { xPct: number; yPct: number } {
    const b = this.tunisiaBounds;
    let xRatio = (lng - b.minLng) / (b.maxLng - b.minLng);
    let yRatio = (b.maxLat - lat) / (b.maxLat - b.minLat);

    xRatio = Math.max(0, Math.min(1, xRatio));
    yRatio = Math.max(0, Math.min(1, yRatio));

    const xPct = 6 + xRatio * 88;
    const yPct = 5 + yRatio * 90;
    return { xPct, yPct };
  }

  private parseCoordinate(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(',', '.').trim());
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private isWithinTunisiaBounds(lat: number, lng: number): boolean {
    return (
      lat >= this.tunisiaBounds.minLat &&
      lat <= this.tunisiaBounds.maxLat &&
      lng >= this.tunisiaBounds.minLng &&
      lng <= this.tunisiaBounds.maxLng
    );
  }

  private async resolveFormCoordinates(showLoading: boolean): Promise<boolean> {
    const q = `${this.form.address} ${this.form.city}`.trim();
    if (!q) return false;

    if (showLoading) this.geoLoading = true;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tn&q=${encodeURIComponent(q)}`,
      );
      const list: Array<{ lat: string; lon: string }> = await response.json();
      if (list.length === 0) return false;

      const lat = Number(list[0].lat);
      const lng = Number(list[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !this.isWithinTunisiaBounds(lat, lng)) {
        return false;
      }

      this.form.latitude = lat;
      this.form.longitude = lng;
      return true;
    } catch {
      return false;
    } finally {
      if (showLoading) this.geoLoading = false;
    }
  }

  private async resolveMissingCoordinates(): Promise<void> {
    if (this.geolocatingInProgress) return;
    this.geolocatingInProgress = true;

    try {
      const missing = this.events.filter(
        (ev) =>
          !this.getEventCoordinates(ev) &&
          (ev.address?.trim() || ev.city?.trim()) &&
          (this.failedGeocodingRetries.get(ev.id) ?? 0) < 2, // Allow 2 retries max
      );

      if (missing.length === 0) {
        return;
      }

      for (const ev of missing.slice(0, 20)) {
        const query = `${ev.address ?? ''} ${ev.city ?? ''}`.trim();
        if (!query) continue;

        const cacheKey = query.toLowerCase();
        const cached = this.geocodeCache.get(cacheKey);
        if (cached) {
          this.resolvedCoords.set(ev.id, cached);
          continue;
        }

        try {
          // Add delay to avoid rate limiting (500ms between requests)
          await new Promise(resolve => setTimeout(resolve, 500));

          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tn&q=${encodeURIComponent(
              query,
            )}`,
          );
          const list: Array<{ lat: string; lon: string }> = await response.json();
          if (list.length > 0) {
            const lat = Number(list[0].lat);
            const lng = Number(list[0].lon);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              const coords = { lat, lng };
              this.geocodeCache.set(cacheKey, coords);
              this.resolvedCoords.set(ev.id, coords);
              this.failedGeocodingRetries.delete(ev.id);
            }
          } else {
            // Increment retry counter for failed geolocation
            this.failedGeocodingRetries.set(ev.id, (this.failedGeocodingRetries.get(ev.id) ?? 0) + 1);
          }
        } catch (err) {
          // Increment retry counter on error
          this.failedGeocodingRetries.set(ev.id, (this.failedGeocodingRetries.get(ev.id) ?? 0) + 1);
        }
      }

      if (this.mapInitialized) {
        this.renderLeafletMarkers();
        this.fitLeafletBounds();
      }
    } finally {
      this.geolocatingInProgress = false;
      // Retry after 5 seconds if there are still missing events
      const hasMissing = this.events.some(
        (ev) =>
          !this.getEventCoordinates(ev) &&
          (ev.address?.trim() || ev.city?.trim()) &&
          (this.failedGeocodingRetries.get(ev.id) ?? 0) < 2,
      );
      if (hasMissing) {
        setTimeout(() => void this.resolveMissingCoordinates(), 5000);
      }
    }
  }

  // 📊 ANALYTICS: Stats par catégorie et tendances
  get eventsByCategory(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.events.forEach(ev => {
      const cat = this.categories.find(c => c.id === ev.categoryId)?.name ?? 'Sans Catégorie';
      stats[cat] = (stats[cat] ?? 0) + 1;
    });
    return stats;
  }

  get eventsByStatus(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.events.forEach(ev => {
      stats[ev.status] = (stats[ev.status] ?? 0) + 1;
    });
    return stats;
  }

  get revenueByCategory(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.events.forEach(ev => {
      const cat = this.categories.find(c => c.id === ev.categoryId)?.name ?? 'Sans Catégorie';
      const revenue = this.getEventRevenue(ev.id);
      stats[cat] = (stats[cat] ?? 0) + revenue;
    });
    return stats;
  }

  get averagePriceByCategory(): Record<string, string> {
    const stats: Record<string, { total: number; count: number }> = {};
    this.events.forEach(ev => {
      const cat = this.categories.find(c => c.id === ev.categoryId)?.name ?? 'Sans Catégorie';
      if (!stats[cat]) stats[cat] = { total: 0, count: 0 };
      stats[cat].total += ev.price;
      stats[cat].count += 1;
    });
    const result: Record<string, string> = {};
    Object.keys(stats).forEach(cat => {
      result[cat] = (stats[cat].total / stats[cat].count).toFixed(2);
    });
    return result;
  }

  get upcomingEventsCount(): number {
    const today = new Date();
    return this.events.filter(ev => new Date(ev.startDate) > today && ev.status === 'PUBLISHED').length;
  }

  get confirmRate(): number {
    if (!this.totalReservations) return 0;
    return Math.round((this.confirmedReservations / this.totalReservations) * 100);
  }

  get publishedShare(): number {
    if (!this.events.length) return 0;
    return Math.round((this.publishedEventCount / this.events.length) * 100);
  }

  get statusDistribution(): Array<{ key: EventStatus; label: string; count: number; pct: number; color: string }> {
    const total = this.events.length || 1;
    const map: Array<{ key: EventStatus; label: string; color: string }> = [
      { key: 'PUBLISHED', label: 'Publiés', color: '#0b8f5a' },
      { key: 'DRAFT', label: 'Brouillons', color: '#d88600' },
      { key: 'CANCELLED', label: 'Annulés', color: '#d14949' },
      { key: 'REJECTED', label: 'Rejetés', color: '#9b3cbf' },
    ];

    return map
      .map((item) => {
        const count = this.events.filter(ev => ev.status === item.key).length;
        const pct = Math.round((count / total) * 100);
        return { ...item, count, pct };
      })
      .filter(item => item.count > 0);
  }

  get categoryDistribution(): Array<{ name: string; count: number; pct: number; revenue: number }> {
    const total = this.events.length || 1;
    const stats = this.eventsByCategory;
    const rev = this.revenueByCategory;

    return Object.keys(stats)
      .map((name) => ({
        name,
        count: stats[name],
        pct: Math.round((stats[name] / total) * 100),
        revenue: rev[name] ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  get categoryDonutSegments(): Array<{ name: string; pct: number; start: number; color: string }> {
    const colors = ['#00a6d6', '#0b8f5a', '#ff8f00', '#7a4dd8', '#d94f70', '#0077b6'];
    let cursor = 0;
    return this.categoryDistribution.map((c, index) => {
      const segment = {
        name: c.name,
        pct: c.pct,
        start: cursor,
        color: colors[index % colors.length],
      };
      cursor += c.pct;
      return segment;
    });
  }

  get categoryDonutHint(): string {
    if (this.hoveredCategorySegment) {
      return `${this.hoveredCategorySegment.name}: ${this.hoveredCategorySegment.pct}%`;
    }
    return 'Survolez une partie du cercle catégorie';
  }

  onCategorySegmentEnter(segment: { name: string; pct: number; start: number; color: string }): void {
    this.hoveredCategorySegment = {
      name: segment.name,
      pct: segment.pct,
      color: segment.color,
    };
  }

  onCategorySegmentLeave(): void {
    this.hoveredCategorySegment = null;
  }

  get monthlyPerformance(): Array<{ label: string; reservations: number; revenue: number; heightPct: number }> {
    const now = new Date();
    const months: Array<{ key: string; label: string; reservations: number; revenue: number }> = [];

    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        key,
        label: d.toLocaleDateString('fr-FR', { month: 'short' }),
        reservations: 0,
        revenue: 0,
      });
    }

    const indexByKey = new Map(months.map((m, idx) => [m.key, idx]));
    for (const r of this.allReservations) {
      const date = new Date(r.reservationDate);
      if (Number.isNaN(date.getTime())) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const idx = indexByKey.get(key);
      if (idx == null) continue;
      months[idx].reservations += 1;
      if (r.status === 'CONFIRMED') {
        months[idx].revenue += r.totalPrice;
      }
    }

    const maxRes = Math.max(1, ...months.map(m => m.reservations));
    return months.map((m) => ({
      label: m.label,
      reservations: m.reservations,
      revenue: Math.round(m.revenue),
      heightPct: Math.max(10, Math.round((m.reservations / maxRes) * 100)),
    }));
  }

  statusRingStyle(pct: number, from = '#00a6d6', to = '#0077b6'): string {
    const deg = Math.max(0, Math.min(100, pct)) * 3.6;
    return `conic-gradient(${from} 0deg ${deg}deg, #e6eef7 ${deg}deg 360deg)`;
  }

  get publishedEventCount(): number {
    return this.events.filter(ev => ev.status === 'PUBLISHED').length;
  }

  get draftEventCount(): number {
    return this.events.filter(ev => ev.status === 'DRAFT').length;
  }
}