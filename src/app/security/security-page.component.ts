import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-security-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './security-page.component.html',
  styleUrl: './security-page.component.css'
})
export class SecurityPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isSubmitting = false;
  isLoadingTwoFactor = false;
  isVerifyingTwoFactor = false;
  message = '';
  error = '';
  twoFactorMessage = '';
  twoFactorError = '';
  recommendedTwoFactor = false;
  recommendedPasswordSetup = false;
  returnToRoute = '';
  twoFactorSetup: {
    issuer: string;
    accountName: string;
    secret: string;
    otpauthUri: string;
    qrCodeDataUrl: string;
    enabled: boolean;
  } | null = null;
  activeSection: 'twoFactor' | 'addPassword' | 'changePassword' = 'twoFactor';
  showOldPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  readonly form = this.fb.nonNullable.group({
    oldPassword: [''],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly twoFactorForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
  });

  ngOnInit(): void {
    this.recommendedTwoFactor = this.route.snapshot.queryParamMap.get('recommendTwoFactor') === '1';
    this.recommendedPasswordSetup = this.route.snapshot.queryParamMap.get('recommendPasswordSetup') === '1';
    this.returnToRoute = this.route.snapshot.queryParamMap.get('returnTo') ?? '';

    if (this.showAddPasswordSection) {
      this.activeSection = 'addPassword';
      return;
    }

    if (!this.showTwoFactorPrompt) {
      this.activeSection = 'changePassword';
    }
  }

  get currentUser() {
    return this.authService.getCurrentUser();
  }

  get usesGoogleLogin(): boolean {
    return localStorage.getItem('auth_login_provider') === 'google';
  }

  get showTwoFactorPrompt(): boolean {
    return !!this.currentUser && this.currentUser.role !== 'ADMIN' && !this.currentUser.twoFactorEnabled;
  }

  get securityScore(): number {
    let score = 35;

    if (this.currentUser?.twoFactorEnabled) {
      score += 40;
    }

    if (!this.usesGoogleLogin || this.recommendedPasswordSetup === false) {
      score += 25;
    }

    return Math.min(score, 100);
  }

  get securityLevelLabel(): string {
    if (this.securityScore >= 85) {
      return 'Excellent';
    }

    if (this.securityScore >= 60) {
      return 'Bon niveau';
    }

    return 'A renforcer';
  }

  get passwordStatusLabel(): string {
    return this.showAddPasswordSection && this.recommendedPasswordSetup
      ? 'A configurer'
      : 'Configure';
  }

  get passwordStrength(): number {
    const value = this.form.controls.newPassword.value;
    let score = 0;

    if (value.length >= 6) score += 25;
    if (/[A-Z]/.test(value)) score += 25;
    if (/[0-9]/.test(value)) score += 25;
    if (/[^A-Za-z0-9]/.test(value)) score += 25;

    return score;
  }

  get passwordStrengthLabel(): string {
    if (this.passwordStrength >= 75) {
      return 'Fort';
    }

    if (this.passwordStrength >= 50) {
      return 'Moyen';
    }

    if (this.passwordStrength > 0) {
      return 'Faible';
    }

    if (this.passwordStatusLabel === 'Configure') {
      return 'Definie';
    }

    return 'Non defini';
  }

  get hasPasswordInput(): boolean {
    return !!(
      this.form.controls.oldPassword.value
      || this.form.controls.newPassword.value
      || this.form.controls.confirmPassword.value
    );
  }

  setActiveSection(section: 'twoFactor' | 'addPassword' | 'changePassword'): void {
    this.activeSection = section;
    this.message = '';
    this.error = '';
    this.twoFactorError = '';
    this.twoFactorMessage = '';
  }

  togglePasswordVisibility(field: 'old' | 'new' | 'confirm'): void {
    if (field === 'old') {
      this.showOldPassword = !this.showOldPassword;
      return;
    }

    if (field === 'new') {
      this.showNewPassword = !this.showNewPassword;
      return;
    }

    this.showConfirmPassword = !this.showConfirmPassword;
  }

  get canShowTwoFactor(): boolean {
    return this.showTwoFactorPrompt || !!this.twoFactorSetup || !!this.currentUser?.twoFactorEnabled;
  }

  get showAddPasswordSection(): boolean {
    if (this.recommendedPasswordSetup) {
      return true;
    }

    return localStorage.getItem('auth_login_provider') === 'google';
  }

  async loadTwoFactorSetup(): Promise<void> {
    this.twoFactorError = '';
    this.twoFactorMessage = '';
    this.isLoadingTwoFactor = true;

    try {
      this.twoFactorSetup = await firstValueFrom(this.authService.setupTwoFactor());
      this.twoFactorMessage = 'Scannez le QR code puis saisissez le code a 6 chiffres.';
    } catch (err) {
      this.twoFactorError = this.extractError(err, 'Impossible de preparer la configuration 2FA.');
    } finally {
      this.isLoadingTwoFactor = false;
    }
  }

  async verifyTwoFactor(): Promise<void> {
    this.twoFactorError = '';
    this.twoFactorMessage = '';

    if (this.twoFactorForm.invalid) {
      this.twoFactorForm.markAllAsTouched();
      return;
    }

    this.isVerifyingTwoFactor = true;

    try {
      await firstValueFrom(this.authService.verifyTwoFactor({
        code: this.twoFactorForm.controls.code.value
      }));

      this.twoFactorMessage = '2FA active avec succes.';
      this.twoFactorSetup = null;
      this.twoFactorForm.reset({ code: '' });
    } catch (err) {
      this.twoFactorError = this.extractError(err, 'Code 2FA invalide.');
    } finally {
      this.isVerifyingTwoFactor = false;
    }
  }

  async skipTwoFactor(): Promise<void> {
    const fallbackRoute = this.returnToRoute || this.authService.getRouteForRole(this.currentUser?.role);
    await this.router.navigateByUrl(fallbackRoute);
  }

  async save(): Promise<void> {
    this.message = '';
    this.error = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.form.controls.newPassword.value !== this.form.controls.confirmPassword.value) {
      this.error = 'La confirmation du mot de passe ne correspond pas.';
      return;
    }

    this.isSubmitting = true;

    try {
      await firstValueFrom(this.authService.changeCurrentUserPassword({
        oldPassword: this.recommendedPasswordSetup ? undefined : this.form.controls.oldPassword.value,
        newPassword: this.form.controls.newPassword.value,
        confirmPassword: this.form.controls.confirmPassword.value
      }));

      this.message = 'Mot de passe modifie avec succes.';
      this.form.reset({ oldPassword: '', newPassword: '', confirmPassword: '' });
      this.recommendedPasswordSetup = false;
    } catch (err) {
      this.error = this.extractError(err, 'Impossible de modifier le mot de passe.');
    } finally {
      this.isSubmitting = false;
    }
  }

  private extractError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = error.error?.message;
      if (typeof backendMessage === 'string' && backendMessage.trim()) {
        return backendMessage;
      }
    }

    return fallback;
  }
}
