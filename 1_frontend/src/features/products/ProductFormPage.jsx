import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { parseNumber } from '../../lib/numbers.js'
import { resizeImage } from '../../lib/image.js'
import { Button, Card, ErrorAlert, PageHeader, QueryState } from '../../components/ui.jsx'
import { NumericField, SelectField, TextAreaField, TextField } from '../../components/form.jsx'
import { ProductThumb } from './ProductsPage.jsx'

const NUMERIC = [
  { key: 'referenceSalePrice', label: 'Precio de referencia', unit: '$' },
  { key: 'currentCost', label: 'Costo actual', unit: '$', hint: 'Se actualiza al marcar una estimación como vigente. Cambiarlo no altera ventas anteriores.' },
  { key: 'weightGrams', label: 'Peso', unit: 'g' },
]

const toText = (n) => (n ? String(n) : '')

function ProductForm({ product }) {
  const navigate = useNavigate()
  const categories = useQuery(api.categories.list)
  const [form, setForm] = useState({
    name: product?.name ?? '',
    categoryId: product ? String(product.categoryId) : '',
    sku: product?.sku ?? '',
    description: product?.description ?? '',
    imageUrl: product?.imageUrl ?? null,
    referenceSalePrice: toText(product?.referenceSalePrice),
    currentCost: toText(product?.currentCost),
    weightGrams: toText(product?.weightGrams),
    isActive: product?.isActive ?? true,
  })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [imageError, setImageError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  async function handleImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError('')
    try {
      const imageUrl = await resizeImage(file)
      setForm((prev) => ({ ...prev, imageUrl }))
    } catch (error) {
      setImageError(error.message)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'El nombre es obligatorio.'
    if (!form.categoryId) next.categoryId = 'Seleccioná una categoría.'
    const payload = { ...form, categoryId: Number(form.categoryId) }
    for (const f of NUMERIC) {
      const raw = form[f.key].trim()
      const n = raw === '' ? 0 : parseNumber(raw)
      if (Number.isNaN(n)) next[f.key] = 'Ingresá un número válido.'
      else if (n < 0) next[f.key] = 'No puede ser negativo.'
      else payload[f.key] = n
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setApiError(null)
    try {
      if (product) await api.products.update(product.id, payload)
      else await api.products.create(payload)
      navigate('/productos')
    } catch (error) {
      setApiError(error)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <Card className="space-y-4">
        <TextField label="Nombre *" value={form.name} onChange={set('name')} error={errors.name} maxLength={100} autoFocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Categoría *" value={form.categoryId} onChange={set('categoryId')} error={errors.categoryId}>
            <option value="">Seleccioná…</option>
            {(categories.data ?? [])
              .filter((c) => c.isActive || String(c.id) === form.categoryId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </SelectField>
          <TextField label="Código interno" value={form.sku} onChange={set('sku')} maxLength={40} hint="Opcional; debe ser único." />
        </div>
        <TextAreaField label="Descripción" value={form.description} onChange={set('description')} maxLength={500} />
        <div className="grid gap-4 sm:grid-cols-3">
          {NUMERIC.map((f) => (
            <NumericField key={f.key} label={f.label} unit={f.unit} hint={f.hint} placeholder="0" value={form[f.key]} onChange={set(f.key)} error={errors[f.key]} />
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Imagen</h2>
          <div className="flex items-center gap-3">
            <ProductThumb product={{ imageUrl: form.imageUrl }} size="size-20" />
            <div className="space-y-2">
              <label className="inline-block cursor-pointer rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-medium hover:bg-ink-100">
                Elegir archivo
                <input type="file" accept="image/*" onChange={handleImage} className="sr-only" />
              </label>
              {form.imageUrl && (
                <button type="button" onClick={() => setForm((p) => ({ ...p, imageUrl: null }))} className="block text-xs text-ink-500 underline">
                  Quitar
                </button>
              )}
            </div>
          </div>
          {imageError && <p className="mt-2 text-xs text-red-700">{imageError}</p>}
        </Card>

        <Card>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="size-4 accent-brand-500"
            />
            Producto activo
          </label>
          <p className="mt-1 text-xs text-ink-500">Los inactivos no pueden usarse en nuevas ventas ni producciones.</p>
        </Card>

        <ErrorAlert error={apiError} />
        <div className="flex gap-2">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}
          </Button>
          <Link to="/productos" className="rounded-lg border border-ink-300 px-4 py-2.5 font-semibold text-ink-700 hover:bg-ink-100">
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  )
}

/** HU02 — alta y edición de producto. */
export default function ProductFormPage() {
  const { id } = useParams()
  return (
    <div>
      <PageHeader title={id ? 'Editar producto' : 'Nuevo producto'} />
      {id ? <EditLoader id={id} /> : <ProductForm />}
    </div>
  )
}

function EditLoader({ id }) {
  const query = useQuery(api.products.get, id)
  return <QueryState query={query}>{(product) => <ProductForm key={product.id} product={product} />}</QueryState>
}
