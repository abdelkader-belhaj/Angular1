import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { DealsPageComponent } from './pages/deals-page.component';
import { DealDetailPageComponent } from './pages/deal-detail-page.component';
import { MyFavoritesPageComponent } from './pages/my-favorites-page.component';
import { CustomSelectComponent } from './pages/custom-select.component';

@NgModule({
  declarations: [
    DealsPageComponent,
    DealDetailPageComponent,
    MyFavoritesPageComponent,
    CustomSelectComponent
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
    MyFavoritesPageComponent,
    CustomSelectComponent
  ]
})
export class DealsModule { }
