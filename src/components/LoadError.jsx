import { useTranslation } from 'react-i18next';
export default function LoadError({ onRetry, inline = false }) {
  const { t } = useTranslation();
  return <div className={inline ? '' : 'page loading-screen'} style={inline ? { padding: 12, textAlign: 'center' } : undefined} role="alert">
    <h2>{t('error')}</h2>
    <button type="button" onClick={onRetry}>{t('popup_retry')}</button>
  </div>;
}
