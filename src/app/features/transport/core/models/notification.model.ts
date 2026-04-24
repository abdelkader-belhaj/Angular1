// src/app/features/transport/core/models/notification.model.ts

/**
 * DTO pour les notifications WebSocket envoyées aux chauffeurs
 * Correspond au backend DriverNotificationDTO
 */
export interface DriverNotificationDTO {
  type:
    | 'NEW_COURSE'
    | 'COURSE_ACCEPTED'
    | 'COURSE_CANCELLED'
    | 'ARRIVED'
    | 'PAYMENT_RECEIVED'
    | 'DEPOSIT_RELEASED'
    | string;
  message: string;
  courseId?: number;
  titre?: string;
  data?: any; // Pour NEW_COURSE: contient MatchingNotification
}

/**
 * Configuration d'une notification toast
 */
export interface ToastNotification {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  data?: any;
}

/**
 * Configuration d'une notification sonore
 */
export interface SoundNotification {
  type: 'new_ride' | 'ride_accepted' | 'message' | 'alert';
  play: boolean;
}
