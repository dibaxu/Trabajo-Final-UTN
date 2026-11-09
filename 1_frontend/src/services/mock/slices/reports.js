import { op } from '../op.js'
import { dashboard } from '../ops/reports.js'

export default {
  reports: {
    dashboard: op((s, _a, range) => dashboard(s, range), { permission: 'dashboard.view' }),
  },
}
