import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { formatMoney } from '../../lib/format.js'
import { Badge, Button, EmptyState, ErrorAlert, PageHeader, QueryState, TableWrap, Td, Th } from '../../components/ui.jsx'
import { SelectField, TextField } from '../../components/form.jsx'
import { CategoriesModal } from './CategoriesModal.jsx'

export function ProductThumb({ product, size = 'size-10' }) {
  return product.imageUrl ? (
    <img src={product.imageUrl} alt="" className={`${size} rounded-lg border border-ink-200 object-cover`} />
  ) : (
    <div className={`${size} flex items-center justify-center rounded-lg bg-ink-100 text-xs text-ink-400`} aria-hidden="true">
      3D
    </div>
  )
}

/** HU02 — catálogo con filtros por nombre/código, categoría y estado. */
export default function ProductsPage() {
  const [filters, setFilters] = useState({ search: '', categoryId: '', status: '' })
  const [showCategories, setShowCategories] = useState(false)
  const [actionError, setActionError] = useState(null)
  const products = useQuery(api.products.list, filters)
  const categories = useQuery(api.categories.list)

  const set = (key) => (e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }))

  async function toggleActive(p) {
    setActionError(null)
    try {
      await api.products.update(p.id, { ...p, isActive: !p.isActive })
      products.reload()
    } catch (error) {
      setActionError(error)
    }
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        description="Catálogo del emprendimiento. Los productos con operaciones históricas no se eliminan: se desactivan."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowCategories(true)}>
              Categorías
            </Button>
            <Link to="/productos/nuevo" className="rounded-lg bg-brand-500 px-4 py-2.5 font-semibold text-white hover:bg-brand-600">
              Nuevo producto
            </Link>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <TextField label="Buscar" placeholder="Nombre o código" value={filters.search} onChange={set('search')} />
        <SelectField label="Categoría" value={filters.categoryId} onChange={set('categoryId')}>
          <option value="">Todas</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Estado" value={filters.status} onChange={set('status')}>
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </SelectField>
      </div>
      <ErrorAlert error={actionError} className="mb-3" />

      <QueryState query={products}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="No hay productos que coincidan">
              <Link to="/productos/nuevo" className="font-medium text-brand-700 underline">
                Crear un producto
              </Link>
            </EmptyState>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Producto</Th>
                  <Th>Categoría</Th>
                  <Th className="text-right">Precio ref.</Th>
                  <Th className="text-right">Costo actual</Th>
                  <Th className="text-right">Stock</Th>
                  <Th>Estado</Th>
                  <Th>
                    <span className="sr-only">Acciones</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <ProductThumb product={p} />
                        <div>
                          <p className="font-medium">{p.name}</p>
                          {p.sku && <p className="text-xs text-ink-500">{p.sku}</p>}
                        </div>
                      </div>
                    </Td>
                    <Td>{p.categoryName}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(p.referenceSalePrice)}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(p.currentCost)}</Td>
                    <Td className="text-right tabular-nums">{p.stock}</Td>
                    <Td>{p.isActive ? <Badge tone="success">Activo</Badge> : <Badge>Inactivo</Badge>}</Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <Link to={`/productos/${p.id}`} className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-medium hover:bg-ink-100">
                          Editar
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(p)}>
                          {p.isActive ? 'Desactivar' : 'Activar'}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )
        }
      </QueryState>

      {showCategories && (
        <CategoriesModal
          onClose={() => setShowCategories(false)}
          onChanged={() => {
            categories.reload()
            products.reload()
          }}
        />
      )}
    </div>
  )
}
