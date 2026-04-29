// src/app/features/transport/shared/shared.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

// Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';

// Shared Components
import { CarteInteractiveComponent } from './components/carte-interactive/carte-interactive.component';
import { CarteChauffeurComponent } from './components/carte-chauffeur/carte-chauffeur.component';
import { CarteVehiculeComponent } from './components/carte-vehicule/carte-vehicule.component';
import { ChatTempsReelComponent } from './components/chat-temps-reel/chat-temps-reel.component';
import { BadgeStatutComponent } from './components/badge-statut/badge-statut.component';
import { EtoilesNotationComponent } from './components/etoiles-notation/etoiles-notation.component';
import { EstimationPrixComponent } from './components/estimation-prix/estimation-prix.component';
import { SignatureCanvasComponent } from './components/signature-canvas/signature-canvas.component';
import { TimelineVerticalComponent } from './components/timeline-vertical/timeline-vertical.component';
import { UploadPhotosComponent } from './components/upload-photos/upload-photos.component';

@NgModule({
  declarations: [
    CarteInteractiveComponent,
    CarteChauffeurComponent,
    CarteVehiculeComponent,
    ChatTempsReelComponent,
    BadgeStatutComponent,
    EtoilesNotationComponent,
    EstimationPrixComponent,
    SignatureCanvasComponent,
    TimelineVerticalComponent,
    UploadPhotosComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatMenuModule,
  ],
  exports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    // Components
    CarteInteractiveComponent,
    CarteChauffeurComponent,
    CarteVehiculeComponent,
    ChatTempsReelComponent,
    BadgeStatutComponent,
    EtoilesNotationComponent,
    EstimationPrixComponent,
    SignatureCanvasComponent,
    TimelineVerticalComponent,
    UploadPhotosComponent,
  ],
})
export class SharedModule {}
