export type Notice = {
  type: 'error' | 'info';
  text: string;
  transient?: boolean;
} | null;
