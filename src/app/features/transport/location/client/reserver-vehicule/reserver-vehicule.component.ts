import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { from, Observable, of, Subscription, throwError } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../../services/auth.service';
import {
  VehiculeAgence,
  ReservationLocation,
  ReservationStatus,
} from '../../../core/models';
import { LocationService } from '../../../core/services/location.service';
import {
  AiExtractionService,
  LicenseVerificationResult,
} from '../../../core/services/ai-extraction.service';

/** Prénom / nom : lettres (latin + accents courants), espaces, tiret, apostrophe — pas de chiffres. */
const NOM_PRENOM_PATTERN =
  /^[A-Za-zÀÂÄÉÈÊËÏÎÔÙÛÜÇàâäéèêëïîôùûüçßÆæŒœ\s'\-]{2,50}$/;

/** Numéro permis : 8 chiffres (souvent TN) ou alphanumérique 6–20, ou motif TN-AAAA-NNNNN. */
const NUMERO_PERMIS_TUNISIE =
  /^(?:\d{8}|[A-Za-z0-9]{6,20}|[A-Za-z]{2}-\d{4}-\d{5})$/i;

function parseDateOnly(value: string): Date | null {
  const t = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return null;
  }
  const [y, m, d] = t.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function rentalDaysInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function ageOnDate(birth: Date, on: Date): number {
  let age = on.getFullYear() - birth.getFullYear();
  const m = on.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function periodeLocationValidator(maxDays: number): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const deb = group.get('dateDebut')?.value;
    const fin = group.get('dateFin')?.value;
    if (!deb || !fin) {
      return null;
    }
    const s = parseDateOnly(deb);
    const e = parseDateOnly(fin);
    if (!s || !e) {
      return { datesInvalides: true };
    }
    const today = startOfToday();
    if (s < today) {
      return { retraitPasse: true };
    }
    if (e <= s) {
      return { retourAvantRetrait: true };
    }
    const days = rentalDaysInclusive(s, e);
    if (days < 1) {
      return { dureeMin: true };
    }
    if (days > maxDays) {
      return { dureeMax: { max: maxDays, days } };
    }
    return null;
  };
}

function conducteurAgeValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const birthRaw = group.get('dateNaiss')?.value;
    const debutRaw = group.get('dateDebut')?.value;
    if (!birthRaw || !debutRaw) {
      return null;
    }
    const birth = parseDateOnly(birthRaw);
    const debut = parseDateOnly(debutRaw);
    if (!birth || !debut) {
      return null;
    }
    const age = ageOnDate(birth, debut);
    if (age < 18) {
      return { conducteurMineur: { age } };
    }
    if (age > 90) {
      return { conducteurAgeMax: { age } };
    }
    return null;
  };
}

function permisCouvreLocationValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const expRaw = group.get('licenseExpiryDate')?.value;
    const finRaw = group.get('dateFin')?.value;
    if (!expRaw || !finRaw) {
      return null;
    }
    const exp = parseDateOnly(expRaw);
    const fin = parseDateOnly(finRaw);
    if (!exp || !fin) {
      return null;
    }
    const today = startOfToday();
    if (exp < today) {
      return { permisDejaExpire: true };
    }
    if (exp < fin) {
      return { permisExpireAvantFinLocation: true };
    }
    return null;
  };
}

function parseReservationDate(value: string): Date | null {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  const asDateOnly = parseDateOnly(raw.slice(0, 10));
  if (asDateOnly) {
    return asDateOnly;
  }
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function periodsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && endA > startB;
}

interface ReservedPeriod {
  idReservation: number;
  start: Date;
  end: Date;
  statut: ReservationStatus | string;
}

@Component({
  selector: 'app-reserver-vehicule',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reserver-vehicule.component.html',
  styleUrl: './reserver-vehicule.component.css',
})
export class ReserverVehiculeComponent implements OnInit, OnDestroy {
  private static readonly MAX_LICENSE_UPLOAD_CHARS = 850_000;
  private static readonly LICENSE_MAX_DIMENSION = 1400;
  private static readonly MAX_LOCATION_DAYS = 30;
  private static readonly BLOCKING_AVAILABILITY_STATUSES: readonly ReservationStatus[] =
    [
      ReservationStatus.PENDING,
      ReservationStatus.KYC_PENDING,
      ReservationStatus.DEPOSIT_HELD,
      ReservationStatus.CONTRACT_SIGNED,
      ReservationStatus.CONFIRMED,
      ReservationStatus.IN_PROGRESS,
      ReservationStatus.CHECKOUT_PENDING,
      ReservationStatus.ACTIVE,
    ];

  vehicle: VehiculeAgence | null = null;
  isLoading = false;
  isSaving = false;
  isVerifyingLicense = false;
  isLoadingAvailability = false;
  isCheckingPeriodAvailability = false;
  error = '';
  success = '';
  licenseVerification: LicenseVerificationResult | null = null;

  isGalleryOpen = false;
  galleryPhotos: string[] = [];
  galleryIndex = 0;

  bookingForm: FormGroup;
  unavailablePeriods: ReservedPeriod[] = [];
  calendarAvailabilityHint = '';
  /** Date ISO (yyyy-MM-dd) min pour le retrait = aujourd’hui. */
  minDateRetrait = '';
  private formSubs = new Subscription();
  private _licenseImageBase64 = '';
  private liveAvailabilityRequestSeq = 0;

  selectedLicenseFileName = '';
  private selectedLicenseFile: File | null = null;
  private licenseVerificationSignature = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly locationService: LocationService,
    private readonly authService: AuthService,
    private readonly aiExtractionService: AiExtractionService,
    private readonly fb: FormBuilder,
  ) {
    const today = new Date();
    this.minDateRetrait = this.toIsoDate(today);
    this.bookingForm = this.fb.group(
      {
        dateDebut: ['', Validators.required],
        dateFin: ['', Validators.required],
        prenom: [
          '',
          [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(50),
            Validators.pattern(NOM_PRENOM_PATTERN),
          ],
        ],
        nom: [
          '',
          [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(50),
            Validators.pattern(NOM_PRENOM_PATTERN),
          ],
        ],
        dateNaiss: ['', Validators.required],
        numeroPermis: [
          '',
          [Validators.required, Validators.pattern(NUMERO_PERMIS_TUNISIE)],
        ],
        licenseExpiryDate: ['', Validators.required],
        licenseProof: [false, Validators.requiredTrue],
        note: [''],
        acceptedTerms: [false, Validators.requiredTrue],
      },
      {
        validators: [
          periodeLocationValidator(ReserverVehiculeComponent.MAX_LOCATION_DAYS),
          conducteurAgeValidator(),
          permisCouvreLocationValidator(),
          this.vehicleAvailabilityValidator(),
        ],
      },
    );
  }

  ngOnInit(): void {
    const vehicleId = Number(this.route.snapshot.paramMap.get('id'));
    if (!vehicleId) {
      this.error = 'Véhicule introuvable.';
      return;
    }

    this.isLoading = true;
    this.locationService
      .getVehiculeAgenceById(vehicleId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (vehicle) => {
          this.vehicle = vehicle;
          this.loadVehicleUnavailablePeriods(vehicle);
        },
        error: (err) => {
          this.error = err?.message || 'Impossible de charger ce véhicule.';
        },
      });

    const refreshCrossFieldValidators = () => {
      this.bookingForm.updateValueAndValidity({ emitEvent: false });
      this.onVerificationFieldsChanged();
    };
    ['dateDebut', 'dateFin', 'dateNaiss', 'licenseExpiryDate'].forEach(
      (name) => {
        this.formSubs.add(
          this.bookingForm.get(name)!.valueChanges.subscribe(() => {
            refreshCrossFieldValidators();
            if (name === 'dateDebut' || name === 'dateFin') {
              this.runLivePeriodAvailabilityCheck();
            }
          }),
        );
      },
    );
    ['prenom', 'nom', 'numeroPermis'].forEach((name) => {
      this.formSubs.add(
        this.bookingForm
          .get(name)!
          .valueChanges.subscribe(() => this.onVerificationFieldsChanged()),
      );
    });
  }

  private onVerificationFieldsChanged(): void {
    if (!this.licenseVerification) {
      return;
    }
    const sig = this.buildLicenseVerificationSignature();
    if (sig !== this.licenseVerificationSignature) {
      this.licenseVerification = null;
      this.licenseVerificationSignature = '';
    }
  }

  ngOnDestroy(): void {
    this.formSubs.unsubscribe();
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  get f(): FormGroup {
    return this.bookingForm;
  }

  get estimatedDays(): number {
    const deb = this.bookingForm.get('dateDebut')?.value;
    const fin = this.bookingForm.get('dateFin')?.value;
    if (!deb || !fin) {
      return 0;
    }
    const start = parseDateOnly(deb);
    const end = parseDateOnly(fin);
    if (!start || !end || end <= start) {
      return 0;
    }
    return rentalDaysInclusive(start, end);
  }

  get reservationQuote() {
    if (!this.vehicle) {
      return null;
    }
    const deb = this.bookingForm.get('dateDebut')?.value;
    const fin = this.bookingForm.get('dateFin')?.value;
    if (!deb || !fin) {
      return null;
    }
    const quote = this.locationService.buildReservationQuote(
      this.vehicle,
      deb,
      fin,
    );
    return quote.days > 0 ? quote : null;
  }

  get hasUnavailablePeriods(): boolean {
    return this.unavailablePeriods.length > 0;
  }

  get blockingStatusLabels(): string {
    return ReserverVehiculeComponent.BLOCKING_AVAILABILITY_STATUSES.join(', ');
  }

  get selectedPeriodConflictMessage(): string | null {
    const v = this.bookingForm.getRawValue();
    const start = parseDateOnly(v.dateDebut);
    const end = parseDateOnly(v.dateFin);
    if (!start || !end || end <= start) {
      return null;
    }
    const conflict = this.findFirstConflict(start, end);
    if (!conflict) {
      return null;
    }
    return `Indisponible: une réservation ${conflict.statut} existe du ${this.formatDateShort(conflict.start)} au ${this.formatDateShort(conflict.end)}.`;
  }

  get unavailablePeriodsPreview(): Array<{ label: string; statut: string }> {
    return this.unavailablePeriods.slice(0, 6).map((item) => ({
      label: `${this.formatDateShort(item.start)} -> ${this.formatDateShort(item.end)}`,
      statut: item.statut,
    }));
  }

  get estimatedTotalPrice(): number {
    return this.reservationQuote?.totalPrice ?? 0;
  }

  get advanceAmount(): number {
    return this.reservationQuote?.advanceAmount ?? 0;
  }

  get depositAmount(): number {
    return this.reservationQuote?.depositAmount ?? 0;
  }

  get upfrontPaymentAmount(): number {
    return this.advanceAmount + this.depositAmount;
  }

  get paymentSummaryLabel(): string {
    if (!this.reservationQuote) {
      return 'Estimez la réservation pour afficher le paiement initial.';
    }
    return 'Le paiement initial (avance + caution) sera demandé après validation du permis par l’agence.';
  }

  getVehicleAgencyLabel(vehicle: VehiculeAgence): string {
    if (vehicle.agence) {
      return vehicle.agence.nomAgence;
    }
    return 'Agence de location';
  }

  getVehiclePhotos(vehicle: VehiculeAgence | null): string[] {
    return vehicle?.photoUrls || [];
  }

  resolvePhotoUrl(path?: string): string {
    if (!path) {
      return '';
    }
    return this.locationService.getPublicUploadUrl(path);
  }

  openGallery(index = 0): void {
    const photos = this.getVehiclePhotos(this.vehicle);
    if (!photos.length) {
      return;
    }
    this.galleryPhotos = photos;
    this.galleryIndex = Math.max(0, Math.min(index, photos.length - 1));
    this.isGalleryOpen = true;
  }

  closeGallery(): void {
    this.isGalleryOpen = false;
    this.galleryPhotos = [];
    this.galleryIndex = 0;
  }

  prevGalleryPhoto(): void {
    if (!this.galleryPhotos.length) {
      return;
    }
    this.galleryIndex =
      (this.galleryIndex - 1 + this.galleryPhotos.length) %
      this.galleryPhotos.length;
  }

  nextGalleryPhoto(): void {
    if (!this.galleryPhotos.length) {
      return;
    }
    this.galleryIndex = (this.galleryIndex + 1) % this.galleryPhotos.length;
  }

  getCurrentGalleryPhotoUrl(): string {
    if (!this.galleryPhotos.length) {
      return '';
    }
    return this.resolvePhotoUrl(this.galleryPhotos[this.galleryIndex]);
  }

  /** Erreurs validateurs croisés affichées près du bloc période. */
  get bookingPeriodHint(): string | null {
    if (!this.bookingForm.touched && !this.calendarAvailabilityHint) {
      return null;
    }

    if (this.calendarAvailabilityHint) {
      return this.calendarAvailabilityHint;
    }

    const e = this.bookingForm.errors;
    if (!e) {
      return null;
    }
    if (e['datesInvalides']) {
      return 'Dates invalides.';
    }
    if (e['retraitPasse']) {
      return 'La date de retrait doit être aujourd’hui ou dans le futur.';
    }
    if (e['retourAvantRetrait']) {
      return 'La date de retour doit être après la date de retrait.';
    }
    if (e['dureeMin']) {
      return 'Durée minimum : 1 jour.';
    }
    if (e['dureeMax']) {
      return `Durée maximum : ${e['dureeMax'].max} jours.`;
    }
    if (e['vehiculeIndisponible']) {
      return (
        this.selectedPeriodConflictMessage ||
        'Le véhicule est indisponible sur cette période.'
      );
    }
    if (e['vehiculeIndisponibleRemote']) {
      return (
        this.calendarAvailabilityHint ||
        'Le véhicule est indisponible sur cette période.'
      );
    }
    return null;
  }

  /** Erreurs âge conducteur (validateur de groupe). */
  get bookingIdentityHint(): string | null {
    if (!this.bookingForm.touched) {
      return null;
    }
    const e = this.bookingForm.errors;
    if (!e) {
      return null;
    }
    if (e['conducteurMineur']) {
      return 'Le conducteur doit avoir au moins 18 ans à la date de retrait.';
    }
    if (e['conducteurAgeMax']) {
      return 'Âge conducteur maximum 90 ans à la date de retrait.';
    }
    return null;
  }

  /** Erreurs couverture expiration permis. */
  get bookingPermisHint(): string | null {
    if (!this.bookingForm.touched) {
      return null;
    }
    const e = this.bookingForm.errors;
    if (!e) {
      return null;
    }
    if (e['permisDejaExpire']) {
      return 'Le permis est déjà expiré.';
    }
    if (e['permisExpireAvantFinLocation']) {
      return 'Le permis doit rester valide au moins jusqu’à la date de retour.';
    }
    return null;
  }

  /** Date ISO min pour le retour : lendemain du retrait (retour strictement après retrait). */
  get minDateRetour(): string {
    const raw = this.bookingForm.get('dateDebut')?.value;
    const t = String(raw || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      return this.minDateRetrait;
    }
    const [y, m, d] = t.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) {
      return this.minDateRetrait;
    }
    dt.setDate(dt.getDate() + 1);
    return this.toIsoDate(dt);
  }

  isFieldInvalid(controlName: string): boolean {
    const c = this.bookingForm.get(controlName);
    return !!c && c.invalid && c.touched;
  }

  fieldError(controlName: string): string | null {
    const c = this.bookingForm.get(controlName);
    if (!c?.errors || !c.touched) {
      return null;
    }
    if (c.errors['required']) {
      if (controlName === 'licenseProof') {
        return 'La photo du recto du permis est obligatoire.';
      }
      if (controlName === 'acceptedTerms') {
        return 'Vous devez accepter les conditions générales.';
      }
      return 'Champ obligatoire.';
    }
    if (c.errors['requiredTrue']) {
      if (controlName === 'licenseProof') {
        return 'La photo du recto du permis est obligatoire.';
      }
      return 'Obligatoire.';
    }
    if (c.errors['minlength']) {
      return `Minimum ${c.errors['minlength'].requiredLength} caractères.`;
    }
    if (c.errors['maxlength']) {
      return `Maximum ${c.errors['maxlength'].requiredLength} caractères.`;
    }
    if (c.errors['pattern']) {
      if (controlName === 'prenom' || controlName === 'nom') {
        return 'Lettres, espaces, tiret ou apostrophe uniquement (pas de chiffres).';
      }
      if (controlName === 'numeroPermis') {
        return 'Format permis non reconnu (ex. 8 chiffres ou AB-1234-56789).';
      }
      return 'Format invalide.';
    }
    return null;
  }

  groupError(): string | null {
    const g = this.bookingForm;
    if (this.calendarAvailabilityHint) {
      return this.calendarAvailabilityHint;
    }

    if (!g.errors || !g.touched) {
      return null;
    }
    const e = g.errors;
    if (e['datesInvalides']) {
      return 'Dates invalides.';
    }
    if (e['retraitPasse']) {
      return 'La date de retrait doit être aujourd’hui ou dans le futur.';
    }
    if (e['retourAvantRetrait']) {
      return 'La date de retour doit être après la date de retrait.';
    }
    if (e['dureeMin']) {
      return 'Durée minimum : 1 jour.';
    }
    if (e['dureeMax']) {
      return `Durée maximum : ${e['dureeMax'].max} jours.`;
    }
    if (e['vehiculeIndisponible']) {
      return (
        this.selectedPeriodConflictMessage ||
        'Le véhicule est indisponible sur cette période.'
      );
    }
    if (e['vehiculeIndisponibleRemote']) {
      return (
        this.calendarAvailabilityHint ||
        'Le véhicule est indisponible sur cette période.'
      );
    }
    if (e['conducteurMineur']) {
      return 'Le conducteur doit avoir au moins 18 ans à la date de retrait.';
    }
    if (e['conducteurAgeMax']) {
      return 'Âge conducteur incohérent (maximum 90 ans à la date de retrait).';
    }
    if (e['permisDejaExpire']) {
      return 'Le permis est déjà expiré.';
    }
    if (e['permisExpireAvantFinLocation']) {
      return 'Le permis doit rester valide au moins jusqu’à la date de retour.';
    }
    return null;
  }

  markFormTouched(): void {
    this.bookingForm.markAllAsTouched();
  }

  reserve(): void {
    this.bookingForm.markAllAsTouched();
    this.bookingForm.updateValueAndValidity({ emitEvent: false });

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.vehicle) {
      this.error = 'Session utilisateur ou véhicule manquant.';
      return;
    }

    if (this.bookingForm.invalid) {
      this.error =
        'Veuillez corriger le formulaire : champs obligatoires, dates et permis.';
      return;
    }

    const v = this.bookingForm.getRawValue();
    const licenseB64 = this.licenseImageBase64;
    if (!licenseB64) {
      this.error = 'La photo du permis est obligatoire.';
      return;
    }

    if (
      licenseB64.length > ReserverVehiculeComponent.MAX_LICENSE_UPLOAD_CHARS
    ) {
      this.error =
        'Image du permis trop lourde. Réduisez la taille puis réessayez.';
      return;
    }

    this.isSaving = true;
    this.error = '';
    this.success = '';

    const quote = this.reservationQuote;
    const payload: Partial<ReservationLocation> = {
      clientId: currentUser.id,
      vehiculeAgenceId: this.vehicle.idVehiculeAgence,
      agenceLocation: this.vehicle.agence,
      dateDebut: v.dateDebut,
      dateFin: v.dateFin,
      note: String(v.note || '').trim() || undefined,
      prixTotal: quote?.totalPrice ?? 0,
      advanceAmount: quote?.advanceAmount ?? 0,
      depositAmount: quote?.depositAmount ?? 0,
      statut: ReservationStatus.DRAFT,
      typeVehiculeDemande: this.vehicle.typeVehicule,
    };

    this.createReservationWithVerifiedLicense(payload, currentUser.id);
  }

  /** Image permis (hors FormGroup, rempli par l’upload). */
  get licenseImageBase64(): string {
    return this._licenseImageBase64;
  }

  verifyLicenseWithAi(): void {
    this.bookingForm.markAllAsTouched();
    this.bookingForm.updateValueAndValidity({ emitEvent: false });

    if (!this._licenseImageBase64) {
      this.error = 'Veuillez sélectionner une photo de permis.';
      return;
    }

    if (this.bookingForm.invalid) {
      this.error =
        'Complétez et corrigez le formulaire (dates, identité, permis) avant la vérification.';
      return;
    }

    const v = this.bookingForm.getRawValue();

    this.isVerifyingLicense = true;
    this.error = '';
    this.success = '';

    from(
      this.buildVerificationFileFromUploadedImage(
        this._licenseImageBase64,
        this.selectedLicenseFileName,
      ),
    )
      .pipe(
        switchMap((file) =>
          this.aiExtractionService.verifyLicense(
            file,
            String(v.numeroPermis).trim().toUpperCase(),
            v.licenseExpiryDate,
            v.nom,
            v.prenom,
            v.dateNaiss,
          ),
        ),
        finalize(() => {
          this.isVerifyingLicense = false;
        }),
      )
      .subscribe({
        next: (result) => {
          this.licenseVerification = result;
          this.licenseVerificationSignature =
            this.buildLicenseVerificationSignature();

          if (result.valid) {
            this.success =
              'Permis validé par l’IA. Vous pouvez confirmer la réservation.';
            return;
          }

          this.error =
            result.message || 'Les données du permis ne correspondent pas.';
        },
        error: (err) => {
          this.licenseVerification = null;
          this.error =
            err?.error?.message ||
            err?.message ||
            'Impossible de vérifier le permis.';
        },
      });
  }

  private recoverReservationAfterCreateError(
    error: unknown,
    clientId: number,
  ): Observable<ReservationLocation> {
    const v = this.bookingForm.getRawValue();
    return this.locationService.getReservationsByClient(clientId).pipe(
      map(
        (reservations) =>
          reservations
            .filter(
              (reservation) =>
                reservation.vehiculeAgenceId ===
                  this.vehicle?.idVehiculeAgence &&
                reservation.dateDebut === v.dateDebut &&
                reservation.dateFin === v.dateFin,
            )
            .sort((a, b) => b.idReservation - a.idReservation)[0],
      ),
      switchMap((reservation) => {
        if (reservation) {
          this.error =
            "La réservation a été créée malgré l'erreur serveur. On continue l'étape permis.";
          return of(reservation);
        }
        return throwError(() => error);
      }),
    );
  }

  private recoverReservationAfterUploadError(
    error: unknown,
    reservationId: number,
  ): Observable<ReservationLocation> {
    return this.locationService.getReservationById(reservationId).pipe(
      switchMap((reservation) => {
        if (reservation.numeroPermis || reservation.licenseStatus) {
          this.error =
            'Permis probablement enregistré malgré la réponse 400. Vérifiez le détail de la réservation.';
          return of(reservation);
        }
        return throwError(() => error);
      }),
    );
  }

  onLicenseFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.error = 'Le fichier du permis doit être une image.';
      return;
    }

    this.error = '';
    this.selectedLicenseFileName = file.name;
    this.selectedLicenseFile = file;
    this.licenseVerification = null;
    this.licenseVerificationSignature = '';

    this.optimizeLicenseImage(file)
      .then((optimizedDataUrl) => {
        const normalized = this.normalizeDataUrl(optimizedDataUrl);
        if (!normalized) {
          this._licenseImageBase64 = '';
          this.bookingForm.patchValue({ licenseProof: false });
          this.error = 'Image du permis invalide.';
          return;
        }

        if (
          normalized.length > ReserverVehiculeComponent.MAX_LICENSE_UPLOAD_CHARS
        ) {
          this._licenseImageBase64 = '';
          this.bookingForm.patchValue({ licenseProof: false });
          this.error =
            'Image du permis trop lourde après compression. Choisissez une image plus légère.';
          return;
        }

        this._licenseImageBase64 = normalized;
        this.bookingForm.patchValue({ licenseProof: true });
        this.bookingForm.get('licenseProof')?.markAsTouched();

        if (this.canVerifySelectedLicense()) {
          this.verifyLicenseWithAi();
        }
      })
      .catch(() => {
        this.error = 'Impossible de lire le fichier du permis.';
        this._licenseImageBase64 = '';
        this.bookingForm.patchValue({ licenseProof: false });
      });
  }

  get canShowLicenseVerification(): boolean {
    return !!this.licenseVerification;
  }

  get hasSelectedLicenseFile(): boolean {
    return !!this.selectedLicenseFile;
  }

  get canSubmitReservation(): boolean {
    return (
      this.bookingForm.valid &&
      !this.isVerifyingLicense &&
      !this.isCheckingPeriodAvailability &&
      !this.isSaving &&
      !!this._licenseImageBase64
    );
  }

  private canVerifySelectedLicense(): boolean {
    const v = this.bookingForm.getRawValue();
    return (
      !!this.selectedLicenseFile &&
      !!v.numeroPermis?.trim() &&
      !!v.licenseExpiryDate &&
      this.bookingForm.get('numeroPermis')?.valid === true &&
      this.bookingForm.get('licenseExpiryDate')?.valid === true
    );
  }

  private buildLicenseVerificationSignature(): string {
    const file = this.selectedLicenseFile;
    const v = this.bookingForm.getRawValue();
    return [
      file ? `${file.name}:${file.size}:${file.lastModified}` : '',
      String(v.numeroPermis || '')
        .trim()
        .toUpperCase(),
      v.licenseExpiryDate || '',
      String(this._licenseImageBase64.length || 0),
    ].join('|');
  }

  private async buildVerificationFileFromUploadedImage(
    dataUrl: string,
    originalFileName: string,
  ): Promise<File> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const baseName = (originalFileName || 'license').replace(/\.[^/.]+$/, '');
    const extension = blob.type.includes('png') ? 'png' : 'jpg';
    const mimeType = blob.type || 'image/jpeg';
    return new File([blob], `${baseName}_uploaded.${extension}`, {
      type: mimeType,
    });
  }

  private createReservationWithVerifiedLicense(
    payload: Partial<ReservationLocation>,
    clientId: number,
  ): void {
    const v = this.bookingForm.getRawValue();
    this.verifyPeriodAvailability(v.dateDebut, v.dateFin)
      .pipe(
        switchMap(() => this.locationService.createReservation(payload)),
        catchError((err) =>
          this.recoverReservationAfterCreateError(err, clientId),
        ),
        switchMap((reservation) =>
          this.locationService
            .uploadLicense(
              reservation.idReservation,
              String(v.numeroPermis).trim().toUpperCase(),
              this._licenseImageBase64,
              v.licenseExpiryDate,
              v.prenom,
              v.nom,
              v.dateNaiss,
            )
            .pipe(
              catchError((err) =>
                this.recoverReservationAfterUploadError(
                  err,
                  reservation.idReservation,
                ),
              ),
            ),
        ),
      )
      .pipe(
        finalize(() => {
          this.isSaving = false;
        }),
      )
      .subscribe({
        next: (reservation) => {
          this.success = this.licenseVerification?.valid
            ? 'Réservation envoyée avec permis validé par l’IA. En attente de validation agence.'
            : 'Réservation envoyée. La vérification du permis sera faite manuellement par l’agence.';
          this.router.navigate([
            '/transport/location/client/detail',
            reservation.idReservation,
          ]);
        },
        error: (err) => {
          this.error = err?.message || 'Impossible de créer la réservation.';
        },
      });
  }

  private vehicleAvailabilityValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const deb = group.get('dateDebut')?.value;
      const fin = group.get('dateFin')?.value;
      if (!deb || !fin || this.unavailablePeriods.length === 0) {
        return null;
      }
      const start = parseDateOnly(deb);
      const end = parseDateOnly(fin);
      if (!start || !end || end <= start) {
        return null;
      }
      return this.findFirstConflict(start, end)
        ? { vehiculeIndisponible: true }
        : null;
    };
  }

  private loadVehicleUnavailablePeriods(vehicle: VehiculeAgence): void {
    const agenceId = Number(vehicle?.agence?.idAgence || 0);
    if (!agenceId || !vehicle.idVehiculeAgence) {
      this.unavailablePeriods = [];
      this.bookingForm.updateValueAndValidity({ emitEvent: false });
      return;
    }

    this.isLoadingAvailability = true;
    this.locationService
      .getReservationsByAgence(agenceId)
      .pipe(
        map((reservations) =>
          this.extractUnavailablePeriods(
            reservations,
            vehicle.idVehiculeAgence,
          ),
        ),
        finalize(() => {
          this.isLoadingAvailability = false;
          this.bookingForm.updateValueAndValidity({ emitEvent: false });
        }),
      )
      .subscribe({
        next: (periods) => {
          this.unavailablePeriods = periods;
          this.runLivePeriodAvailabilityCheck();
        },
        error: () => {
          this.unavailablePeriods = [];
          this.runLivePeriodAvailabilityCheck();
        },
      });
  }

  private runLivePeriodAvailabilityCheck(): void {
    const requestSeq = ++this.liveAvailabilityRequestSeq;
    const v = this.bookingForm.getRawValue();
    const start = parseDateOnly(v.dateDebut);
    const end = parseDateOnly(v.dateFin);

    this.calendarAvailabilityHint = '';
    this.updateRemoteAvailabilityError(false);

    if (!start || !end || end <= start || !this.vehicle?.idVehiculeAgence) {
      this.isCheckingPeriodAvailability = false;
      return;
    }

    const localConflict = this.findFirstConflict(start, end);
    if (localConflict) {
      this.calendarAvailabilityHint =
        this.selectedPeriodConflictMessage ||
        'Le véhicule est indisponible sur cette période.';
      this.updateRemoteAvailabilityError(true);
      this.isCheckingPeriodAvailability = false;
      return;
    }

    this.isCheckingPeriodAvailability = true;
    this.locationService
      .checkAvailability(this.vehicle.idVehiculeAgence, v.dateDebut, v.dateFin)
      .pipe(finalize(() => (this.isCheckingPeriodAvailability = false)))
      .subscribe({
        next: (isAvailable) => {
          if (requestSeq !== this.liveAvailabilityRequestSeq) {
            return;
          }
          if (isAvailable === false) {
            this.calendarAvailabilityHint =
              'Véhicule déjà réservé sur cette période.';
            this.updateRemoteAvailabilityError(true);
            return;
          }
          this.calendarAvailabilityHint = '';
          this.updateRemoteAvailabilityError(false);
        },
        error: () => {
          this.refreshUnavailablePeriodsFromAgency().subscribe((periods) => {
            if (requestSeq !== this.liveAvailabilityRequestSeq) {
              return;
            }

            this.unavailablePeriods = periods;
            const fallbackConflict = this.findFirstConflict(start, end);
            if (fallbackConflict) {
              this.calendarAvailabilityHint =
                this.selectedPeriodConflictMessage ||
                'Le véhicule est indisponible sur cette période.';
              this.updateRemoteAvailabilityError(true);
              return;
            }

            this.calendarAvailabilityHint = '';
            this.updateRemoteAvailabilityError(false);
          });
        },
      });
  }

  private refreshUnavailablePeriodsFromAgency(): Observable<ReservedPeriod[]> {
    const agenceId = Number(this.vehicle?.agence?.idAgence || 0);
    const vehiculeAgenceId = Number(this.vehicle?.idVehiculeAgence || 0);

    if (!agenceId || !vehiculeAgenceId) {
      return of(this.unavailablePeriods);
    }

    return this.locationService.getReservationsByAgence(agenceId).pipe(
      map((reservations) =>
        this.extractUnavailablePeriods(reservations, vehiculeAgenceId),
      ),
      catchError(() => of(this.unavailablePeriods)),
    );
  }

  private updateRemoteAvailabilityError(hasError: boolean): void {
    const currentErrors = this.bookingForm.errors || {};
    const nextErrors = { ...currentErrors } as Record<string, any>;

    if (hasError) {
      nextErrors['vehiculeIndisponibleRemote'] = true;
    } else {
      delete nextErrors['vehiculeIndisponibleRemote'];
    }

    const hasAny = Object.keys(nextErrors).length > 0;
    this.bookingForm.setErrors(hasAny ? nextErrors : null);
  }

  private extractUnavailablePeriods(
    reservations: ReservationLocation[],
    vehiculeAgenceId: number,
  ): ReservedPeriod[] {
    return (reservations || [])
      .filter(
        (reservation) =>
          this.extractReservationVehiculeAgenceId(reservation) ===
          Number(vehiculeAgenceId),
      )
      .filter((reservation) =>
        this.isBlockingReservationStatus(
          this.extractReservationStatus(reservation),
        ),
      )
      .map((reservation) => {
        const raw = reservation as ReservationLocation & Record<string, any>;
        const start = parseReservationDate(
          reservation.dateDebut || raw['date_debut'] || raw['dateDebut'],
        );
        const end = parseReservationDate(
          reservation.dateFin || raw['date_fin'] || raw['dateFin'],
        );
        const statut = this.extractReservationStatus(reservation);
        if (!start || !end || end <= start) {
          return null;
        }
        return {
          idReservation: Number(reservation.idReservation || 0),
          start,
          end,
          statut,
        } as ReservedPeriod;
      })
      .filter((item): item is ReservedPeriod => !!item)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private extractReservationVehiculeAgenceId(
    reservation: ReservationLocation,
  ): number {
    const raw = reservation as ReservationLocation & Record<string, any>;
    const nestedVehicule =
      ((raw.vehiculeAgence || raw['vehicule']) as unknown as Record<
        string,
        unknown
      >) || {};
    return Number(
      raw.vehiculeAgenceId ??
        raw['idVehiculeAgence'] ??
        raw['id_vehicule_agence'] ??
        raw['vehicule_agence_id'] ??
        nestedVehicule['idVehiculeAgence'] ??
        nestedVehicule['id_vehicule_agence'] ??
        nestedVehicule['id'] ??
        0,
    );
  }

  private extractReservationStatus(reservation: ReservationLocation): string {
    const raw = reservation as ReservationLocation & Record<string, any>;
    return String(
      reservation.statut ?? raw['statut'] ?? raw['status'] ?? raw['etat'] ?? '',
    );
  }

  private normalizeStatus(value: unknown): string {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
  }

  private isBlockingReservationStatus(
    statut: ReservationStatus | string | undefined,
  ): boolean {
    const normalized = this.normalizeStatus(statut);
    if (!normalized) {
      return false;
    }

    if (
      ReserverVehiculeComponent.BLOCKING_AVAILABILITY_STATUSES.some(
        (status) => this.normalizeStatus(status) === normalized,
      )
    ) {
      return true;
    }

    return (
      normalized.includes('CONFIRM') ||
      normalized.includes('ACTIVE') ||
      normalized.includes('IN_PROGRESS') ||
      normalized.includes('CHECKOUT')
    );
  }

  private findFirstConflict(start: Date, end: Date): ReservedPeriod | null {
    for (const period of this.unavailablePeriods) {
      if (periodsOverlap(start, end, period.start, period.end)) {
        return period;
      }
    }
    return null;
  }

  private verifyPeriodAvailability(
    dateDebut: string,
    dateFin: string,
  ): Observable<void> {
    if (!this.vehicle?.idVehiculeAgence) {
      return throwError(
        () =>
          new Error('Véhicule introuvable pour le contrôle de disponibilité.'),
      );
    }

    const start = parseDateOnly(dateDebut);
    const end = parseDateOnly(dateFin);
    if (!start || !end || end <= start) {
      return throwError(() => new Error('Période de réservation invalide.'));
    }

    if (this.findFirstConflict(start, end)) {
      return throwError(
        () =>
          new Error(
            this.selectedPeriodConflictMessage ||
              'Le véhicule est indisponible sur cette période.',
          ),
      );
    }

    return this.locationService
      .checkAvailability(this.vehicle.idVehiculeAgence, dateDebut, dateFin)
      .pipe(
        switchMap((isAvailable) =>
          isAvailable === false
            ? throwError(
                () =>
                  new Error(
                    "Le véhicule est déjà réservé sur cette période. Veuillez choisir d'autres dates.",
                  ),
              )
            : of(void 0),
        ),
        catchError((error) => {
          if (this.findFirstConflict(start, end)) {
            return throwError(
              () =>
                new Error(
                  this.selectedPeriodConflictMessage ||
                    'Le véhicule est indisponible sur cette période.',
                ),
            );
          }

          return this.refreshUnavailablePeriodsFromAgency().pipe(
            switchMap((periods) => {
              this.unavailablePeriods = periods;
              if (this.findFirstConflict(start, end)) {
                return throwError(
                  () =>
                    new Error(
                      this.selectedPeriodConflictMessage ||
                        'Le véhicule est indisponible sur cette période.',
                    ),
                );
              }
              return of(void 0);
            }),
          );
        }),
      );
  }

  private formatDateShort(value: Date): string {
    return value.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private async optimizeLicenseImage(file: File): Promise<string> {
    const originalDataUrl = await this.readFileAsDataUrl(file);
    const image = await this.loadImage(originalDataUrl);
    const maxDimension = ReserverVehiculeComponent.LICENSE_MAX_DIMENSION;
    const ratio = Math.min(
      maxDimension / image.width,
      maxDimension / image.height,
      1,
    );
    const targetWidth = Math.max(1, Math.round(image.width * ratio));
    const targetHeight = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return originalDataUrl;
    }
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Invalid image'));
      image.src = dataUrl;
    });
  }

  private normalizeDataUrl(value: string): string {
    const raw = value.trim();
    if (!raw.startsWith('data:image/')) {
      return '';
    }
    const commaIndex = raw.indexOf(',');
    if (commaIndex < 0) {
      return '';
    }
    const header = raw.slice(0, commaIndex + 1);
    const payload = raw.slice(commaIndex + 1).replace(/\s+/g, '');
    return `${header}${payload}`;
  }
}
