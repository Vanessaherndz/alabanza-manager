import { Mic } from 'lucide-react'
import { VOICE_LEAD_ROLE, CHOIR_ROLE } from '../lib/serviceRoles.js'
import { groupBySection } from '../lib/groupBySection.js'
import styles from './ServiceSummaryTable.module.css'

function nombreDe(profile) {
  return profile?.fullName || profile?.username || '—'
}

const STATUS_META = {
  invitado: { label: 'Pendiente', cls: 'stPending' },
  confirmado: { label: 'Confirmada', cls: 'stConfirm' },
  rechazado: { label: 'Rechazada', cls: 'stReject' },
}

function nextStatus(status) {
  if (status === 'invitado') return 'confirmado'
  if (status === 'confirmado') return 'rechazado'
  return 'invitado'
}

function ordenRol(role) {
  if (role === VOICE_LEAD_ROLE) return 0
  if (role === CHOIR_ROLE) return 1
  return 2
}

/** Nombre + estado (punto) + rol + quitar, para una celda de la hoja. */
function TeamChip({ a, tag, isAdmin, onRemove, onCycleStatus, lead = false }) {
  const meta = STATUS_META[a.status] ?? { label: a.status, cls: '' }
  return (
    <div className={`${styles.cellItem} ${lead ? styles.leadItem : ''}`}>
      <button
        type="button"
        className={`${styles.statusDot} ${styles[meta.cls] ?? ''}`}
        title={`Estado: ${meta.label}${isAdmin ? ' (clic para cambiar)' : ''}`}
        aria-label={`Estado: ${meta.label}`}
        disabled={!isAdmin}
        onClick={() => onCycleStatus(a.id, nextStatus(a.status))}
      />
      {lead && <Mic size={14} className={styles.leadIcon} aria-hidden />}
      <span className={lead ? styles.leadName : undefined}>{nombreDe(a.profile)}</span>
      <span className={lead ? styles.leadTag : styles.cellTag}>{tag}</span>
      {isAdmin && (
        <button className={styles.miniRemove} onClick={() => onRemove(a.id)} aria-label="Quitar">
          ×
        </button>
      )}
    </div>
  )
}

/**
 * "Hoja del servicio": una fila por sección, con Voz, Alabanzas y Músicos
 * como columnas. La usan tanto la vista de detalle/edición de un servicio
 * como su vista previa en el listado, para que ambas se vean igual.
 */
export default function ServiceSummaryTable({
  songs,
  team,
  isAdmin = false,
  onRemoveSong = () => {},
  onRemoveMember = () => {},
  onCycleStatus = () => {},
}) {
  const grupos = groupBySection(songs)
  const teamGrupos = groupBySection(team, grupos.map((g) => g.name)).map((g) => ({
    ...g,
    items: [...g.items].sort((a, b) => ordenRol(a.role) - ordenRol(b.role)),
  }))

  const sectionRows = [
    ...new Set([...grupos.map((g) => g.name), ...teamGrupos.map((g) => g.name)]),
  ].map((name) => {
    const sectionSongs = grupos.find((g) => g.name === name)?.items ?? []
    const sectionTeam = teamGrupos.find((g) => g.name === name)?.items ?? []
    return {
      name,
      songs: sectionSongs,
      vocalLeads: sectionTeam.filter((a) => a.role === VOICE_LEAD_ROLE),
      choir: sectionTeam.filter((a) => a.role === CHOIR_ROLE),
      musicians: sectionTeam.filter((a) => a.role !== VOICE_LEAD_ROLE && a.role !== CHOIR_ROLE),
    }
  })

  if (sectionRows.length === 0) {
    return <p className="muted">Aún no hay secciones configuradas en este servicio.</p>
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.summaryTable}>
        <thead>
          <tr>
            <th>Sección</th>
            <th>Voz</th>
            <th>Alabanzas</th>
            <th>Músicos</th>
          </tr>
        </thead>
        <tbody>
          {sectionRows.map((row) => (
            <tr key={row.name}>
              <td className={styles.sectionCell}>{row.name}</td>
              <td data-label="Voz">
                {row.vocalLeads.length === 0 && row.choir.length === 0 && <span className="muted">—</span>}
                {row.vocalLeads.map((a) => (
                  <TeamChip
                    key={a.id}
                    a={a}
                    tag="Voz principal"
                    lead
                    isAdmin={isAdmin}
                    onRemove={onRemoveMember}
                    onCycleStatus={onCycleStatus}
                  />
                ))}
                {row.choir.map((a) => (
                  <TeamChip
                    key={a.id}
                    a={a}
                    tag="Coro"
                    isAdmin={isAdmin}
                    onRemove={onRemoveMember}
                    onCycleStatus={onCycleStatus}
                  />
                ))}
              </td>
              <td data-label="Alabanzas">
                {row.songs.length === 0 && <span className="muted">—</span>}
                {row.songs.map((es) => (
                  <div className={styles.cellItem} key={es.id}>
                    <span>{es.song?.title ?? '—'}</span>
                    <span className={styles.cellTag}>{es.songKey || es.song?.songKey || '—'}</span>
                    {isAdmin && (
                      <button
                        className={styles.miniRemove}
                        onClick={() => onRemoveSong(es.id)}
                        aria-label="Quitar"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </td>
              <td data-label="Músicos">
                {row.musicians.length === 0 && <span className="muted">—</span>}
                {row.musicians.map((a) => (
                  <TeamChip
                    key={a.id}
                    a={a}
                    tag={a.role || 'Sin rol'}
                    isAdmin={isAdmin}
                    onRemove={onRemoveMember}
                    onCycleStatus={onCycleStatus}
                  />
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
