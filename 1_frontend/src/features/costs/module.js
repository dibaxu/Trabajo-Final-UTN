import EstimatorPage from './EstimatorPage.jsx'
import HistoryPage from './HistoryPage.jsx'
import SettingsPage from './SettingsPage.jsx'

export default {
  id: 'costos',
  routes: [
    { path: '/costos', Component: EstimatorPage },
    { path: '/costos/historial', Component: HistoryPage },
    { path: '/costos/parametros', Component: SettingsPage, permission: 'costSettings.manage' },
  ],
  nav: { to: '/costos', label: 'Costos', order: 50 },
  // Pantalla inicial de respaldo si ningún otro módulo la reclama.
  home: { order: 90, path: () => '/costos' },
}
