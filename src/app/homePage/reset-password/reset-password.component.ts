import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly resetToken = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';

  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  readonly form = this.formBuilder.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  async submit(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.resetToken) {
      this.errorMessage = 'Lien de reinitialisation invalide ou incomplet.';
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.form.controls.newPassword.value !== this.form.controls.confirmPassword.value) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      return;
    }

    this.isSubmitting = true;

    try {
      await firstValueFrom(
        this.authService.resetPassword({
          token: this.resetToken,
          newPassword: this.form.controls.newPassword.value,
          confirmPassword: this.form.controls.confirmPassword.value
        })
      );

      this.successMessage = 'Mot de passe mis a jour. Vous pouvez vous connecter.';
      setTimeout(() => {
        void this.router.navigate(['/']);
      }, 1200);
    } catch (error) {
      this.errorMessage = this.extractError(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private extractError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = error.error?.message;
      if (typeof backendMessage === 'string' && backendMessage.trim().length > 0) {
        return backendMessage;
      }
    }

    return 'Impossible de reinitialiser le mot de passe pour le moment.';
  }
}
