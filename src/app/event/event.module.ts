import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedEventModule } from './shared-event.module';
import { EventListComponent } from './components/event-list/event-list.component';
import { PromoEventsComponent } from './components/promo-events';

const routes: Routes = [
  { path: '', component: EventListComponent },
  { path: 'promos', component: PromoEventsComponent },
];

@NgModule({
  declarations: [EventListComponent, PromoEventsComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    SharedEventModule,
  ],
})
export class EventModule {}