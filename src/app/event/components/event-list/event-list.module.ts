import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EventListComponent } from './event-list.component';
import { EventCardComponent } from '../../components/event-card/event-card.component';
import { EventAssistantComponent } from '../../components/event-assistant/event-assistant.component';

const routes: Routes = [{ path: '', component: EventListComponent }];

@NgModule({
  declarations: [EventCardComponent, EventAssistantComponent],
  imports: [CommonModule, RouterModule.forChild(routes), FormsModule]
})
export class EventListModule {}