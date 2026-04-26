import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { PaymentPageComponent } from './payment-page.component';

const routes: Routes = [{ path: '', component: PaymentPageComponent }];

@NgModule({
  declarations: [PaymentPageComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes)],
})
export class PaymentPageModule {}