import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EventCardComponent } from './components/event-card/event-card.component';
import { EventAssistantComponent } from './components/event-assistant/event-assistant.component';

@NgModule({
  declarations: [
    EventCardComponent,
    EventAssistantComponent,
  ],
  imports: [CommonModule, RouterModule, FormsModule],
  exports: [
    EventCardComponent,
    EventAssistantComponent,
  ],
})
export class SharedEventModule {}