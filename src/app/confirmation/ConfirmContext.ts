import { createContext } from 'react';
import type { Confirm } from './confirmation';

export const ConfirmContext = createContext<Confirm | null>(null);
