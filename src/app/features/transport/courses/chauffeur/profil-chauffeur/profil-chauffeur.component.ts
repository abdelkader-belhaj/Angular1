// src/app/features/transport/courses/chauffeur/profil-chauffeur/profil-chauffeur.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ChauffeurService } from '../../../core/services/chauffeur.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LocationService } from '../../../core/services/location.service';
import { AuthService } from '../../../../../services/auth.service';
import {
  Chauffeur,
  DisponibiliteStatut,
  PositionUpdate,
} from '../../../core/models';

@Component({
  selector: 'app-profil-chauffeur',
  templateUrl: './profil-chauffeur.component.html',
  styleUrls: ['./profil-chauffeur.component.css'],
})
export class ProfilChauffeurComponent implements OnInit {
  chauffeur: Chauffeur | null = null;
  chauffeurId: number | null = null;

  profileForm: FormGroup;
  isEditing = false;
  isLoading = true;
  isSaving = false;

  // Position
  currentPosition: { lat: number; lng: number } | null = null;
  isLocating = false;

  constructor(
    private fb: FormBuilder,
    private chauffeurService: ChauffeurService,
    private notificationService: NotificationService,
    private locationService: LocationService,
    private authService: AuthService,
    private router: Router,
  ) {
    this.profileForm = this.fb.group({
      telephone: ['', [Validators.required, Validators.pattern(/^[0-9\s+]+$/)]],
      numeroLicence: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      username: [{ value: '', disabled: true }],
    });
  }

  ngOnInit(): void {
    this.initializeProfileContext();
  }

  private initializeProfileContext(): void {
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser) {
      this.notificationService.warning(
        'Authentification',
        'Veuillez vous connecter pour acceder au profil chauffeur.',
      );
      this.isLoading = false;
      return;
    }

    this.chauffeurService.resolveChauffeurIdByUserId(currentUser.id).subscribe({
      next: (id) => {
        this.chauffeurId = id;
        if (!this.chauffeurId) {
          this.notificationService.warning(
            'Profil chauffeur',
            'Aucun profil chauffeur lie a cet utilisateur.',
          );
          this.isLoading = false;
          return;
        }

        this.loadProfile();
      },
      error: () => {
        this.notificationService.error(
          'Erreur',
          'Impossible de resoudre le chauffeur courant.',
        );
        this.isLoading = false;
      },
    });
  }

  loadProfile(): void {
    if (!this.chauffeurId) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.chauffeurService.getProfil(this.chauffeurId).subscribe({
      next: (chauffeur) => {
        this.chauffeur = chauffeur;
        this.profileForm.patchValue({
          telephone: chauffeur.telephone,
          numeroLicence: chauffeur.numeroLicence,
          email: chauffeur.utilisateur?.email,
          username: chauffeur.utilisateur?.username,
        });
        this.isLoading = false;

        // Mettre a jour la position uniquement quand le profil (et idLocalisation) est charge.
        this.getCurrentLocation();
      },
      error: () => {
        this.notificationService.error(
          'Erreur',
          'Impossible de charger le profil',
        );
        this.isLoading = false;
      },
    });
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) {
      // Reset form
      this.profileForm.patchValue({
        telephone: this.chauffeur?.telephone,
        numeroLicence: this.chauffeur?.numeroLicence,
      });
    }
  }

  saveProfile(): void {
    if (this.profileForm.invalid || !this.chauffeurId) return;

    this.isSaving = true;
    const update = {
      telephone: this.profileForm.value.telephone,
      numeroLicence: this.profileForm.value.numeroLicence,
    };

    this.chauffeurService.updateProfil(this.chauffeurId, update).subscribe({
      next: (chauffeur) => {
        this.chauffeur = chauffeur;
        this.isEditing = false;
        this.isSaving = false;
        this.notificationService.success('Succès', 'Profil mis à jour');
      },
      error: () => {
        this.isSaving = false;
        this.notificationService.error('Erreur', 'Mise à jour échouée');
      },
    });
  }

  // ==================== DISPONIBILITÉ ====================

  setDisponible(): void {
    if (!this.chauffeurId) return;

    this.chauffeurService.goOnline(this.chauffeurId).subscribe({
      next: (c) => {
        this.chauffeur = c;
        this.notificationService.success(
          'En ligne',
          'Vous êtes maintenant disponible',
        );
      },
    });
  }

  setIndisponible(): void {
    if (!this.chauffeurId) return;

    this.chauffeurService.goOffline(this.chauffeurId).subscribe({
      next: (c) => {
        this.chauffeur = c;
        this.notificationService.info(
          'Hors ligne',
          "Vous n'apparaissez plus sur la carte",
        );
      },
    });
  }

  // ==================== LOCALISATION ====================

  getCurrentLocation(): void {
    this.isLocating = true;
    this.locationService.getCurrentPosition().subscribe({
      next: (position: GeolocationPosition) => {
        this.currentPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        this.isLocating = false;

        // Mettre à jour sur le serveur
        this.updatePositionOnServer();
      },
      error: (err: Error) => {
        this.notificationService.error('Géolocalisation', err.message);
        this.isLocating = false;
      },
    });
  }

  private updatePositionOnServer(): void {
    if (!this.currentPosition || !this.chauffeurId) return;

    const update: PositionUpdate = {
      idLocalisation: this.chauffeur?.positionActuelle?.idLocalisation,
      latitude: this.currentPosition.lat,
      longitude: this.currentPosition.lng,
    };

    this.chauffeurService.updatePosition(this.chauffeurId, update).subscribe({
      next: () => console.log('Position mise à jour'),
      error: () => console.error('Erreur mise à jour position'),
    });
  }

  // ==================== NAVIGATION ====================

  goBack(): void {
    this.router.navigate(['/transport/courses/chauffeur']);
  }

  goToVehicles(): void {
    this.router.navigate(['/transport/courses/chauffeur/vehicules']);
  }

  goToEarnings(): void {
    this.router.navigate(['/transport/courses/chauffeur/gains']);
  }

  // ==================== GETTERS ====================

  getStatusColor(): string {
    switch (this.chauffeur?.disponibilite) {
      case DisponibiliteStatut.AVAILABLE:
        return '#48bb78';
      case DisponibiliteStatut.ON_RIDE:
        return '#ed8936';
      default:
        return '#a0aec0';
    }
  }

  getStatusText(): string {
    switch (this.chauffeur?.disponibilite) {
      case DisponibiliteStatut.AVAILABLE:
        return 'Disponible';
      case DisponibiliteStatut.ON_RIDE:
        return 'En course';
      case DisponibiliteStatut.UNAVAILABLE:
        return 'Hors ligne';
      default:
        return 'Inconnu';
    }
  }
}
