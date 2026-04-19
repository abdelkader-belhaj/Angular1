import { Component } from '@angular/core';
import {
  ReviewSummaryService,
  SmartReviewSummary,
} from '../../features/transport/core/services/review-summary.service';

@Component({
  selector: 'app-chronicles-section',
  templateUrl: './chronicles-section.component.html',
  styleUrl: './chronicles-section.component.css',
})
export class ChroniclesSectionComponent {
  smartReviewSummary: SmartReviewSummary;

  constructor(private reviewSummaryService: ReviewSummaryService) {
    this.smartReviewSummary = this.reviewSummaryService.buildDemoSummary(
      'vos chroniques de voyage',
    );
  }
}
