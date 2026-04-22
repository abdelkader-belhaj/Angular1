// src/app/event/components/mes-reservations/mes-reservations.module.ts

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MesReservationsComponent } from './mes-reservations.component';

const routes: Routes = [{ path: '', component: MesReservationsComponent }];

@NgModule({
  declarations: [MesReservationsComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
  ],
})
export class MesReservationsModule {}