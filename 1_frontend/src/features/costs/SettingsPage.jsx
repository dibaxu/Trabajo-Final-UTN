import { useState } from 'react'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { parseNumber } from '../../lib/numbers.js'
import { formatDate, formatMoney } from '../../lib/format.js'
import { Alert, Badge, Button, Card, ErrorAlert, PageHeader, QueryState, TableWrap, Td, Th } from '../../components/ui.jsx'
import { NumericField } from '../../components/form.jsx'
import { DateField } from '../../components/DateField.jsx'
import { CostsNav } from './CostsNav.jsx'

const FIELDS = [
  { key: 'filamentPricePerKg', label: 'Precio del filamento', unit: '$ / kg' },
  { key: 'electricityPricePerKwh', label: 'Costo de la electricidad', unit: '$ / kWh' },
  { key: 'wearCostPerHour', label: 'Desgaste de la impresora', unit: '$ / h' },
  { key: 'laborCostPerHour', label: 'Valor de la hora de trabajo', unit: '$ / h' },
]

/** HU13 — Parámetros de costos con fecha de vigencia (solo administrador). */
export default function SettingsPage() {
  const settings = useQuery(api.costSettings.list)
  const [form, setForm] = useState({})
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [done, setDone] = useState(false)

  const latest = settings.data?.[0]
  // Sin ediciones, el formulario parte de la configuración más reciente.
  const value = (key) => form[key] ?? (latest ? String(latest[key]) : '')

  async function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    const payload = {}
    for (const f of FIELDS) {
      const n = parseNumber(value(f.key))
      if (Number.isNaN(n)) next[f.key] = 'Ingresá un número válido.'
      else if (n < 0) next[f.key] = 'No puede ser negativo.'
      else payload[f.key] = n
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setApiError(null)
    setDone(false)
    try {
      await api.costSettings.create({ ...payload, effectiveFrom: effectiveFrom ? new Date(`${effectiveFrom}T00:00:00`).toISOString() : undefined })
      setForm({})
      setEffectiveFrom('')
      setDone(true)
      settings.reload()
    } catch (error) {
      setApiError(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Costos"
        description="Valores que el estimador carga por defecto. Una configuración nueva no elimina las anteriores y las estimaciones históricas conservan los valores que usaron."
      />
      <CostsNav />

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
        <Card>
          <h2 className="mb-4 font-semibold">Nueva configuración</h2>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {FIELDS.map((f) => (
              <NumericField
                key={f.key}
                label={f.label}
                unit={f.unit}
                value={value(f.key)}
                error={errors[f.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            ))}
            <DateField
              label="Vigente desde"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              hint="Si lo dejás vacío, rige desde ahora."
            />
            <ErrorAlert error={apiError} />
            {done && <Alert tone="success">Configuración guardada.</Alert>}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Guardando…' : 'Guardar configuración'}
            </Button>
          </form>
        </Card>

        <QueryState query={settings}>
          {(list) => (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Vigente desde</Th>
                  <Th className="text-right">Filamento/kg</Th>
                  <Th className="text-right">kWh</Th>
                  <Th className="text-right">Desgaste/h</Th>
                  <Th className="text-right">Mano de obra/h</Th>
                  <Th>Cargada por</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => (
                  <tr key={c.id}>
                    <Td>
                      {formatDate(c.effectiveFrom)} {i === 0 && <Badge tone="success">Vigente</Badge>}
                    </Td>
                    <Td className="text-right tabular-nums">{formatMoney(c.filamentPricePerKg)}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(c.electricityPricePerKwh)}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(c.wearCostPerHour)}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(c.laborCostPerHour)}</Td>
                    <Td>{c.createdByName}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </QueryState>
      </div>
    </div>
  )
}
