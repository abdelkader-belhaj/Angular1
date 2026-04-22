import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { TicketComponent } from './ticket.component';

const routes: Routes = [{ path: '', component: TicketComponent }];

@NgModule({
  declarations: [TicketComponent],
  imports: [CommonModule, RouterModule.forChild(routes)],
})
export class TicketModule {}