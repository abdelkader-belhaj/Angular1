import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForumConditionsModalComponent } from './forum-conditions-modal.component';

describe('ForumConditionsModalComponent', () => {
  let component: ForumConditionsModalComponent;
  let fixture: ComponentFixture<ForumConditionsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ForumConditionsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ForumConditionsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
