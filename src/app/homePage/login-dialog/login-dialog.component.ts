import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-dialog',
  templateUrl: './login-dialog.component.html',
  styleUrl: './login-dialog.component.css'
})
export class LoginDialogComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();

  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  mode: 'login' | 'register' | 'forgot' = 'login';
  roleDialogOpen = false;
  loginError = '';
  registerError = '';
  forgotError = '';
  forgotSuccess = '';
  isSubmitting = false;

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [true]
  });

  readonly registerForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]],
    role: ['CLIENT_TOURISTE', [Validators.required]],
    phone: ['']
  });

  readonly forgotForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  readonly roleOptions: Array<{ value: string; label: string; description: string }> = [
    { value: 'CLIENT_TOURISTE', label: 'Client Touriste', description: 'Compte voyageur et reservation' },
    { value: 'HEBERGEUR', label: 'Hebergeur', description: 'Gestion des hebergements' },
    { value: 'TRANSPORTEUR', label: 'Transporteur', description: 'Services de transport' },
    { value: 'AIRLINE_PARTNER', label: 'Airline Partner', description: 'Partenaire compagnie aerienne' },
    { value: 'ORGANISATEUR', label: 'Organisateur', description: 'Evenements et experiences' },
    { value: 'VENDEUR_ARTI', label: 'Vendeur Artisan', description: 'Produits artisanaux' },
    { value: 'SOCIETE', label: 'Societe', description: 'Compte entreprise' },
    { value: 'ADMIN', label: 'Admin', description: 'Administration globale' }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      document.body.classList.toggle('dialog-open', this.isOpen);
    }
  }

  ngOnDestroy(): void {
    document.body.classList.remove('dialog-open');
  }

  close(): void {
    this.mode = 'login';
    this.roleDialogOpen = false;
    this.loginError = '';
    this.registerError = '';
    this.forgotError = '';
    this.forgotSuccess = '';
    this.loginForm.markAsPristine();
    this.registerForm.markAsPristine();
    this.forgotForm.markAsPristine();
    this.closed.emit();
  }

  switchMode(mode: 'login' | 'register' | 'forgot'): void {
    this.mode = mode;
    this.roleDialogOpen = false;
    this.loginError = '';
    this.registerError = '';
    this.forgotError = '';
    this.forgotSuccess = '';

    if (mode === 'forgot') {
      this.forgotForm.patchValue({ email: this.loginForm.controls.email.value });
    }
  }

  openRoleDialog(): void {
    this.roleDialogOpen = true;
  }

  closeRoleDialog(): void {
    this.roleDialogOpen = false;
  }

  chooseRole(role: string): void {
    this.registerForm.controls.role.setValue(role);
    this.registerForm.controls.role.markAsDirty();
    this.closeRoleDialog();
  }

  get selectedRoleLabel(): string {
    const selected = this.roleOptions.find((role) => role.value === this.registerForm.controls.role.value);
    return selected ? selected.label : 'Choisir un role';
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('login-backdrop')) {
      this.close();
    }
  }

  async submitLogin(): Promise<void> {
    this.loginError = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    try {
      const auth = await firstValueFrom(
        this.authService.login({
          email: this.loginForm.controls.email.value,
          password: this.loginForm.controls.password.value
        })
      );

      if (this.authService.isPendingApproval(auth.user)) {
        await this.router.navigate(['/waiting-approval']);
      } else {
        const targetRoute = this.authService.getRouteForRole(auth.user?.role);
        await this.router.navigate([targetRoute]);
      }

      this.close();
    } catch (err: any) {
      this.loginError = err?.error?.message || 'Erreur de connexion';
    } finally {
      this.isSubmitting = false;
    }
  }

  private extractLoginError(error: unknown): string {
    return this.extractAuthError(error, 'Une erreur est survenue. Veuillez reessayer.');
  }

  private extractAuthError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = error.error?.message;
      if (typeof backendMessage === 'string' && backendMessage.trim().length > 0) {
        return backendMessage;
      }

      if (error.status === 401 || error.status === 403) {
        return 'Email ou mot de passe incorrect.';
      }
    }

    return fallback;
  }

  async submitRegister(): Promise<void> {
    this.registerError = '';

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    if (this.registerForm.controls.password.value !== this.registerForm.controls.confirmPassword.value) {
      this.registerError = 'Les mots de passe ne correspondent pas.';
      return;
    }

    this.isSubmitting = true;

    try {
      await firstValueFrom(
        this.authService.register({
          username: this.registerForm.controls.username.value,
          email: this.registerForm.controls.email.value,
          password: this.registerForm.controls.password.value,
          role: this.registerForm.controls.role.value
        })
      );

      this.switchMode('login');
      this.loginForm.patchValue({
        email: this.registerForm.controls.email.value,
        password: ''
      });
    } catch (error) {
      this.registerError = this.extractAuthError(error, 'Impossible de creer le compte pour le moment.');
    } finally {
      this.isSubmitting = false;
    }
  }

  async submitForgotPassword(): Promise<void> {
    this.forgotError = '';
    this.forgotSuccess = '';

    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    try {
      await firstValueFrom(
        this.authService.forgotPassword({
          email: this.forgotForm.controls.email.value
        })
      );

      this.forgotSuccess = 'Si cet email existe, un lien de reinitialisation a ete envoye.';
    } catch (error) {
      this.forgotError = this.extractAuthError(error, 'Impossible d envoyer le lien pour le moment.');
    } finally {
      this.isSubmitting = false;
    }
  }
}
