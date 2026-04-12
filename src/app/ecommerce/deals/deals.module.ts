import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { DealsPageComponent } from './pages/deals-page.component';
import { DealDetailPageComponent } from './pages/deal-detail-page.component';
import { MyFavoritesPageComponent } from './pages/my-favorites-page.component';

@NgModule({
  declarations: [
    DealsPageComponent,
    DealDetailPageComponent,
    MyFavoritesPageComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule
  ],
  exports: [
    DealsPageComponent,
    DealDetailPageComponent,
    MyFavoritesPageComponent
  ]
})
export class DealsModule { }
