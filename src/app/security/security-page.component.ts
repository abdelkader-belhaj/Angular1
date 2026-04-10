import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-security-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './security-page.component.html',
  styleUrl: './security-page.component.css'
})
export class SecurityPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  isSubmitting = false;
  message = '';
  error = '';

  readonly form = this.fb.nonNullable.group({
    oldPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

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
        oldPassword: this.form.controls.oldPassword.value,
        newPassword: this.form.controls.newPassword.value,
        confirmPassword: this.form.controls.confirmPassword.value
      }));

      this.message = 'Mot de passe modifie avec succes.';
      this.form.reset({ oldPassword: '', newPassword: '', confirmPassword: '' });
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
