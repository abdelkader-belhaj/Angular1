// src/app/features/transport/core/services/websocket.service.ts
import { Injectable, NgZone } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import SockJS from 'sockjs-client';
import { ApiService } from './api.service';
import {
  LocationUpdateDTO,
  ChatMessageDTO,
  DriverNotificationDTO,
  MatchingNotification,
} from '../models';

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private readonly debugWs = true;
  private stompClient: Client | null = null;
  private connected = new BehaviorSubject<boolean>(false);
  public connected$ = this.connected.asObservable();

  private locationUpdateSubject = new Subject<LocationUpdateDTO>();
  private chatMessageSubject = new Subject<ChatMessageDTO>();
  private driverNotificationSubject = new Subject<DriverNotificationDTO>();
  private matchingNotificationSubject = new Subject<MatchingNotification>();

  private subscriptions: StompSubscription[] = [];

  constructor(
    private api: ApiService,
    private ngZone: NgZone,
  ) {}

  /** Connexion WebSocket (appelée par chauffeur ET client) */
  connect(userId?: number): void {
    if (this.stompClient?.active) return;

    const token = localStorage.getItem('auth_token');

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws-transport'),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},

      onConnect: () => {
        console.log('✅ WebSocket Transport connecté');
        this.ngZone.run(() => this.connected.next(true));
        if (userId) this.subscribeToUserChannels(userId);
      },
      onDisconnect: () => this.ngZone.run(() => this.connected.next(false)),
      onStompError: (frame) => {
        console.error('❌ STOMP Error:', frame);
        this.ngZone.run(() => this.connected.next(false));
      },
    });

    this.stompClient.activate();
  }

  disconnect(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
    this.stompClient?.deactivate();
    this.connected.next(false);
  }

  /** Méthode générique utilisée par tous tes composants */
  subscribe(
    topic: string,
    callback: (message: IMessage) => void,
  ): StompSubscription {
    if (!this.stompClient?.active) {
      console.warn('WebSocket not connected yet');
      return {} as StompSubscription;
    }

    const sub = this.stompClient.subscribe(topic, (msg: IMessage) => {
      this.ngZone.run(() => callback(msg));
    });
    this.subscriptions.push(sub);
    return sub;
  }

  /** Canaux spécifiques pour un chauffeur */
  private subscribeToUserChannels(chauffeurId: number): void {
    const handleNotification = (message: IMessage) => {
      const notif: DriverNotificationDTO = JSON.parse(message.body);
      if (this.debugWs) {
        console.log('[WS DEBUG] notification raw body', message.body);
        console.log('[WS DEBUG] notification parsed', notif);
      }
      this.driverNotificationSubject.next(notif);

      if (notif.type === 'NEW_COURSE' && notif.data) {
        this.matchingNotificationSubject.next(
          notif.data as MatchingNotification,
        );
      }
    };

    // Notifications ciblées par utilisateur via convertAndSendToUser
    this.subscribe('/user/queue/notifications', handleNotification);

    // Fallback si le backend diffuse directement sur /queue/notifications
    this.subscribe('/queue/notifications', handleNotification);

    // Fallback ciblé par identifiant utilisateur (si principal STOMP non résolu).
    this.subscribe(
      `/topic/user/${chauffeurId}/notifications`,
      handleNotification,
    );
  }

  // Méthodes spécifiques (tu peux continuer à les utiliser)
  subscribeToCourseChat(courseId: number): void {
    this.subscribe(`/topic/course/${courseId}/chat`, (msg) =>
      this.chatMessageSubject.next(JSON.parse(msg.body)),
    );
  }

  subscribeToCourseLocation(courseId: number): void {
    this.subscribe(`/topic/course/${courseId}/location`, (msg) =>
      this.locationUpdateSubject.next(JSON.parse(msg.body)),
    );
  }

  // Émission
  sendLocationUpdate(update: LocationUpdateDTO): void {
    this.stompClient?.publish({
      destination: '/app/location/update',
      body: JSON.stringify(update),
    });
  }

  sendChatMessage(message: ChatMessageDTO): void {
    this.stompClient?.publish({
      destination: '/app/chat/send',
      body: JSON.stringify(message),
    });
  }

  // Observables publics
  get locationUpdates$(): Observable<LocationUpdateDTO> {
    return this.locationUpdateSubject.asObservable();
  }

  get chatMessages$(): Observable<ChatMessageDTO> {
    return this.chatMessageSubject.asObservable();
  }

  get driverNotifications$(): Observable<DriverNotificationDTO> {
    return this.driverNotificationSubject.asObservable();
  }

  get matchingNotifications$(): Observable<MatchingNotification> {
    return this.matchingNotificationSubject.asObservable();
  }
}
