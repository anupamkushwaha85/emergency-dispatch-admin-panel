import { Client, type IFrame, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export interface LocationUpdate {
    driverId: number;
    ambulanceId: number;
    latitude: number;
    longitude: number;
    timestamp: string;
}

export interface DriverStatusUpdate {
    driverId: number;
    driverName: string;
    ambulanceId: number;
    licensePlate: string;
    status: 'ONLINE' | 'OFFLINE' | 'ON_TRIP';
    latitude: number;
    longitude: number;
    timestamp: string;
}

export interface EmergencyUpdate {
    emergencyId: number;
    emergencyType: string;
    status: string;
    latitude: number;
    longitude: number;
    assignedDriverId: number | null;
    assignedDriverName: string | null;
    event: string;
    timestamp: string;
}

type LocationHandler = (update: LocationUpdate) => void;
type DriverStatusHandler = (update: DriverStatusUpdate) => void;
type EmergencyUpdateHandler = (update: EmergencyUpdate) => void;

/**
 * WebSocket service for the admin Live Map.
 *
 * Replaces the setInterval HTTP polling in LiveMap.tsx with a persistent
 * STOMP-over-SockJS connection. The backend broadcasts a LocationUpdateDTO
 * to /topic/live-locations every time a driver calls the location update REST
 * endpoint — so the map updates in real-time without any polling overhead.
 *
 * Usage:
 *   const ws = new WebSocketService('http://localhost:8080');
 *   ws.connect(() => {
 *     ws.subscribeToLiveLocations((update) => {
 *       // update ambulance marker position
 *     });
 *   });
 *   // on component unmount:
 *   ws.disconnect();
 */
class WebSocketService {
    private client: Client | null = null;
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    connect(onConnected: () => void, onError?: (error: IFrame | string) => void): void {
        this.client = new Client({
            // SockJS factory — matches the /ws endpoint registered in WebSocketConfig.java
            webSocketFactory: () => new SockJS(`${this.baseUrl}/ws`) as WebSocket,

            reconnectDelay: 5000, // Auto-reconnect every 5 seconds on disconnect

            onConnect: () => {
                console.log('[WebSocket] Connected to STOMP broker');
                onConnected();
            },

            onStompError: (frame: IFrame) => {
                console.error('[WebSocket] STOMP error:', frame.headers['message']);
                onError?.(frame);
            },

            onDisconnect: () => {
                console.log('[WebSocket] Disconnected');
            },

            onWebSocketError: (error: Event) => {
                console.error('[WebSocket] WebSocket error:', error);
                onError?.(String(error));
            },
        });

        this.client.activate();
    }

    /**
     * Subscribe to the global live location feed.
     * Backend publishes here every time a driver sends a location update.
     *
     * @param handler Called with each LocationUpdateDTO from the backend
     * @returns Unsubscribe function
     */
    subscribeToLiveLocations(handler: LocationHandler): () => void {
        if (!this.client || !this.client.connected) {
            console.warn('[WebSocket] Cannot subscribe — not connected yet');
            return () => { };
        }

        const subscription = this.client.subscribe(
            '/topic/live-locations',
            (message: IMessage) => {
                try {
                    const update: LocationUpdate = JSON.parse(message.body);
                    handler(update);
                } catch (e) {
                    console.error('[WebSocket] Failed to parse location update:', e);
                }
            }
        );

        return () => subscription.unsubscribe();
    }

    /**
     * Subscribe to a single driver's location feed.
     * Used for tracking one specific ambulance.
     */
    subscribeToDriver(driverId: number, handler: LocationHandler): () => void {
        if (!this.client || !this.client.connected) {
            console.warn('[WebSocket] Cannot subscribe — not connected yet');
            return () => { };
        }

        const subscription = this.client.subscribe(
            `/topic/driver/${driverId}`,
            (message: IMessage) => {
                try {
                    const update: LocationUpdate = JSON.parse(message.body);
                    handler(update);
                } catch (e) {
                    console.error('[WebSocket] Failed to parse driver location update:', e);
                }
            }
        );

        return () => subscription.unsubscribe();
    }

    /**
     * Subscribe to driver status updates (ONLINE, OFFLINE, ON_TRIP).
     */
    subscribeToDriverStatus(handler: DriverStatusHandler): () => void {
        if (!this.client || !this.client.connected) {
            console.warn('[WebSocket] Cannot subscribe to driver status — not connected yet');
            return () => { };
        }

        const subscription = this.client.subscribe(
            '/topic/driver-status',
            (message: IMessage) => {
                try {
                    const update: DriverStatusUpdate = JSON.parse(message.body);
                    handler(update);
                } catch (e) {
                    console.error('[WebSocket] Failed to parse driver status update:', e);
                }
            }
        );

        return () => subscription.unsubscribe();
    }

    /**
     * Subscribe to emergency lifecycle events (CREATED, DISPATCHED, COMPLETED, etc).
     */
    subscribeToEmergencyUpdates(handler: EmergencyUpdateHandler): () => void {
        if (!this.client || !this.client.connected) {
            console.warn('[WebSocket] Cannot subscribe to emergency updates — not connected yet');
            return () => { };
        }

        const subscription = this.client.subscribe(
            '/topic/emergency-updates',
            (message: IMessage) => {
                try {
                    const update: EmergencyUpdate = JSON.parse(message.body);
                    handler(update);
                } catch (e) {
                    console.error('[WebSocket] Failed to parse emergency update:', e);
                }
            }
        );

        return () => subscription.unsubscribe();
    }

    get isConnected(): boolean {
        return this.client?.connected ?? false;
    }

    disconnect(): void {
        this.client?.deactivate();
        this.client = null;
        console.log('[WebSocket] Service disconnected');
    }
}

export default WebSocketService;
