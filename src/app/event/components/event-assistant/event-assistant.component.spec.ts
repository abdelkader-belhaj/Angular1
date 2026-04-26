/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { EventAssistantComponent } from './event-assistant.component';

describe('EventAssistantComponent', () => {
  let component: EventAssistantComponent;
  let fixture: ComponentFixture<EventAssistantComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule],
      declarations: [EventAssistantComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventAssistantComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});