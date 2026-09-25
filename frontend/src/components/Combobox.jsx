import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import styles from './Combobox.module.css'

// Compara sin mayúsculas ni acentos: "adoracion" encuentra "Adoración".
function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Campo con búsqueda: al escribir se despliegan las opciones que coinciden.
 *
 * - Modo selección (se pasa `value`): muestra la opción elegida, como un select.
 * - Modo agregar (sin `value`): cada elección llama a `onSelect` y el campo se
 *   limpia para agregar otra (útil para listas de personas o alabanzas).
 *
 * `options`: [{ value, label, hint? }]. Con `onCreate`, si el texto no coincide
 * exactamente con ninguna opción, se ofrece crearla.
 */
export default function Combobox({
  options,
  value,
  onSelect,
  placeholder = 'Buscar…',
  emptyLabel,
  onCreate,
  createLabel = (texto) => `Crear "${texto}"`,
  size,
  ariaLabel,
  disabled = false,
}) {
  const selectMode = value !== undefined
  const selected = selectMode ? options.find((o) => o.value === value) : null

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [typing, setTyping] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()

  const items = useMemo(() => {
    const q = typing ? normalizar(query) : ''
    const list = [
      ...(emptyLabel !== undefined ? [{ value: '', label: emptyLabel }] : []),
      ...options,
    ].filter((o) => !q || normalizar(o.label).includes(q) || normalizar(o.hint).includes(q))
    if (q) {
      // Primero lo que empieza con el texto, luego lo que tiene una palabra
      // que empieza con él y al final el resto de coincidencias.
      const puntaje = (o) => {
        const label = normalizar(o.label)
        if (label.startsWith(q)) return 0
        if (label.split(/[\s/-]+/).some((w) => w.startsWith(q))) return 1
        return 2
      }
      list.sort((a, b) => puntaje(a) - puntaje(b))
    }
    const texto = query.trim()
    if (onCreate && texto && !options.some((o) => normalizar(o.label) === normalizar(texto))) {
      list.push({ value: '__crear__', label: createLabel(texto), create: texto })
    }
    return list
  }, [options, emptyLabel, query, typing, onCreate, createLabel])

  useEffect(() => {
    setActive(0)
  }, [query, open])

  // Mantiene visible la opción resaltada al moverse con el teclado.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function close() {
    setOpen(false)
    setTyping(false)
    setQuery('')
  }

  function choose(item) {
    if (!item) return
    if (item.create !== undefined) onCreate(item.create)
    else onSelect(item.value)
    if (selectMode) {
      close()
      inputRef.current?.blur()
    } else {
      // Queda listo para agregar otra opción.
      setQuery('')
      setTyping(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && items[active]) {
        e.preventDefault()
        choose(items[active])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        close()
      }
    }
  }

  const shown = typing || !selectMode ? query : (selected?.label ?? (value === '' ? emptyLabel ?? '' : ''))

  return (
    <div className={`${styles.combo} ${size === 'sm' ? styles.sm : ''}`} data-open={open}>
      <input
        ref={inputRef}
        className={styles.input}
        role="combobox"
        aria-label={ariaLabel ?? placeholder}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
        value={shown}
        placeholder={selectMode && selected ? selected.label : placeholder}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value)
          setTyping(true)
          setOpen(true)
        }}
        onFocus={(e) => {
          setOpen(true)
          if (selectMode) e.target.select()
        }}
        onClick={() => setOpen(true)}
        onBlur={close}
        onKeyDown={handleKeyDown}
      />
      <ChevronDown size={size === 'sm' ? 14 : 16} className={styles.chevron} aria-hidden />

      {open && (
        <ul className={styles.list} id={listId} role="listbox" ref={listRef}>
          {items.length === 0 ? (
            <li className={styles.empty}>Sin resultados</li>
          ) : (
            items.map((item, i) => (
              <li
                key={`${item.value}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selectMode && item.value === value}
                className={`${styles.option} ${i === active ? styles.active : ''} ${
                  item.create !== undefined ? styles.create : ''
                }`}
                // mousedown en vez de click: se elige antes de que el campo pierda el foco.
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(item)
                }}
                onMouseEnter={() => setActive(i)}
              >
                {item.create !== undefined && <Plus size={14} aria-hidden />}
                <span className={styles.label}>{item.label}</span>
                {item.hint && <span className={styles.hint}>{item.hint}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
