import { op } from '../op.js'
import {
  createCostSetting,
  createEstimate,
  currentCostSetting,
  listCostSettings,
  listEstimates,
  markCurrentEstimate,
} from '../ops/costs.js'

export default {
  costSettings: {
    current: op((s) => currentCostSetting(s)),
    list: op((s) => listCostSettings(s), { permission: 'costSettings.manage' }),
    create: op((s, a, data) => createCostSetting(s, data, a.id), { permission: 'costSettings.manage', tx: true }),
  },
  estimates: {
    list: op((s, _a, filters) => listEstimates(s, filters)),
    create: op((s, a, data) => createEstimate(s, data, a.id), { tx: true }),
    setCurrent: op((s, _a, id) => markCurrentEstimate(s, id), { tx: true }),
  },
}
