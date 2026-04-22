import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedEventModule } from '../../shared-event.module';
import { EventDetailComponent } from './event-detail.component';

const routes: Routes = [{ path: '', component: EventDetailComponent }];

@NgModule({
  declarations: [EventDetailComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    SharedEventModule,
  ],
})
export class EventDetailModule {}