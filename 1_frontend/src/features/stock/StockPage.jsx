import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { useAuth } from '../auth/useAuth.js'
import { can } from '../auth/permissions.js'
import { Badge, Button, EmptyState, PageHeader, QueryState, TableWrap, Td, Th } from '../../components/ui.jsx'
import { SelectField, TextField } from '../../components/form.jsx'
import { ProductThumb } from '../products/ProductsPage.jsx'
import { StockNav } from './StockNav.jsx'
import { ProductionModal } from './ProductionModal.jsx'
import { AdjustModal } from './AdjustModal.jsx'

/** HU05 — existencias. La cantidad no se edita acá: se produce, vende o ajusta. */
export default function StockPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState({ search: '', categoryId: '', availability: '' })
  const [modal, setModal] = useState(null) // { kind: 'production' | 'adjust', productId? }

  const stock = useQuery(api.stock.list, filters)
  const all = useQuery(api.stock.list, {})
  const categories = useQuery(api.categories.list)

  const set = (key) => (e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }))
  const refresh = () => {
    stock.reload()
    all.reload()
  }
  const closeModal = () => setModal(null)

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Existencias calculadas a partir de los movimientos de producción, venta, devolución y ajuste."
        actions={
          <>
            {can(user, 'stock.adjust') && (
              <Button variant="secondary" onClick={() => setModal({ kind: 'adjust' })}>
                Ajustar stock
              </Button>
            )}
            <Button onClick={() => setModal({ kind: 'production' })}>Registrar producción</Button>
          </>
        }
      />
      <StockNav />

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
        <SelectField label="Disponibilidad" value={filters.availability} onChange={set('availability')}>
          <option value="">Todos</option>
          <option value="available">Disponibles</option>
          <option value="out">Sin stock</option>
        </SelectField>
      </div>

      <QueryState query={stock}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="No hay productos activos que coincidan" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Producto</Th>
                  <Th>Categoría</Th>
                  <Th className="text-right">Disponible</Th>
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
                    <Td className="text-right text-lg font-semibold tabular-nums">{p.stock}</Td>
                    <Td>{p.stock > 0 ? <Badge tone="success">Disponible</Badge> : <Badge tone="danger">Sin stock</Badge>}</Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setModal({ kind: 'production', productId: p.id })}>
                          Producir
                        </Button>
                        {can(user, 'stock.movements') && (
                          <Link to={`/stock/movimientos?producto=${p.id}`} className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100">
                            Historial
                          </Link>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )
        }
      </QueryState>

      {modal?.kind === 'production' && (
        <ProductionModal products={all.data ?? []} initialProductId={modal.productId} onClose={closeModal} onDone={refresh} />
      )}
      {modal?.kind === 'adjust' && (
        <AdjustModal products={all.data ?? []} initialProductId={modal.productId} onClose={closeModal} onDone={refresh} />
      )}
    </div>
  )
}
