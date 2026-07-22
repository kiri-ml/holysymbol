import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchCharacter, fetchCharacters } from '../api/legends';
import type { CharacterBatch } from '../api/legends';
import type { CharacterSnapshot } from '../domain/types';
import type { Notice } from './notice';

export function useCharacterRefresh({
  onNotice,
}: {
  onNotice: (notice: Notice) => void;
}) {
  const { t } = useTranslation();
  const [busyIgn, setBusyIgn] = useState<string | null>(null);

  async function loadCharacter(ign: string): Promise<CharacterSnapshot> {
    const cleanIgn = ign.trim();
    onNotice(null);
    setBusyIgn(cleanIgn);
    try {
      return await fetchCharacter(cleanIgn);
    } catch (error) {
      onNotice({
        type: 'error',
        text: error instanceof Error ? error.message : t('notice.refreshCharacterFailed'),
      });
      throw error;
    } finally {
      setBusyIgn(null);
    }
  }

  async function loadCharacters(igns: string[]): Promise<CharacterBatch> {
    onNotice(null);
    try {
      const batch = await fetchCharacters(igns);
      const refreshed = batch.snapshots.size;
      onNotice({
        type: batch.failures.length > 0 ? 'error' : 'info',
        transient: batch.failures.length === 0,
        text: batch.failures.length > 0
          ? t('notice.batchRefreshPartial', { refreshed, failed: batch.failures.length })
          : t('notice.batchRefreshSuccess', { count: refreshed }),
      });
      return batch;
    } catch (error) {
      onNotice({
        type: 'error',
        text: error instanceof Error ? error.message : t('notice.refreshCharacterFailed'),
      });
      throw error;
    }
  }

  return { busyIgn, loadCharacter, loadCharacters };
}
