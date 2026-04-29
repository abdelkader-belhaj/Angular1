import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Angular Material
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

// Layouts
import { LayoutClientComponent } from './layout-client/layout-client.component';
import { LayoutChauffeurComponent } from './layout-chauffeur/layout-chauffeur.component';
import { LayoutAgenceComponent } from './layout-agence/layout-agence.component';

@NgModule({
  declarations: [
   // LayoutClientComponent,
   // LayoutChauffeurComponent,
   // LayoutAgenceComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSlideToggleModule,
  ],
  exports: [
   // LayoutClientComponent,
   // LayoutChauffeurComponent,
   // LayoutAgenceComponent,
  ],
})
export class LayoutsModule {}
