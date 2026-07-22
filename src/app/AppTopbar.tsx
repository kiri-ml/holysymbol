import { Download, Languages, Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { setLanguagePreference } from '../i18n';
import { DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES } from '../i18n/locales';
import { Button } from '../ui/button';
import { classNames } from '../ui/classNames';
import { SelectField } from '../ui/fields';
import { HeadingGroup } from '../ui/heading';
import { SegmentedControl } from '../ui/segmented-control';
import { Surface } from '../ui/surface';
import styles from './AppTopbar.module.css';
import type { ThemeMode } from './useTheme';

function ThemeSwitch({ theme, onChange }: { theme: ThemeMode; onChange: (theme: ThemeMode) => void }) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      value={theme}
      className={styles.theme}
      ariaLabel={t('theme.label')}
      collapseLabels="low"
      onChange={onChange}
      options={[
        { value: 'light', label: t('theme.light'), icon: <Sun size={15} /> },
        { value: 'system', label: t('theme.system'), icon: <Monitor size={15} /> },
        { value: 'dark', label: t('theme.dark'), icon: <Moon size={15} /> },
      ]}
    />
  );
}

function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const selectedLanguage = isSupportedLocale(i18n.resolvedLanguage ?? '') ? i18n.resolvedLanguage : isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
  return (
    <SelectField
      className={styles.language}
      inputClassName={styles.languageSelect}
      label={t('language.label')}
      labelVisibility="screen-reader"
      leading={<Languages size={15} />}
      value={selectedLanguage}
      onChange={(event) => { if (isSupportedLocale(event.target.value)) void setLanguagePreference(event.target.value); }}
    >
      {SUPPORTED_LOCALES.map((locale) => <option key={locale.code} value={locale.code}>{locale.label}</option>)}
    </SelectField>
  );
}

export function AppTopbar({ theme, exportDisabled, onThemeChange, onExport }: { theme: ThemeMode; exportDisabled: boolean; onThemeChange: (theme: ThemeMode) => void; onExport: () => void }) {
  const { t } = useTranslation();
  return (
    <header className={styles.container}>
      <Surface className={styles.root} padding="small">
        <div className={styles.brand}>
          <img src="/assets/icons/hs.png" alt="" className={styles.logo} />
          <HeadingGroup className={styles.brandHeading} title={t('app.name')} description={t('app.tagline')} headingLevel={1} size="small" />
        </div>
        <div className={styles.actions}>
          <ThemeSwitch theme={theme} onChange={onThemeChange} />
          <LanguageSelect />
          <Button
            variant="secondary"
            className={classNames(styles.control, styles.export)}
            onClick={onExport}
            disabled={exportDisabled}
            icon={<Download size={16} />}
            label={t('topbar.exportCsv')}
            labelMode="responsive"
            collapsePriority="high"
          />
        </div>
      </Surface>
    </header>
  );
}
