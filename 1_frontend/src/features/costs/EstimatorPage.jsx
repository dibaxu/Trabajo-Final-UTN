import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { formatDay } from '../../lib/format.js'
import { Alert, Button, Card, ErrorAlert, PageHeader } from '../../components/ui.jsx'
import { NumericField, SelectField } from '../../components/form.jsx'
import { calculateEstimate } from './calc.js'
import { ALL_FIELDS, FIELD_GROUPS, emptyForm } from './fields.js'
import { validateForm } from './validation.js'
import { PRICE_RULES } from './priceRules.js'
import { ResultBreakdown } from './ResultPanel.jsx'
import { CostsNav } from './CostsNav.jsx'
import { useAuth } from '../auth/useAuth.js'
import { can } from '../auth/permissions.js'

const PRODUCT_FILTER = { status: 'active' }

/** Parámetros guardados (números) → textos del formulario. */
function formFromParams(params) {
  return Object.fromEntries(ALL_FIELDS.map((f) => [f.key, params[f.key] ? String(params[f.key]) : '']))
}

/** HU13: los valores vigentes precargan las tarifas del formulario. */
function defaultsFromSetting(setting) {
  if (!setting) return {}
  return {
    filamentPricePerKg: String(setting.filamentPricePerKg),
    kwhCost: String(setting.electricityPricePerKwh),
    wearPerHour: String(setting.wearCostPerHour),
    laborRate: String(setting.laborCostPerHour),
  }
}

export default function EstimatorPage() {
  const { user } = useAuth()
  // Al venir de "Usar como base" en el historial se precarga el formulario.
  const preset = useLocation().state?.preset

  // Solo se guardan los campos que la persona editó; el resto toma los valores vigentes.
  const [edited, setEdited] = useState(() => (preset ? formFromParams(preset.params) : {}))
  const [productId, setProductId] = useState(preset?.productId ? String(preset.productId) : '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedKey, setSavedKey] = useState(null)

  const products = useQuery(api.products.list, PRODUCT_FILTER)
  const setting = useQuery(api.costSettings.current)

  const form = { ...emptyForm(), ...(preset ? {} : defaultsFromSetting(setting.data)), ...edited }
  const { values, errors, valid } = validateForm(form)
  const result = valid ? calculateEstimate(values, PRICE_RULES) : null

  // Evita guardar dos veces la misma estimación sin cambios.
  const currentKey = valid ? `${productId}|${JSON.stringify(values)}` : null
  const alreadySaved = currentKey !== null && currentKey === savedKey
  const canSave = valid && result.total > 0 && productId && !saving && !alreadySaved

  function handleChange(key, value) {
    setEdited((prev) => ({ ...prev, [key]: value }))
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      await api.estimates.create({ productId: Number(productId), params: values, costSettingId: setting.data?.id ?? null })
      setSavedKey(currentKey)
    } catch (error) {
      setSaveError(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Costos"
        description="Completá los datos de la pieza para conocer su costo de fabricación y precios de venta sugeridos."
      />
      <CostsNav />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-5">
          {setting.data && (
            <Alert tone="info">
              Tarifas precargadas con la configuración vigente desde el {formatDay(setting.data.effectiveFrom.slice(0, 10))}. Podés
              cambiarlas para esta estimación sin modificar la configuración general
              {can(user, 'costSettings.manage') && (
                <>
                  {' '}
                  (<Link to="/costos/parametros" className="font-medium underline">editar parámetros</Link>)
                </>
              )}
              .
            </Alert>
          )}
          {FIELD_GROUPS.map((group) => (
            <fieldset key={group.id} className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
              <legend className="-ml-1 px-1 text-sm font-semibold text-ink-800">{group.title}</legend>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <NumericField
                    key={field.key}
                    label={field.label}
                    unit={field.unit}
                    inputMode={field.kind === 'integer' ? 'numeric' : 'decimal'}
                    placeholder="0"
                    value={form[field.key]}
                    error={errors[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                ))}
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            onClick={() => {
              setEdited({})
              setSavedKey(null)
            }}
            className="text-sm font-medium text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
          >
            Limpiar formulario
          </button>
        </form>

        <Card className="lg:sticky lg:top-24" aria-live="polite">
          {result ? (
            <ResultBreakdown result={result} />
          ) : (
            <p className="text-sm text-red-700">Corregí los campos marcados para ver el costo.</p>
          )}

          <div className="mt-6 border-t border-ink-100 pt-5">
            <h3 className="mb-2 text-sm font-semibold text-ink-700">Guardar estimación</h3>
            <SelectField label="Producto" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Seleccioná un producto…</option>
              {(products.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
            <p className="mt-1 text-xs text-ink-500">
              ¿No está en la lista?{' '}
              <Link to="/productos/nuevo" className="font-medium underline">
                Crear producto
              </Link>
            </p>

            <Button onClick={handleSave} disabled={!canSave} className="mt-4 w-full">
              {saving ? 'Guardando…' : 'Guardar estimación'}
            </Button>

            <ErrorAlert error={saveError} className="mt-2" />
            {alreadySaved && (
              <p role="status" className="mt-2 text-sm text-teal-700">
                Estimación guardada.{' '}
                <Link to="/costos/historial" className="font-medium underline">
                  Ver historial
                </Link>
              </p>
            )}
            {valid && result.total > 0 && !productId && (
              <p className="mt-2 text-xs text-ink-500">Elegí un producto para poder guardar.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
