import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

// Components
import { ProductsPageComponent } from './pages/products-page.component';
import { ProductDetailPageComponent } from './pages/product-detail-page.component';

// Shared
import { HomeSharedModule } from '../../homePage/home-shared.module';

@NgModule({
  declarations: [
    ProductsPageComponent,
    ProductDetailPageComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule,
    HomeSharedModule
  ]
})
export class ProductsModule { }
