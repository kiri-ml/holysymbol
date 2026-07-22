import { useTranslation } from 'react-i18next';
import { AppTopbar } from './app/AppTopbar';
import { NoticeBanner } from './app/NoticeBanner';
import styles from './app/App.module.css';
import { useCharacterRefresh } from './app/useCharacterRefresh';
import { useNotice } from './app/useNotice';
import { useTheme } from './app/useTheme';
import { QuickEstimate, useQuickEstimate } from './features/estimate';
import { downloadRunsCsv, RunEditor, RunRail, RunSummary, useLiveNow, useRunWorkspace } from './features/runs';

export default function App() {
  const { t } = useTranslation();
  const workspace = useRunWorkspace();
  const [estimate, setEstimate] = useQuickEstimate();
  const [theme, setTheme] = useTheme();
  const notices = useNotice();
  const characters = useCharacterRefresh({ onNotice: notices.showNotice });
  const now = useLiveNow(workspace.runs);
  const selectedRun = workspace.selectedRun;

  return (
    <main className={styles.shell}>
      <AppTopbar theme={theme} exportDisabled={workspace.runs.length === 0} onThemeChange={setTheme} onExport={() => downloadRunsCsv(workspace.runs, t, now)} />
      <NoticeBanner notice={notices.notice} onDismiss={notices.dismissNotice} />

      <div className={styles.layout}>
        <div className={styles.rail}>
          <RunRail runs={workspace.displayedRuns} selectedRunId={selectedRun?.id ?? null} now={now} onSelect={workspace.selectRun} onAdd={() => workspace.addRun(selectedRun)} />
        </div>

        <div className={styles.content}>
          <section className={styles.ledger} aria-label={t('run.selectedLedger')}>
            {selectedRun ? (
              <RunEditor
                key={selectedRun.id}
                run={selectedRun}
                index={workspace.selectedRunIndex}
                highlighted={selectedRun.id === workspace.highlightedRunId}
                busyIgn={characters.busyIgn}
                now={now}
                updateRun={workspace.updateRun}
                onDelete={() => { void workspace.deleteRun(selectedRun); }}
                onFetchSnapshot={characters.loadCharacter}
                onFetchSnapshots={characters.loadCharacters}
              />
            ) : null}
          </section>

          <aside className={styles.tools}>
            {selectedRun ? <RunSummary run={selectedRun} now={now} /> : null}
            <QuickEstimate estimate={estimate} onChange={setEstimate} />
          </aside>
        </div>
      </div>
    </main>
  );
}
