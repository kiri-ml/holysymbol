import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { Modal } from '../../ui/modal';
import type { ConfirmOptions } from './confirmation';

export function ConfirmDialog({ options, onCancel, onConfirm }: {
  options: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal
      title={options.title ?? t('confirm.title')}
      description={options.message}
      onDismiss={onCancel}
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel} label={options.cancelLabel ?? t('confirm.cancel')} />
          <Button variant={options.tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} label={options.confirmLabel ?? t('confirm.confirm')} />
        </>
      )}
    />
  );
}
