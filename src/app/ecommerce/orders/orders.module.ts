import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { CartPageComponent } from './pages/cart-page.component';
import { CheckoutPageComponent } from './pages/checkout-page.component';
import { OrderConfirmationPageComponent } from './pages/order-confirmation-page.component';
import { MyOrdersPageComponent } from './pages/my-orders-page.component';
import { OrderDetailPageComponent } from './pages/order-detail-page.component';

@NgModule({
  declarations: [
    CartPageComponent,
    CheckoutPageComponent,
    OrderConfirmationPageComponent,
    MyOrdersPageComponent,
    OrderDetailPageComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule
  ],
  exports: [
    CartPageComponent,
    CheckoutPageComponent,
    OrderConfirmationPageComponent,
    MyOrdersPageComponent,
    OrderDetailPageComponent
  ]
})
export class OrdersModule { }
