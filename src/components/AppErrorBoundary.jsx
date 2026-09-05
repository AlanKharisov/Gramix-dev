import { Component } from 'react';
import { reportIncident } from '../services/telemetry';
import i18n from '../i18n/index.js';

export default class AppErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { reportIncident('render_error', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" style={{ minHeight: '100dvh', display: 'grid', placeContent: 'center', gap: 20, padding: 24, background: '#0E1410', color: '#fff', textAlign: 'center' }}>
      <h2>Gramix</h2>
      <p>{i18n.t('error')}</p>
      <button onClick={() => window.location.assign('/main')}>{i18n.t('popup_retry')}</button>
    </div>;
  }
}
