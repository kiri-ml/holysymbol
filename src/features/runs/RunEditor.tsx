import type { CharacterBatch } from '../../api/legends';
import type { CharacterSnapshot, LeechInstance } from '../../domain/types';
import { Panel } from '../../ui/panel';
import { RunBillingEditor } from './billing/RunBillingEditor';
import { BuyersEditor } from './buyers/BuyersEditor';
import styles from './RunEditor.module.css';
import { RunHeader } from './RunHeader';
import type { UpdateRun } from './runCommands';
import { createRunController } from './runController';

export function RunEditor({
  run,
  index,
  highlighted,
  busyIgn,
  now,
  updateRun,
  onDelete,
  onFetchSnapshot,
  onFetchSnapshots,
}: {
  run: LeechInstance;
  index: number;
  highlighted: boolean;
  busyIgn: string | null;
  now: number;
  updateRun: UpdateRun;
  onDelete: () => void;
  onFetchSnapshot: (ign: string) => Promise<CharacterSnapshot>;
  onFetchSnapshots: (igns: string[]) => Promise<CharacterBatch>;
}) {
  const controller = createRunController({
    run,
    updateRun,
    fetchSnapshot: onFetchSnapshot,
    fetchSnapshots: onFetchSnapshots,
  });

  return (
    <Panel className={styles.root} highlighted={highlighted}>
      <RunHeader
        run={run}
        index={index}
        onRename={controller.rename}
        onChangeBillingType={controller.billing.changeType}
        onDelete={onDelete}
      />
      <RunBillingEditor
        billing={run.billing}
        now={now}
        controller={controller.billing}
      />
      <BuyersEditor
        run={run}
        now={now}
        busyIgn={busyIgn}
        controller={controller.buyers}
      />
    </Panel>
  );
}
