import { Component } from '@angular/core';
import {
  ReviewSummaryService,
  SmartReviewSummary,
} from '../../../core/services/review-summary.service';

@Component({
  selector: 'app-evaluer-course',
  templateUrl: './evaluer-course.component.html',
  styleUrls: ['./evaluer-course.component.css'],
})
export class EvaluerCourseComponent {
  smartReviewSummary: SmartReviewSummary;

  constructor(private reviewSummaryService: ReviewSummaryService) {
    this.smartReviewSummary = this.reviewSummaryService.buildDemoSummary(
      'la course que vous venez de terminer',
    );
  }
}
