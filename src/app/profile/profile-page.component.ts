import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.css'
})
export class ProfilePageComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  @ViewChild('faceVideo') faceVideoRef?: ElementRef<HTMLVideoElement>;

  isSubmitting = false;
  isFaceSubmitting = false;
  message = '';
  error = '';
  faceMessage = '';
  faceError = '';
  faceCameraOpen = false;
  faceImageBase64 = '';
  private faceCameraStream: MediaStream | null = null;

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    bio: ['']
  });

  constructor() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.form.patchValue({
        username: currentUser.username,
        email: currentUser.email,
        phone: currentUser.phone ?? '',
        bio: currentUser.bio ?? ''
      });
    }
  }

  ngOnDestroy(): void {
    this.stopFaceCamera();
  }

  async save(): Promise<void> {
    this.message = '';
    this.error = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    try {
      await firstValueFrom(this.authService.updateCurrentUserProfile({
        username: this.form.controls.username.value,
        email: this.form.controls.email.value,
        phone: this.form.controls.phone.value,
        bio: this.form.controls.bio.value
      }));
      this.message = 'Profil mis a jour avec succes.';
    } catch (err) {
      this.error = this.extractError(err, 'Impossible de mettre a jour le profil.');
    } finally {
      this.isSubmitting = false;
    }
  }

  async openFaceCamera(): Promise<void> {
    this.faceError = '';
    this.faceMessage = '';

    try {
      this.stopFaceCamera();
      this.faceCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      this.faceCameraOpen = true;

      setTimeout(() => {
        const video = this.faceVideoRef?.nativeElement;
        if (video && this.faceCameraStream) {
          video.srcObject = this.faceCameraStream;
          void video.play();
        }
      }, 0);
    } catch {
      this.faceError = 'Impossible d acceder a la camera.';
    }
  }

  stopFaceCamera(): void {
    this.faceCameraStream?.getTracks().forEach((track) => track.stop());
    this.faceCameraStream = null;
    this.faceCameraOpen = false;
  }

  captureFace(): void {
    const video = this.faceVideoRef?.nativeElement;

    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      this.faceError = 'Flux camera non disponible.';
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.faceError = 'Capture impossible.';
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.faceImageBase64 = canvas.toDataURL('image/jpeg', 0.92);
    this.stopFaceCamera();
  }

  clearFaceCapture(): void {
    this.faceImageBase64 = '';
    this.faceError = '';
    this.faceMessage = '';
  }

  async saveFaceId(): Promise<void> {
    this.faceError = '';
    this.faceMessage = '';

    if (!this.faceImageBase64) {
      this.faceError = 'Veuillez capturer une photo Face ID.';
      return;
    }

    this.isFaceSubmitting = true;

    try {
      await firstValueFrom(this.authService.updateCurrentUserFaceId({
        imageBase64: this.faceImageBase64
      }));
      this.faceMessage = 'Face ID mis a jour avec succes.';
      this.faceImageBase64 = '';
    } catch (err) {
      this.faceError = this.extractError(err, 'Impossible de mettre a jour Face ID.');
    } finally {
      this.isFaceSubmitting = false;
    }
  }

  private extractError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Backend indisponible ou CORS bloque. Verifiez que Spring tourne sur :8080.';
      }

      const backendMessage = error.error?.message;
      if (typeof backendMessage === 'string' && backendMessage.trim()) {
        return backendMessage;
      }

      if (typeof error.error === 'string' && error.error.trim()) {
        return error.error;
      }

      if (error.status === 401 || error.status === 403) {
        return 'Session expiree ou acces refuse. Reconnectez-vous puis reessayez.';
      }

      if (error.status >= 500) {
        return 'Erreur serveur interne. Verifiez aussi que le service Face ID (port 8001) est demarre.';
      }
    }

    return fallback;
  }
}
