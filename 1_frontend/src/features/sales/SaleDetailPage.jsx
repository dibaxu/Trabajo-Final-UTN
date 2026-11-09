import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { useAuth } from '../auth/useAuth.js'
import { can } from '../auth/permissions.js'
import { formatDateTime, formatMoney } from '../../lib/format.js'
import { Alert, Badge, Button, Card, PageHeader, QueryState, TableWrap, Td, Th } from '../../components/ui.jsx'
import { CancelSaleModal } from './CancelSaleModal.jsx'
import { ReturnModal } from './ReturnModal.jsx'
import { STATUS_META, TYPE_LABELS } from './saleMeta.js'

export default function SaleDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const justCreated = useLocation().state?.justCreated
  const sale = useQuery(api.sales.get, id)
  const [modal, setModal] = useState(null)

  return (
    <QueryState query={sale}>
      {(s) => {
        const meta = STATUS_META[s.status]
        const canCancel = can(user, 'sales.cancel') && s.status === 'CONFIRMADA'
        const canReturn = can(user, 'sales.return') && ['CONFIRMADA', 'PARCIALMENTE_DEVUELTA'].includes(s.status)
        return (
          <div>
            <PageHeader
              title={`Venta #${s.id}`}
              description={`${formatDateTime(s.soldAt)} · ${TYPE_LABELS[s.saleType]} · registrada por ${s.createdByName}`}
              actions={
                <>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  {canReturn && <Button variant="secondary" onClick={() => setModal('return')}>Registrar devolución</Button>}
                  {canCancel && <Button variant="danger" onClick={() => setModal('cancel')}>Anular venta</Button>}
                </>
              }
            />

            {justCreated && <Alert tone="success" className="mb-4">Venta confirmada y stock actualizado.</Alert>}
            {s.status === 'ANULADA' && (
              <Alert tone="error" className="mb-4">
                Anulada el {formatDateTime(s.cancelledAt)} por {s.cancelledByName}. Motivo: {s.cancellationReason}
              </Alert>
            )}

            <TableWrap>
              <thead>
                <tr>
                  <Th>Producto</Th>
                  <Th className="text-right">Cant.</Th>
                  <Th className="text-right">Devueltas</Th>
                  <Th className="text-right">Precio</Th>
                  <Th className="text-right">Costo</Th>
                  <Th>Origen del costo</Th>
                  <Th className="text-right">Subtotal</Th>
                  <Th className="text-right">Margen</Th>
                </tr>
              </thead>
              <tbody>
                {s.items.map((i) => (
                  <tr key={i.id}>
                    <Td className="font-medium">{i.productName}</Td>
                    <Td className="text-right tabular-nums">{i.quantity}</Td>
                    <Td className="text-right tabular-nums">{i.returnedQuantity || '—'}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(i.unitPrice)}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(i.unitCost)}</Td>
                    <Td>{i.costSource === 'ESTIMACION' ? 'Estimación' : 'Manual'}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(i.lineTotal)}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(i.lineMargin)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <Td colSpan={6} className="text-right">Total</Td>
                  <Td className="text-right tabular-nums">{formatMoney(s.totalAmount)}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(s.grossMargin)}</Td>
                </tr>
              </tfoot>
            </TableWrap>

            {s.notes && <p className="mt-3 text-sm text-ink-600">Notas: {s.notes}</p>}

            {s.returns.length > 0 && (
              <Card className="mt-6">
                <h2 className="mb-3 font-semibold">Devoluciones</h2>
                <ul className="space-y-3 text-sm">
                  {s.returns.map((r) => (
                    <li key={r.id}>
                      <p className="font-medium">
                        #{r.id} · {formatDateTime(r.returnedAt)} · {r.createdByName}
                      </p>
                      <p className="text-ink-600">
                        {r.items.map((ri) => `${ri.quantity} × ${s.items.find((i) => i.id === ri.saleItemId)?.productName}`).join(', ')}
                      </p>
                      <p className="text-ink-500">Motivo: {r.reason}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="mt-6">
              <Link to="/ventas" className="text-sm font-medium text-ink-600 underline">← Volver a ventas</Link>
            </div>

            {modal === 'cancel' && <CancelSaleModal sale={s} onClose={() => setModal(null)} onDone={sale.reload} />}
            {modal === 'return' && <ReturnModal sale={s} onClose={() => setModal(null)} onDone={sale.reload} />}
          </div>
        )
      }}
    </QueryState>
  )
}
