import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { OrderConfirmationPageComponent } from './pages/order-confirmation-page.component';
import { MyOrdersPageComponent } from './pages/my-orders-page.component';
import { OrderDetailPageComponent } from './pages/order-detail-page.component';

@NgModule({
  declarations: [
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
    OrderConfirmationPageComponent,
    MyOrdersPageComponent,
    OrderDetailPageComponent
  ]
})
export class OrdersModule { }
