import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface AssistantRequest {
  message: string;
  maxResults?: number;
}

interface PriceSuggestionRequest {
  title: string;
  description: string;
  type: string;
  categoryName?: string;
  city?: string;
  capacity?: number;
  startDate?: string;
  endDate?: string;
}

export interface AssistantResponse {
  answer: string;
  recommendedEventIds: number[];
}

export interface PriceSuggestionResponse {
  price: number;
  label: string;
  rationale: string;
  aiUsed: boolean;
}

@Injectable({ providedIn: 'root' })
export class EventAiAssistantService {
  private readonly base = 'http://localhost:8080/api/events/assistant';

  constructor(private readonly http: HttpClient) {}

  recommend(message: string, maxResults = 4): Observable<AssistantResponse> {
    const payload: AssistantRequest = { message, maxResults };
    return this.http.post<AssistantResponse>(`${this.base}/recommendations`, payload);
  }

  suggestPrice(payload: PriceSuggestionRequest): Observable<PriceSuggestionResponse> {
    return this.http.post<PriceSuggestionResponse>(`${this.base}/price-suggestion`, payload);
  }
}
