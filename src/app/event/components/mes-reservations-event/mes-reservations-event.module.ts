// src/app/event/components/mes-reservations-event/mes-reservations-event.module.ts

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MesReservationsEventComponent } from './mes-reservations-event.component';

const routes: Routes = [{ path: '', component: MesReservationsEventComponent }];

@NgModule({
  declarations: [MesReservationsEventComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
  ],
})
export class MesReservationsEventModule {}

