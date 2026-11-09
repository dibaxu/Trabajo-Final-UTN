import { useEffect, useRef } from 'react'

/** Diálogo modal nativo (<dialog>): se abre al montarse; Esc o clic afuera cierran. */
export function Modal({ title, onClose, children, size = 'md' }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const width = size === 'lg' ? 'max-w-2xl' : 'max-w-lg'
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={`m-auto w-[calc(100%-2rem)] ${width} rounded-2xl border border-ink-200 bg-white p-0 shadow-xl backdrop:bg-ink-900/40`}
    >
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-md p-1 text-ink-500 hover:bg-ink-100"
        >
          ✕
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  )
}
