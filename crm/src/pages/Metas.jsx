import { useState } from 'react'
import { api } from '../data/api'
import { useCarga, useAccion, Estado, Pagina, Seccion, Lista, Campo, Boton, num } from '../ui'
import { colones, inicioMes, isoDia, nombreMes, sumar } from '../lib/format'

export default function Metas() {
  const carga = useCarga(async () => {
    const desde = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)
    const [metas, ventas] = await Promise.all([
      api.list('metas', { orden: ['mes', false] }),
      api.list('ventas', { filtros: [['gte', 'fecha', desde.toISOString()], ['neq', 'estado', 'anulada']] }),
    ])
    const meses = Array.from({ length: 6 }, (_, i) => new Date(desde.getFullYear(), desde.getMonth() + 5 - i, 1))
    return meses.map((m) => {
      const clave = isoDia(m)
      const vendido = sumar(ventas.filter((v) => new Date(v.fecha) >= m && new Date(v.fecha) < new Date(m.getFullYear(), m.getMonth() + 1, 1)), 'total')
      return { mes: m, clave, vendido, meta: metas.find((x) => x.mes === clave)?.monto || 0 }
    })
  })
  return (
    <Pagina titulo="Metas" atras="/mas">
      <Estado carga={carga}>
        {carga.data && (
          <>
            <MetaActual fila={carga.data[0]} onListo={carga.recargar} />
            <Seccion titulo="Meses anteriores">
              <Lista>
                {carga.data.slice(1).map((f) => {
                  const pct = f.meta ? Math.round((f.vendido / f.meta) * 100) : null
                  return (
                    <div key={f.clave} className="fila fila-meta">
                      <div className="fila-txt">
                        <div className="fila-tit">{nombreMes(f.mes)}</div>
                        <div className="fila-sub">{f.meta ? `meta ${colones(f.meta)}` : 'sin meta'}</div>
                        {f.meta > 0 && <div className="meta-barra mini"><i style={{ width: `${Math.min(pct, 100)}%` }} /></div>}
                      </div>
                      <div className="fila-der"><div className="num">{colones(f.vendido)}</div>{pct != null && <div className={`fila-sub ${pct >= 100 ? 'verde' : ''}`}>{pct}%</div>}</div>
                    </div>
                  )
                })}
              </Lista>
            </Seccion>
          </>
        )}
      </Estado>
    </Pagina>
  )
}

function MetaActual({ fila, onListo }) {
  const [monto, setMonto] = useState(fila.meta || '')
  const [correr, ocupado] = useAccion()
  const guardar = async (e) => {
    e.preventDefault()
    if (await correr(() => api.upsert('metas', { mes: isoDia(inicioMes()), monto: Number(monto) || 0 }), 'Meta guardada')) onListo()
  }
  const pct = fila.meta ? Math.min(fila.vendido / fila.meta, 1) : 0
  return (
    <form className="bloque" onSubmit={guardar}>
      <h3>Meta de {nombreMes(fila.mes)}</h3>
      <p className="tenue">Llevan {colones(fila.vendido)} vendidos{fila.meta ? `, ${Math.round(pct * 100)}% de la meta` : ''}.</p>
      {fila.meta > 0 && <div className="meta-barra"><i style={{ width: `${pct * 100}%` }} /></div>}
      <Campo label="Meta de ventas (₡)">
        <input type="number" inputMode="numeric" value={monto} onChange={(e) => setMonto(num(e.target.value))} placeholder="350000" />
      </Campo>
      <Boton variante="pri" disabled={ocupado}>Guardar meta</Boton>
    </form>
  )
}
