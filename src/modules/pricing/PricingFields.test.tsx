import { createInstance } from 'i18next';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { HourlyRateField } from './HourlyRateField';
import { RatioRateField } from './RatioRateField';

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  initAsync: false,
  resources: {
    en: {
      translation: {
        common: {
          ratioPrefix: '1 :',
          millionPerHourSpaced: 'm / hr',
        },
      },
    },
  },
});

describe('pricing fields', () => {
  it('renders ratio and hourly units as field adornments', () => {
    const markup = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <RatioRateField label="Ratio" value={3.3} onChange={() => undefined} />
        <HourlyRateField label="Hourly rate" valueMesos={12_000_000} onChangeMesos={() => undefined} />
      </I18nextProvider>,
    );

    expect(markup).toContain('>1 :</span>');
    expect(markup).toContain('>m / hr</span>');
  });
});
