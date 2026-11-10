import { useState } from 'react'
import { PackagePlus, Undo2 } from 'lucide-react'
import { api } from '../data/api'
import { useAuth } from '../auth'
import { useCarga, useAccion, Estado, Pagina, Seccion, Lista, Fila, Hoja, Campo, Boton, Segmento, Vacio, Etiqueta, num } from '../ui'
import { colones, fechaCorta, hora, sumar, ROLES } from '../lib/format'

// Agrupa las filas de inventario_personas por persona
function porPersona(filas) {
  const m = new Map()
  for (const f of filas) {
    if (!m.has(f.email)) m.set(f.email, { email: f.email, nombre: f.nombre, rol: f.rol, productos: [] })
    m.get(f.email).productos.push(f)
  }
  return [...m.values()]
}

export default function Reparto() {
  const { esStaff, perfil } = useAuth()
  const [entregar, setEntregar] = useState(null)
  const [recoger, setRecoger] = useState(null)
  const carga = useCarga(async () => {
    const [filas, equipo, disponible, productos, historial] = await Promise.all([
      api.rpc('inventario_personas'),
      esStaff ? api.rpc('equipo') : [],
      api.rpc('mi_disponible'),
      api.list('productos', { filtros: [['eq', 'activo', true], ['eq', 'es_servicio', false]], orden: ['nombre'] }),
      api.list('distribuciones', { orden: ['fecha', false], limite: 40 }),
    ])
    return { filas: filas || [], equipo: equipo || [], disponible: new Map((disponible || []).map((d) => [d.producto_id, d])), productos, historial }
  }, [esStaff])

  const d = carga.data
  const personas = d ? porPersona(d.filas) : []
  const mio = personas.find((p) => p.email === perfil.email)
  const otros = personas.filter((p) => p.email !== perfil.email)
  const nombreDe = (email) => (email == null ? 'Bodega' : d?.equipo.find((e) => e.email === email)?.nombre || personas.find((p) => p.email === email)?.nombre || email)
  const prodNombre = (id) => {
    const p = d?.productos.find((x) => x.id === id)
    return p ? (p.variante ? `${p.nombre} · ${p.variante}` : p.nombre) : 'Producto'
  }

  return (
    <Pagina titulo={esStaff ? 'Reparto de inventario' : 'Mi inventario'} atras="/mas"
      acciones={esStaff && <Boton variante="pri" onClick={() => setEntregar({})}><PackagePlus size={18} /> Entregar</Boton>}>
      <Estado carga={carga}>
        {d && (
          <>
            <Seccion titulo={esStaff ? 'Lo que tenés vos' : 'Lo que tenés asignado'}>
              {mio?.productos.some((p) => p.tiene > 0 || p.vendido > 0) ? (
                <TablaPersona persona={mio} onRecoger={(f) => setRecoger({ ...f, propio: true })} />
              ) : (
                <p className="tenue pad">
                  {esStaff ? 'No tenés inventario asignado. Cuando vendés, sale de la bodega.' : 'Todavía no te han entregado inventario. Pedile a un manager que te asigne productos para vender.'}
                </p>
              )}
            </Seccion>

            {esStaff && (
              <Seccion titulo="Equipo">
                {otros.length ? otros.map((p) => (
                  <div key={p.email} className="persona">
                    <div className="persona-cab">
                      <div>
                        <strong>{p.nombre || p.email}</strong> <Etiqueta>{ROLES[p.rol]}</Etiqueta>
                        <div className="fila-sub">
                          Tiene {sumar(p.productos, 'tiene')} u · vendió {sumar(p.productos, 'vendido')} u por {colones(sumar(p.productos, 'monto_vendido'))}
                        </div>
                      </div>
                      <Boton onClick={() => setEntregar({ a: p.email })}>Entregar</Boton>
                    </div>
                    <TablaPersona persona={p} onRecoger={(f) => setRecoger(f)} />
                  </div>
                )) : <Vacio accion={<Boton variante="pri" onClick={() => setEntregar({})}>Entregar inventario</Boton>}>Nadie del equipo tiene inventario asignado todavía.</Vacio>}
              </Seccion>
            )}

            {d.historial.length > 0 && (
              <Seccion titulo="Movimientos recientes">
                <Lista>
                  {d.historial.map((h) => (
                    <Fila key={h.id}
                      titulo={`${h.cantidad} × ${prodNombre(h.producto_id)}`}
                      sub={`${nombreDe(h.de_email)} → ${nombreDe(h.a_email)} · ${fechaCorta(h.fecha)} ${hora(h.fecha)}${h.nota ? ' · ' + h.nota : ''}`}
                      derecha={h.a_email == null ? 'devuelto' : 'entregado'} />
                  ))}
                </Lista>
              </Seccion>
            )}
          </>
        )}
      </Estado>
      {entregar && d && (
        <Entregar d={d} inicial={entregar} yo={perfil.email} onCerrar={() => setEntregar(null)} onListo={() => { setEntregar(null); carga.recargar() }} />
      )}
      {recoger && (
        <Recoger fila={recoger} onCerrar={() => setRecoger(null)} onListo={() => { setRecoger(null); carga.recargar() }} />
      )}
    </Pagina>
  )
}

function TablaPersona({ persona, onRecoger }) {
  return (
    <div className="tabla-reparto">
      <div className="tr-cab"><span>Producto</span><span>Tiene</span><span>Vendió</span><span /></div>
      {persona.productos.map((f) => (
        <div key={f.producto_id} className="tr-fila">
          <span className="tr-prod">{f.producto}<small>recibió {f.recibido}{f.devuelto > 0 ? ` · devolvió ${f.devuelto}` : ''}</small></span>
          <span className="num tr-tiene">{f.tiene}</span>
          <span className="num">{f.vendido}<small>{colones(f.monto_vendido)}</small></span>
          <span>{f.tiene > 0 && <button className="icono-btn" title="Devolver a bodega" aria-label={`Devolver ${f.producto} a bodega`} onClick={() => onRecoger(f)}><Undo2 size={17} /></button>}</span>
        </div>
      ))}
    </div>
  )
}

function Entregar({ d, inicial, yo, onCerrar, onListo }) {
  const destinos = d.equipo.filter((e) => e.email !== yo)
  const [a, setA] = useState(inicial.a || destinos[0]?.email || '')
  const [productoId, setProductoId] = useState('')
  const [origen, setOrigen] = useState('bodega')
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')
  const [correr, ocupado] = useAccion()
  const disp = productoId ? d.disponible.get(productoId) : null
  const max = disp ? (origen === 'bodega' ? disp.bodega : disp.mio) : 0
  const guardar = async (e) => {
    e.preventDefault()
    const ok = await correr(() => api.rpc('distribuir', {
      p_producto: productoId, p_cantidad: Number(cantidad), p_de: origen === 'bodega' ? null : yo, p_a: a, p_nota: nota || null,
    }), `Entregado: ${cantidad} u`)
    if (ok) onListo()
  }
  if (!destinos.length) {
    return <Hoja abierta titulo="Entregar inventario" onCerrar={onCerrar}><Vacio>No hay a quién entregarle. Agregá vendedores en Más → Usuarios.</Vacio></Hoja>
  }
  return (
    <Hoja abierta titulo="Entregar inventario" onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <Campo label="A quién">
          <select value={a} onChange={(e) => setA(e.target.value)} required>
            {destinos.map((p) => <option key={p.email} value={p.email}>{p.nombre || p.email} ({ROLES[p.rol]})</option>)}
          </select>
        </Campo>
        <Campo label="Producto">
          <select value={productoId} onChange={(e) => setProductoId(e.target.value ? Number(e.target.value) : '')} required>
            <option value="">Elegir…</option>
            {d.productos.map((p) => {
              const x = d.disponible.get(p.id)
              return <option key={p.id} value={p.id}>{p.variante ? `${p.nombre} · ${p.variante}` : p.nombre} — bodega {x?.bodega ?? 0}{x?.mio ? `, tuyos ${x.mio}` : ''}</option>
            })}
          </select>
        </Campo>
        {disp?.mio > 0 && (
          <Campo label="Sale de" grupo>
            <Segmento opciones={[['bodega', `Bodega (${disp.bodega})`], ['mio', `Lo que tengo (${disp.mio})`]]} valor={origen} onChange={setOrigen} />
          </Campo>
        )}
        <Campo label="Cantidad" ayuda={productoId ? `Disponible: ${max}` : null}>
          <input type="number" inputMode="numeric" min="1" max={max || undefined} required value={cantidad} onChange={(e) => setCantidad(num(e.target.value))} />
        </Campo>
        <Campo label="Nota"><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: para vender en la feria" /></Campo>
        <Boton variante="pri" disabled={ocupado || !productoId || !(Number(cantidad) > 0) || Number(cantidad) > max}>Entregar</Boton>
      </form>
    </Hoja>
  )
}

function Recoger({ fila, onCerrar, onListo }) {
  const [cantidad, setCantidad] = useState(fila.tiene)
  const [nota, setNota] = useState('')
  const [correr, ocupado] = useAccion()
  const guardar = async (e) => {
    e.preventDefault()
    const ok = await correr(() => api.rpc('distribuir', { p_producto: fila.producto_id, p_cantidad: Number(cantidad), p_de: fila.email, p_a: null, p_nota: nota || null }),
      `${cantidad} u devueltas a bodega`)
    if (ok) onListo()
  }
  return (
    <Hoja abierta titulo={fila.propio ? 'Devolver a bodega' : `Recoger de ${fila.nombre || fila.email}`} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <p className="tenue">{fila.producto}: {fila.propio ? 'tenés' : 'tiene'} {fila.tiene} u.</p>
        <Campo label="Cantidad que vuelve a bodega">
          <input type="number" inputMode="numeric" min="1" max={fila.tiene} required value={cantidad} onChange={(e) => setCantidad(num(e.target.value))} />
        </Campo>
        <Campo label="Nota"><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: sobró después de la feria" /></Campo>
        <Boton variante="pri" disabled={ocupado || !(Number(cantidad) > 0) || Number(cantidad) > fila.tiene}>Devolver a bodega</Boton>
      </form>
    </Hoja>
  )
}
