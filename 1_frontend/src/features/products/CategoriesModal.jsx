import { useState } from 'react'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { Badge, Button, ErrorAlert, QueryState } from '../../components/ui.jsx'
import { Modal } from '../../components/Modal.jsx'
import { inputClass } from '../../components/styles.js'

/** Alta, renombre y desactivación de categorías de productos. */
export function CategoriesModal({ onClose, onChanged }) {
  const categories = useQuery(api.categories.list)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null) // { id, name }
  const [error, setError] = useState(null)

  async function run(action) {
    setError(null)
    try {
      await action()
      categories.reload()
      onChanged()
    } catch (e) {
      setError(e)
    }
  }

  return (
    <Modal title="Categorías" onClose={onClose}>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          run(async () => {
            await api.categories.create({ name })
            setName('')
          })
        }}
      >
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva categoría"
          aria-label="Nombre de la nueva categoría"
          maxLength={60}
        />
        <Button type="submit" disabled={!name.trim()}>
          Agregar
        </Button>
      </form>
      <ErrorAlert error={error} className="mb-3" />

      <QueryState query={categories}>
        {(list) => (
          <ul className="divide-y divide-ink-100">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2">
                {editing?.id === c.id ? (
                  <>
                    <input
                      className={inputClass}
                      value={editing.name}
                      onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                      aria-label="Nuevo nombre"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => run(async () => { await api.categories.update(c.id, { name: editing.name }); setEditing(null) })}>
                      Guardar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 ${c.isActive ? '' : 'text-ink-400 line-through'}`}>{c.name}</span>
                    {!c.isActive && <Badge>Inactiva</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: c.id, name: c.name })}>
                      Renombrar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => run(() => api.categories.update(c.id, { isActive: !c.isActive }))}>
                      {c.isActive ? 'Desactivar' : 'Activar'}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </Modal>
  )
}
