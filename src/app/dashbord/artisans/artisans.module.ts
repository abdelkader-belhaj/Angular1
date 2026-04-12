import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { ArtisansMonitoringComponent } from './pages/artisans-monitoring.component';
import { ArtisanDetailComponent } from './pages/artisan-detail.component';

@NgModule({
  declarations: [
    ArtisansMonitoringComponent,
    ArtisanDetailComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule
  ],
  exports: [
    ArtisansMonitoringComponent,
    ArtisanDetailComponent
  ]
})
export class ArtisansModule { }
