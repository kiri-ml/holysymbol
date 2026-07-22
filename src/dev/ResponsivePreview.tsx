import { Plus, Trash2 } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { ignKey } from '../../shared/legendsCharacters';
import type { CharacterSnapshot, LeechInstance } from '../domain/types';
import { AppTopbar } from '../app/AppTopbar';
import { QuickEstimate } from '../features/estimate';
import { DEFAULT_ESTIMATE } from '../features/estimate/estimateState';
import { RunEditor, RunRail, RunSummary } from '../features/runs';
import type { UpdateRun } from '../features/runs/runCommands';
import type { ThemeMode } from '../app/useTheme';
import { Button, IconButton } from '../ui/button';
import { ControlGroup } from '../ui/control-group';
import { NumberField, SelectField, TextField, TextInput } from '../ui/fields';
import { HeadingGroup } from '../ui/heading';
import { HelpPopover } from '../ui/help-popover';
import { CopyMesosMetric, Metric, MetricGroup } from '../ui/metric';
import { Surface } from '../ui/surface';
import styles from './ResponsivePreview.module.css';

const PREVIEW_NOW = Date.parse('2026-07-22T12:00:00.000Z');

const START_SNAPSHOT: CharacterSnapshot = {
  ign: 'PreviewMage',
  level: 120,
  expPercent: 25,
  job: 'Bishop',
  guild: 'Responsive',
  capturedAt: '2026-07-22T10:00:00.000Z',
  source: 'manual',
};

const CURRENT_SNAPSHOT: CharacterSnapshot = {
  ...START_SNAPSHOT,
  level: 123,
  expPercent: 68.5,
  capturedAt: '2026-07-22T12:00:00.000Z',
};

const RATIO_RUN: LeechInstance = {
  id: 'preview-ratio',
  name: 'Responsive ratio run',
  billing: {
    type: 'ratio',
    expPerMesoRatio: 3.3,
    tiers: [{ minLevel: 125, expPerMesoRatio: 3.1 }],
  },
  buyers: [{ id: 0, ign: 'PreviewMage', start: START_SNAPSHOT, current: CURRENT_SNAPSHOT }],
  nextBuyerId: 1,
  createdAt: '2026-07-22T09:30:00.000Z',
};

const HOURLY_RUN: LeechInstance = {
  id: 'preview-hourly',
  name: 'Responsive hourly run',
  billing: {
    type: 'hourly',
    hourlyRateMesos: 12_000_000,
    ledger: {
      status: 'paused',
      accumulatedMs: 5_400_000,
      accounts: { 0: { accruedMs: 5_400_000, active: true } },
    },
  },
  buyers: [{ id: 0, ign: 'PreviewMage', start: START_SNAPSHOT, current: CURRENT_SNAPSHOT }],
  nextBuyerId: 1,
  createdAt: '2026-07-22T08:00:00.000Z',
};


function PrimitiveGallery() {
  const [name, setName] = useState('PreviewMage');
  const [level, setLevel] = useState(120);
  const [mode, setMode] = useState('ratio');

  return (
    <div className={styles.primitiveGrid}>
      <Surface className={styles.primitiveCard}>
        <HeadingGroup eyebrow="Controls" title="Buttons and grouped input" description="Shared sizes, loading, variants, and joined focus." headingLevel={3} size="small" />
        <div className={styles.controlSamples}>
          <Button size="sm" label="Secondary" variant="secondary" />
          <Button label="Primary" icon={<Plus size={16} />} />
          <Button label="Loading" icon={<Plus size={16} />} loading />
          <IconButton variant="danger" icon={<Trash2 size={16} />} aria-label="Delete" />
        </div>
        <ControlGroup width="full">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} aria-label="Character name" />
          <Button icon={<Plus size={16} />} label="Add" />
        </ControlGroup>
      </Surface>

      <Surface className={styles.primitiveCard}>
        <HeadingGroup eyebrow="Fields" title="Accessible field states" description="Descriptions, errors, adornments, and normalized sizes." headingLevel={3} size="small" />
        <div className={styles.fieldSamples}>
          <TextField label="Character" value={name} onChange={(event) => setName(event.target.value)} description="MapleLegends IGN" />
          <NumberField label="Level" value={level} onValueChange={setLevel} min={1} max={200} error={level > 200 ? 'Maximum level is 200' : undefined} />
          <SelectField label="Billing" value={mode} onChange={(event) => setMode(event.target.value)} leading="Mode">
            <option value="ratio">Ratio</option>
            <option value="hourly">Hourly</option>
          </SelectField>
        </div>
      </Surface>

      <Surface className={styles.primitiveCard}>
        <HeadingGroup eyebrow="Data" title="Metric group" description="One divider and spacing contract for every metric layout." headingLevel={3} size="small" />
        <MetricGroup className={styles.previewMetrics} columns={3} padding="medium">
          <Metric label="Buyers" displayValue="4" detail="3 active" />
          <Metric label="EXP" displayValue="1.28b" detail="1,280,000,000" />
          <CopyMesosMetric value={48_000_000} label="Due" copiedLabel="Copied" copyAriaLabel="Copy due" copiedAriaLabel="Due copied" />
        </MetricGroup>
      </Surface>

      <Surface className={styles.primitiveCard}>
        <HeadingGroup eyebrow="Overlay" title="Help popover" description="Click, hover, focus, Escape, and outside-click behavior." headingLevel={3} size="small" />
        <HelpPopover trigger={<Button variant="secondary" label="Open help" />}>
          <p className={styles.helpCopy}>This content is available to pointer, keyboard, and touch users.</p>
        </HelpPopover>
      </Surface>
    </div>
  );
}

function PreviewFrame({ title, initialWidth, minWidth = '16rem', children, className }: {
  title: string;
  initialWidth: string;
  minWidth?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={styles.preview}>
      <div className={styles.previewHeader}>
        <h2>{title}</h2>
        <span>Drag the lower-right edge</span>
      </div>
      <div className={styles.stage}>
        <div
          className={className ? `${styles.viewport} ${className}` : styles.viewport}
          style={{ '--preview-width': initialWidth, '--preview-min-width': minWidth } as CSSProperties}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export function ResponsivePreview() {
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [estimate, setEstimate] = useState(DEFAULT_ESTIMATE);
  const [run, setRun] = useState(RATIO_RUN);
  const [selectedRunId, setSelectedRunId] = useState(RATIO_RUN.id);
  const railRuns = [RATIO_RUN, HOURLY_RUN];

  const updateRun: UpdateRun = (runId, update) => {
    setRun((current) => current.id === runId ? update(current) : current);
  };

  const loadSnapshot = async (ign: string): Promise<CharacterSnapshot> => ({
    ...CURRENT_SNAPSHOT,
    ign,
    capturedAt: new Date(PREVIEW_NOW).toISOString(),
  });

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <h1>Component-owned responsive preview</h1>
        <p>
          Development-only harness for container-query boundaries. Open with <code>?responsive-preview=1</code> and resize each component independently of the browser viewport.
        </p>
      </header>

      <div className={styles.list}>
        <PreviewFrame title="Primitive state gallery" initialWidth="70rem">
          <PrimitiveGallery />
        </PreviewFrame>

        <PreviewFrame title="App topbar" initialWidth="58rem">
          <AppTopbar theme={theme} exportDisabled={false} onThemeChange={setTheme} onExport={() => undefined} />
        </PreviewFrame>

        <PreviewFrame title="Run rail" initialWidth="16rem" minWidth="4.5rem">
          <RunRail runs={railRuns} selectedRunId={selectedRunId} now={PREVIEW_NOW} onSelect={setSelectedRunId} onAdd={() => undefined} />
        </PreviewFrame>

        <PreviewFrame title="Run editor, billing, toolbar, and buyer row" initialWidth="68rem">
          <RunEditor
            run={run}
            index={0}
            highlighted={false}
            busyIgn={null}
            now={PREVIEW_NOW}
            updateRun={updateRun}
            onDelete={() => undefined}
            onFetchSnapshot={loadSnapshot}
            onFetchSnapshots={async (igns) => ({
              snapshots: new Map(igns.map((ign) => [ignKey(ign), { ...CURRENT_SNAPSHOT, ign }])),
              failures: [],
            })}
          />
        </PreviewFrame>

        <PreviewFrame title="Run summary" initialWidth="40rem">
          <RunSummary run={run} now={PREVIEW_NOW} />
        </PreviewFrame>

        <PreviewFrame title="Quick estimate" initialWidth="28rem">
          <QuickEstimate estimate={estimate} onChange={setEstimate} />
        </PreviewFrame>
      </div>
    </main>
  );
}
