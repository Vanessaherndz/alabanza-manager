import Combobox from './Combobox.jsx'
import styles from './MusicianPicker.module.css'

function nombreDe(p) {
  return p?.fullName || p?.username || '—'
}

/** Selector de músicos: cada persona agregada trae un instrumento editable. */
export default function MusicianPicker({ members, selected, onChange, instruments }) {
  const disponibles = members.filter((m) => !selected.some((s) => s.uid === m.uid))
  return (
    <div>
      <div className={styles.picker}>
        <Combobox
          placeholder="Buscar músico para agregar…"
          options={disponibles.map((m) => ({ value: m.uid, label: nombreDe(m), hint: m.instrument }))}
          onSelect={(uid) => {
            const m = members.find((x) => x.uid === uid)
            if (!m) return
            onChange([...selected, { uid: m.uid, instrument: m.instrument || instruments[0] }])
          }}
        />
      </div>
      {selected.length > 0 && (
        <div className={styles.musicianList}>
          {selected.map((row) => {
            const m = members.find((x) => x.uid === row.uid)
            // Conserva un instrumento que ya no esté en la lista de la iglesia.
            const opciones = instruments.includes(row.instrument)
              ? instruments
              : [row.instrument, ...instruments].filter(Boolean)
            return (
              <div className={styles.musicianRow} key={row.uid}>
                <span className={styles.musicianName}>{nombreDe(m)}</span>
                <div className={styles.instrument}>
                  <Combobox
                    size="sm"
                    ariaLabel={`Instrumento de ${nombreDe(m)}`}
                    value={row.instrument}
                    options={opciones.map((i) => ({ value: i, label: i }))}
                    onSelect={(instrument) =>
                      onChange(selected.map((s) => (s.uid === row.uid ? { ...s, instrument } : s)))
                    }
                  />
                </div>
                <button
                  type="button"
                  className={styles.musicianRemove}
                  onClick={() => onChange(selected.filter((s) => s.uid !== row.uid))}
                  aria-label={`Quitar a ${nombreDe(m)}`}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
