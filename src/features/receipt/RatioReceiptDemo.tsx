import { useMemo, useState } from 'react';
import {
  decodeRatioReceipt,
  decodeRatioReceiptPath,
  encodeRatioReceipt,
  ratioReceiptPath,
  type RatioReceipt,
} from '../../domain/ratioReceipt';
import { Panel } from '../../ui/panel';
import styles from './RatioReceiptDemo.module.css';

const DEFAULT_RECEIPT: RatioReceipt = {
  ign: 'Buyer123',
  startLevel: 120,
  startExpPercent: 25.5,
  endLevel: 121,
  endExpPercent: 10.2,
  ratio: 3.3,
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to decode receipt';
}

export function RatioReceiptDemo() {
  const [receipt, setReceipt] = useState<RatioReceipt>(DEFAULT_RECEIPT);
  const generated = useMemo(() => {
    try {
      const path = ratioReceiptPath(receipt);
      return { path, error: '' };
    } catch (error) {
      return { path: '', error: errorMessage(error) };
    }
  }, [receipt]);
  const [decodeInput, setDecodeInput] = useState(() => encodeRatioReceipt(DEFAULT_RECEIPT));
  const decoded = useMemo(() => {
    try {
      const value = decodeInput.trim();
      const pathname = value.startsWith('http://') || value.startsWith('https://')
        ? new URL(value).pathname
        : value;
      return {
        receipt: pathname.startsWith('/r1/') ? decodeRatioReceiptPath(pathname) : decodeRatioReceipt(pathname),
        error: '',
      };
    } catch (error) {
      return { receipt: undefined, error: errorMessage(error) };
    }
  }, [decodeInput]);

  function setNumber(field: keyof RatioReceipt, value: string) {
    setReceipt((current) => ({ ...current, [field]: Number(value) }));
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.intro}>
          <p>Holy Symbol · codec demo</p>
          <h1>Ratio receipt URL</h1>
          <p>Ten base64url characters hold the mixed-radix billing data and CRC-8. The IGN follows after a period.</p>
        </header>

        <div className={styles.grid}>
          <Panel className={styles.card}>
            <h2>Encode</h2>
            <div className={styles.fields}>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                IGN
                <input className={styles.input} value={receipt.ign} minLength={4} maxLength={12} pattern="[A-Za-z0-9]+" onChange={(event) => setReceipt((current) => ({ ...current, ign: event.target.value }))} />
              </label>
              <label className={styles.field}>
                Start level
                <input className={styles.input} type="number" min="1" max="200" value={receipt.startLevel} onChange={(event) => setNumber('startLevel', event.target.value)} />
              </label>
              <label className={styles.field}>
                Start EXP %
                <input className={styles.input} type="number" min="0" max="99.99" step="0.01" value={receipt.startExpPercent} onChange={(event) => setNumber('startExpPercent', event.target.value)} />
              </label>
              <label className={styles.field}>
                End level
                <input className={styles.input} type="number" min="1" max="200" value={receipt.endLevel} onChange={(event) => setNumber('endLevel', event.target.value)} />
              </label>
              <label className={styles.field}>
                End EXP %
                <input className={styles.input} type="number" min="0" max="99.99" step="0.01" value={receipt.endExpPercent} onChange={(event) => setNumber('endExpPercent', event.target.value)} />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                EXP per meso ratio
                <input className={styles.input} type="number" min="0" max="11.24" step="0.01" value={receipt.ratio} onChange={(event) => setNumber('ratio', event.target.value)} />
              </label>
            </div>
            {generated.error ? <p className={styles.error} role="alert">{generated.error}</p> : (
              <>
                <div className={styles.output}>{generated.path}</div>
                <a href={generated.path}>Open generated receipt URL</a>
              </>
            )}
          </Panel>

          <Panel className={styles.card}>
            <h2>Decode</h2>
            <label className={styles.field}>
              Receipt payload, path, or URL
              <input className={styles.input} value={decodeInput} onChange={(event) => setDecodeInput(event.target.value)} />
            </label>
            {decoded.error ? <p className={styles.error} role="alert">{decoded.error}</p> : decoded.receipt ? (
              <dl className={styles.receipt}>
                <div><dt>IGN</dt><dd>{decoded.receipt.ign}</dd></div>
                <div><dt>Ratio</dt><dd>1:{decoded.receipt.ratio.toFixed(2)}</dd></div>
                <div><dt>Start</dt><dd>Lv. {decoded.receipt.startLevel} · {decoded.receipt.startExpPercent.toFixed(2)}%</dd></div>
                <div><dt>End</dt><dd>Lv. {decoded.receipt.endLevel} · {decoded.receipt.endExpPercent.toFixed(2)}%</dd></div>
              </dl>
            ) : null}
            <p className={styles.hint}>Try changing one character. The CRC covers both the encoded billing data and the IGN.</p>
          </Panel>
        </div>
      </div>
    </main>
  );
}
