export type Notice = {
  type: 'error' | 'success';
  text: string;
};

export const NOTICE_DISMISS_MS = {
  success: 3000,
  error: 5000,
} as const;
