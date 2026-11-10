import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { api } from '../data/api'
import { useAuth } from '../auth'
import { useCarga, useAccion, Estado, Pagina, Chips, Lista, Fila, Hoja, Campo, Boton, Segmento, Vacio, num } from '../ui'
import { colones, nombreProducto, sumar } from '../lib/format'
import { useNombres } from '../lib/nombres'

export default function Inventario() {
  const { esStaff } = useAuth()
  const [params, setParams] = useSearchParams()
  const filtro = params.get('f') || 'todo'
  const [buscar, setBuscar] = useState('')
  const [editando, setEditando] = useState(null)
  const [ajustando, setAjustando] = useState(null)
  const [ubicando, setUbicando] = useState(null)
  const carga = useCarga(async () => {
    const [productos, existencias, equipo] = await Promise.all([
      api.list('productos', { orden: ['nombre'] }),
      esStaff ? api.list('existencias') : [],
      esStaff ? api.rpc('equipo').catch(() => []) : [],
    ])
    const porProducto = new Map()
    ;(existencias || []).forEach((e) => {
      if (!(Number(e.cantidad) > 0)) return
      if (!porProducto.has(e.producto_id)) porProducto.set(e.producto_id, [])
      porProducto.get(e.producto_id).push({ email: e.email, cantidad: Number(e.cantidad) })
    })
    productos.forEach((p) => {
      p.manos = porProducto.get(p.id) || []
      p.repartido = sumar(p.manos, 'cantidad')
      p.bodega = p.stock - p.repartido
    })
    productos.equipo = equipo || []
    return productos
  }, [esStaff])

  const t = buscar.trim().toLowerCase()
  const todos = carga.data || []
  const lista = todos.filter((p) =>
    (filtro === 'inactivos' ? !p.activo : p.activo) &&
    (filtro !== 'bajo' || (!p.es_servicio && p.stock <= p.stock_minimo)) &&
    (filtro !== 'servicios' || p.es_servicio) &&
    (filtro !== 'asodita' || p.en_asodita) &&
    (!t || nombreProducto(p).toLowerCase().includes(t) || p.categoria.toLowerCase().includes(t)))
  const enStock = todos.filter((p) => p.activo && !p.es_servicio && p.stock > 0)
  const valor = sumar(enStock, (p) => p.stock * p.costo)
  const valorVenta = sumar(enStock, (p) => p.stock * p.precio)

  return (
    <Pagina titulo="Inventario" atras="/mas" acciones={esStaff && <Boton variante="pri" onClick={() => setEditando({})}><Plus size={18} /> Nuevo</Boton>}>
      <div className="buscador">
        <Search size={18} />
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar producto o categoría" aria-label="Buscar producto" />
      </div>
      <Chips opciones={[['todo', 'Todo'], ['bajo', 'Stock bajo'], ['asodita', 'ASOdita'], ['servicios', 'Servicios'], ['inactivos', 'Ocultos']]} valor={filtro} onChange={(f) => setParams(f === 'todo' ? {} : { f })} />
      {esStaff && carga.data && (
        <div className="mosaico">
          <div className="dato"><span className="dato-label">En stock</span><span className="dato-cifra num">{sumar(enStock, 'stock')} u</span><span className="dato-sub">{enStock.length} productos</span></div>
          <div className="dato"><span className="dato-label">Costó</span><span className="dato-cifra num">{colones(valor)}</span><span className="dato-sub">lo que se pagó</span></div>
          <div className="dato"><span className="dato-label">Vale a precio de venta</span><span className="dato-cifra num">{colones(valorVenta)}</span><span className="dato-sub verde">ganancia {colones(valorVenta - valor)}</span></div>
        </div>
      )}
      <Estado carga={carga}>
        {lista.length ? (
          <Lista>
            {lista.map((p) => (
              <Fila key={p.id} onClick={esStaff ? () => setEditando(p) : null}
                titulo={nombreProducto(p)}
                sub={`${p.categoria} · ${colones(p.precio)}${esStaff && !p.es_servicio ? ` · costo ${colones(p.costo)}` : ''}`}
                derecha={p.es_servicio ? 'servicio' : `${p.stock} u`}
                derechaSub={p.es_servicio ? null : [esStaff ? `${p.bodega} en bodega` : null, p.repartido > 0 ? `${p.repartido} con vendedores` : null, p.stock <= p.stock_minimo ? 'reponer' : null].filter(Boolean).join(' · ') || null}
                tono={!p.es_servicio && p.stock <= p.stock_minimo ? 'alerta' : null} />
            ))}
          </Lista>
        ) : carga.data && <Vacio>{todos.length ? 'Ningún producto coincide.' : 'Agregá el primer producto con el botón Nuevo.'}</Vacio>}
      </Estado>
      {editando && (
        <EditarProducto producto={editando} categorias={[...new Set(todos.map((p) => p.categoria))]} onCerrar={() => setEditando(null)}
          onAjustar={() => { setAjustando(editando); setEditando(null) }} onUbicar={() => { setUbicando(editando); setEditando(null) }}
          onListo={() => { setEditando(null); carga.recargar() }} />
      )}
      {ubicando && <Ubicacion producto={ubicando} equipo={todos.equipo || []} onCerrar={() => setUbicando(null)} onListo={() => { setUbicando(null); carga.recargar() }} />}
      {ajustando && <AjustarStock producto={ajustando} onCerrar={() => setAjustando(null)} onListo={() => { setAjustando(null); carga.recargar() }} />}
    </Pagina>
  )
}

function EditarProducto({ producto, categorias, onCerrar, onAjustar, onUbicar, onListo }) {
  const nombre = useNombres()
  const [f, setF] = useState({ nombre: '', variante: '', categoria: '', precio: '', costo: '', stock: '', stock_minimo: '', es_servicio: false, en_asodita: true, visible_web: false, activo: true, ...producto })
  const [correr, ocupado] = useAccion()
  const set = (k, n) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : n ? num(e.target.value) : e.target.value })
  const nuevo = !f.id

  const guardar = async (e) => {
    e.preventDefault()
    const datos = {
      nombre: f.nombre.trim(), variante: f.variante?.trim() || null, categoria: f.categoria.trim() || 'General',
      precio: Number(f.precio) || 0, costo: Number(f.costo) || 0, stock_minimo: Number(f.stock_minimo) || 0,
      es_servicio: f.es_servicio, en_asodita: f.en_asodita, visible_web: f.visible_web, activo: f.activo,
    }
    if (nuevo) datos.stock = f.es_servicio ? 0 : Number(f.stock) || 0
    if (await correr(() => (nuevo ? api.insertar('productos', datos) : api.actualizar('productos', f.id, datos)), nuevo ? 'Producto agregado' : 'Producto actualizado')) onListo()
  }

  return (
    <Hoja abierta titulo={nuevo ? 'Nuevo producto' : nombreProducto(producto)} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <div className="dos-col">
          <Campo label="Nombre"><input required value={f.nombre} onChange={set('nombre')} placeholder="Empanada" /></Campo>
          <Campo label="Variante"><input value={f.variante || ''} onChange={set('variante')} placeholder="pollo, talla M…" /></Campo>
        </div>
        <Campo label="Categoría">
          <input list="categorias" required value={f.categoria} onChange={set('categoria')} placeholder="Comida, Bebidas, Mercadería…" />
          <datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
        </Campo>
        <div className="dos-col">
          <Campo label="Precio de venta (₡)"><input type="number" inputMode="numeric" required value={f.precio} onChange={set('precio', 1)} /></Campo>
          <Campo label="Costo por unidad (₡)" ayuda={nuevo ? 'Lo que te cuesta UNA unidad' : 'Se recalcula con cada compra'}><input type="number" inputMode="numeric" value={f.costo} onChange={set('costo', 1)} /></Campo>
        </div>
        {!f.es_servicio && (
          <div className="dos-col">
            {nuevo
              ? <Campo label="Cuántos hay en bodega"><input type="number" inputMode="numeric" value={f.stock} onChange={set('stock', 1)} /></Campo>
              : <Campo label="Stock total" grupo><div className="en-linea"><strong className="num grande">{producto.stock} u</strong><Boton type="button" onClick={onAjustar}>Salida o merma</Boton></div></Campo>}
            <Campo label="Avisar cuando queden"><input type="number" inputMode="numeric" value={f.stock_minimo} onChange={set('stock_minimo', 1)} /></Campo>
          </div>
        )}
        {!nuevo && !f.es_servicio && (
          <div className="bloque">
            <div className="en-linea fin"><h3>¿Dónde está?</h3><Boton type="button" variante="pri" onClick={onUbicar}>Cambiar cantidades</Boton></div>
            <div className="ubic-lista">
              <div className="ubic-fila"><span>Bodega</span><strong className="num">{producto.bodega} u</strong></div>
              {producto.manos.map((m) => <div key={m.email} className="ubic-fila"><span>{nombre(m.email)}</span><strong className="num">{m.cantidad} u</strong></div>)}
            </div>
          </div>
        )}
        <CalculoLote onCosto={(c) => setF({ ...f, costo: c })} />
        {f.precio > 0 && f.costo > 0 && f.costo <= f.precio && <p className="tenue">Margen: {colones(f.precio - f.costo)} por unidad ({Math.round((1 - f.costo / f.precio) * 100)}%)</p>}
        {f.precio > 0 && f.costo > f.precio && (
          <p className="aviso-linea">Ojo: cada unidad cuesta {colones(f.costo)} y se vende en {colones(f.precio)}, así que se pierde {colones(f.costo - f.precio)} por unidad. Si {colones(f.costo)} es lo que pagaste por todo el paquete, usá la calculadora de arriba.</p>
        )}
        <div className="checks">
          <label><input type="checkbox" checked={f.es_servicio} onChange={set('es_servicio')} /> Es un servicio (no lleva stock)</label>
          <label><input type="checkbox" checked={f.en_asodita} onChange={set('en_asodita')} /> Se vende en la ASOdita</label>
          <label><input type="checkbox" checked={f.visible_web} onChange={set('visible_web')} /> Mostrar en asosiaucr.com</label>
          {!nuevo && <label><input type="checkbox" checked={!f.activo} onChange={(e) => setF({ ...f, activo: !e.target.checked })} /> Ocultar (ya no se vende)</label>}
        </div>
        <Boton variante="pri" disabled={ocupado}>{nuevo ? 'Agregar producto' : 'Guardar cambios'}</Boton>
      </form>
    </Hoja>
  )
}

// "Pagué ₡8 700 por 100 unidades" → costo por unidad ₡87
function CalculoLote({ onCosto }) {
  const [total, setTotal] = useState('')
  const [unidades, setUnidades] = useState('')
  const unit = Number(total) > 0 && Number(unidades) > 0 ? Math.round((Number(total) / Number(unidades)) * 100) / 100 : null
  return (
    <div className="lote">
      <span>¿Compraste un paquete? Pagué</span>
      <input aria-label="Total pagado por el paquete" type="number" inputMode="numeric" value={total} onChange={(e) => setTotal(num(e.target.value))} placeholder="₡8700" />
      <span>por</span>
      <input aria-label="Unidades del paquete" type="number" inputMode="numeric" value={unidades} onChange={(e) => setUnidades(num(e.target.value))} placeholder="100" />
      <span>unidades</span>
      {unit != null && <Boton type="button" onClick={() => onCosto(unit)}>Usar {colones(unit)} c/u</Boton>}
    </div>
  )
}

function AjustarStock({ producto, onCerrar, onListo }) {
  const [motivo, setMotivo] = useState('consumo')
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')
  const [correr, ocupado] = useAccion()
  const delta = motivo === 'conteo' ? (Number(cantidad) || 0) - producto.stock : -(Number(cantidad) || 0)
  const guardar = async (e) => {
    e.preventDefault()
    if (await correr(() => api.rpc('ajustar_stock', { p_producto: producto.id, p_cantidad: delta, p_motivo: motivo, p_nota: nota || null }), 'Stock ajustado')) onListo()
  }
  return (
    <Hoja abierta titulo={`Ajustar stock · ${nombreProducto(producto)}`} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <p className="tenue">Hay {producto.stock} u. Para mercadería que entra por compra, usá Proveedores y compras.</p>
        <Segmento opciones={[['consumo', 'Consumo propio'], ['merma', 'Merma'], ['donacion', 'Donación'], ['conteo', 'Conteo físico']]} valor={motivo} onChange={setMotivo} />
        <Campo label={motivo === 'conteo' ? 'Unidades contadas' : 'Unidades que salen'} ayuda={cantidad !== '' ? `El stock queda en ${producto.stock + delta} u` : null}>
          <input type="number" inputMode="numeric" required min="0" value={cantidad} onChange={(e) => setCantidad(num(e.target.value))} />
        </Campo>
        <Campo label="Nota"><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: agua para jurados de la feria" /></Campo>
        <Boton variante="pri" disabled={ocupado || !delta}>Guardar ajuste</Boton>
      </form>
    </Hoja>
  )
}

// Cuántos hay en bodega y cuántos tiene cada vendedor. Guarda las diferencias:
// devoluciones a bodega → conteo de bodega → entregas a vendedores.
function Ubicacion({ producto, equipo, onCerrar, onListo }) {
  const nombre = useNombres()
  const antes = new Map(producto.manos.map((m) => [m.email, m.cantidad]))
  const personas = [...new Map([...equipo.map((e) => [e.email, e]), ...producto.manos.map((m) => [m.email, { email: m.email }])]).values()]
  const editables = new Set(equipo.map((e) => e.email))
  const [bodega, setBodega] = useState(String(producto.bodega))
  const [manos, setManos] = useState(() => Object.fromEntries(personas.map((p) => [p.email, String(antes.get(p.email) || 0)])))
  const [nota, setNota] = useState('')
  const [correr, ocupado] = useAccion()

  const val = (x) => Math.max(Number(x) || 0, 0)
  const cambios = personas.map((p) => ({ email: p.email, dif: val(manos[p.email]) - (antes.get(p.email) || 0) })).filter((c) => c.dif !== 0)
  const total = val(bodega) + sumar(personas, (p) => val(manos[p.email]))
  const hayCambios = cambios.length > 0 || val(bodega) !== producto.bodega

  const guardar = async (e) => {
    e.preventDefault()
    const ok = await correr(async () => {
      const devoluciones = cambios.filter((c) => c.dif < 0)
      const entregas = cambios.filter((c) => c.dif > 0)
      for (const c of devoluciones) await api.rpc('distribuir', { p_producto: producto.id, p_cantidad: -c.dif, p_de: c.email, p_a: null, p_nota: nota || 'Desde Inventario' })
      const bodegaAhora = producto.bodega - sumar(devoluciones, 'dif')
      const necesaria = val(bodega) + sumar(entregas, 'dif')
      const delta = necesaria - bodegaAhora
      if (delta !== 0) await api.rpc('ajustar_stock', { p_producto: producto.id, p_cantidad: delta, p_motivo: 'conteo', p_nota: nota || 'Conteo de bodega' })
      for (const c of entregas) await api.rpc('distribuir', { p_producto: producto.id, p_cantidad: c.dif, p_de: null, p_a: c.email, p_nota: nota || 'Desde Inventario' })
    }, 'Cantidades guardadas')
    if (ok) onListo()
  }

  return (
    <Hoja abierta titulo={`¿Dónde está? · ${nombreProducto(producto)}`} onCerrar={onCerrar} pie={
      <div className="pie-total">
        <div><span className="tenue">Total</span><strong className="num">{total} u</strong></div>
        <Boton variante="pri" form="f-ubic" disabled={ocupado || !hayCambios}>{ocupado ? 'Guardando…' : 'Guardar'}</Boton>
      </div>
    }>
      <form id="f-ubic" className="form" onSubmit={guardar}>
        <p className="tenue">Poné cuántas unidades hay en la bodega y cuántas tiene cada persona. Al guardar se anota como entrega, devolución o conteo.</p>
        <div className="ubic-lista">
          <label className="ubic-fila editable">
            <span><strong>Bodega</strong><small>antes {producto.bodega} u</small></span>
            <input type="number" inputMode="numeric" min="0" value={bodega} onChange={(e) => setBodega(e.target.value)} aria-label="Unidades en bodega" />
          </label>
          {personas.map((p) => (
            <label key={p.email} className="ubic-fila editable">
              <span><strong>{nombre(p.email)}</strong><small>{p.rol ? `${p.rol} · ` : ''}antes {antes.get(p.email) || 0} u</small></span>
              <input type="number" inputMode="numeric" min="0" value={manos[p.email]} disabled={!editables.has(p.email)}
                onChange={(e) => setManos({ ...manos, [p.email]: e.target.value })} aria-label={`Unidades que tiene ${nombre(p.email)}`} />
            </label>
          ))}
        </div>
        {!equipo.length && <p className="nota">Para repartir entre vendedores, primero agregalos en Usuarios.</p>}
        <Campo label="Nota (opcional)"><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: conteo del lunes, entrega para la feria" /></Campo>
      </form>
    </Hoja>
  )
}
