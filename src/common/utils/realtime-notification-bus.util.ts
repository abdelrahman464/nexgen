export type RealtimeNotificationPayload = {
  userId: string;
  payload: any;
};

export type RealtimeNotificationListener = (event: RealtimeNotificationPayload) => void;

const listeners = new Set<RealtimeNotificationListener>();

export const registerRealtimeNotificationListener = (listener: RealtimeNotificationListener) => {
  listeners.add(listener);
  return () => unregisterRealtimeNotificationListener(listener);
};

export const unregisterRealtimeNotificationListener = (listener: RealtimeNotificationListener) => {
  listeners.delete(listener);
};

export const emitRealtimeNotification = (userId: string, payload: any) => {
  for (const listener of listeners) {
    try {
      listener({ userId, payload });
    } catch (error) {
      console.error('Error emitting realtime notification:', error);
    }
  }
};
