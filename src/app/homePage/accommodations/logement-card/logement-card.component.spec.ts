import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogementCardComponent } from './logement-card.component';

describe('LogementCardComponent', () => {
  let component: LogementCardComponent;
  let fixture: ComponentFixture<LogementCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LogementCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LogementCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
