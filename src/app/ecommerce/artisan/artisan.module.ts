import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { ArtisanDashboardComponent } from './pages/artisan-dashboard.component';
import { ManageProductsComponent } from './pages/manage-products.component';
import { ArtisanSalesComponent } from './pages/artisan-sales.component';

@NgModule({
  declarations: [
    ArtisanDashboardComponent,
    ManageProductsComponent,
    ArtisanSalesComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule
  ],
  exports: [
    ArtisanDashboardComponent,
    ManageProductsComponent,
    ArtisanSalesComponent
  ]
})
export class ArtisanModule { }
