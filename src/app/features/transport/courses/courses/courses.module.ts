// src/app/features/transport/courses/courses/courses.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common'; // ✅ Pour les pipes (number, date, etc.)
import { ReactiveFormsModule } from '@angular/forms'; // ✅ Pour les formulaires
import { GainsChauffeurComponent } from '../chauffeur/gains-chauffeur/gains-chauffeur.component';
@NgModule({
  declarations: [GainsChauffeurComponent],
  imports: [
    CommonModule, // ✅ Nécessaire pour les pipes number, date, etc.
    ReactiveFormsModule, // ✅ Nécessaire pour formGroup et formControlName
  ],
})
export class CoursesModule {}
