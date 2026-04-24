import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityAdminComponent } from './community-admin.component';

describe('CommunityAdminComponent', () => {
  let component: CommunityAdminComponent;
  let fixture: ComponentFixture<CommunityAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CommunityAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommunityAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
