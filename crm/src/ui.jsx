import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { colones, nombreMes } from './lib/format'

// ---------- datos ----------
export function useCarga(fn, deps = []) {
  const [s, set] = useState({ cargando: true, data: null, error: null })
  const ref = useRef(fn)
  ref.current = fn
  const recargar = useCallback(() => {
    set((x) => ({ ...x, cargando: true }))
    return Promise.resolve(ref.current())
      .then((data) => set({ cargando: false, data, error: null }))
      .catch((e) => set({ cargando: false, data: null, error: e.message }))
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { recargar() }, deps)
  return { ...s, recargar }
}

// ---------- avisos ----------
const AvisoCtx = createContext(() => {})
export function AvisoProvider({ children }) {
  const [aviso, setAviso] = useState(null)
  const mostrar = useCallback((texto, tipo = 'ok') => {
    setAviso({ texto, tipo, k: Date.now() })
    setTimeout(() => setAviso((a) => (a && Date.now() - a.k > 2800 ? null : a)), 3000)
  }, [])
  return (
    <AvisoCtx.Provider value={mostrar}>
      {children}
      {aviso && <div key={aviso.k} className={`aviso aviso-${aviso.tipo}`} role="status">{aviso.texto}</div>}
    </AvisoCtx.Provider>
  )
}
export const useAviso = () => useContext(AvisoCtx)

// Ejecuta una acción mostrando error/éxito
export function useAccion() {
  const aviso = useAviso()
  const [ocupado, setOcupado] = useState(false)
  const correr = async (fn, exito) => {
    setOcupado(true)
    try {
      const r = await fn()
      if (exito) aviso(typeof exito === 'function' ? exito(r) : exito)
      return r ?? true
    } catch (e) {
      aviso(e.message, 'error')
      return false
    } finally {
      setOcupado(false)
    }
  }
  return [correr, ocupado]
}

// ---------- estructura ----------
export function Pagina({ titulo, atras, acciones, children, ancha }) {
  const nav = useNavigate()
  return (
    <div className={`pagina ${ancha ? 'pagina-ancha' : ''}`}>
      <header className="pagina-cab">
        {atras && (
          <button className="icono-btn" onClick={() => nav(atras === true ? -1 : atras)} aria-label="Volver">
            <ChevronLeft size={22} />
          </button>
        )}
        <h1>{titulo}</h1>
        <div className="pagina-acciones">{acciones}</div>
      </header>
      {children}
    </div>
  )
}

export function Seccion({ titulo, extra, children }) {
  return (
    <section className="seccion">
      {(titulo || extra) && (
        <div className="seccion-cab">
          <h2>{titulo}</h2>
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

export function Lista({ children }) {
  return <div className="lista">{children}</div>
}

export function Fila({ titulo, sub, derecha, derechaSub, onClick, tono }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`fila ${tono ? 'fila-' + tono : ''}`} onClick={onClick}>
      <div className="fila-txt">
        <div className="fila-tit">{titulo}</div>
        {sub && <div className="fila-sub">{sub}</div>}
      </div>
      {(derecha != null || derechaSub) && (
        <div className="fila-der">
          <div className="num">{derecha}</div>
          {derechaSub && <div className="fila-sub">{derechaSub}</div>}
        </div>
      )}
    </Tag>
  )
}

export function Vacio({ children, accion }) {
  return (
    <div className="vacio">
      <p>{children}</p>
      {accion}
    </div>
  )
}

export function Estado({ carga, children }) {
  if (carga.error) return <Vacio accion={<Boton onClick={carga.recargar}>Intentar de nuevo</Boton>}>No se pudieron cargar los datos: {carga.error}</Vacio>
  if (carga.cargando && !carga.data) return <div className="cargando" aria-label="Cargando"><span /><span /><span /></div>
  return children
}

export const Dinero = ({ v, className = '' }) => <span className={`num ${className}`}>{colones(v)}</span>

export function Etiqueta({ tono = 'neutro', children }) {
  return <span className={`etq etq-${tono}`}>{children}</span>
}

// ---------- controles ----------
export function Boton({ variante = 'sec', className = '', ...p }) {
  return <button className={`btn btn-${variante} ${className}`} {...p} />
}

// grupo: para botones/segmentos (un <label> no debe envolver botones)
export function Campo({ label, ayuda, grupo, children }) {
  const Tag = grupo ? 'div' : 'label'
  return (
    <Tag className="campo" {...(grupo ? { role: 'group', 'aria-label': typeof label === 'string' ? label : undefined } : {})}>
      <span className="campo-label">{label}</span>
      {children}
      {ayuda && <span className="campo-ayuda">{ayuda}</span>}
    </Tag>
  )
}

export function Segmento({ opciones, valor, onChange, className = '' }) {
  return (
    <div className={`segmento ${className}`} role="tablist">
      {opciones.map(([v, t]) => (
        <button key={v} type="button" role="tab" aria-selected={valor === v} className={valor === v ? 'activo' : ''} onClick={() => onChange(v)}>
          {t}
        </button>
      ))}
    </div>
  )
}

export function Chips({ opciones, valor, onChange }) {
  return (
    <div className="chips">
      {opciones.map(([v, t]) => (
        <button key={v} type="button" className={`chip ${valor === v ? 'activo' : ''}`} onClick={() => onChange(v)}>
          {t}
        </button>
      ))}
    </div>
  )
}

export function MesNav({ mes, onChange }) {
  const mover = (n) => onChange(new Date(mes.getFullYear(), mes.getMonth() + n, 1))
  const esActual = mes.getFullYear() === new Date().getFullYear() && mes.getMonth() === new Date().getMonth()
  return (
    <div className="mesnav">
      <button className="icono-btn" onClick={() => mover(-1)} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
      <span>{nombreMes(mes)}</span>
      <button className="icono-btn" onClick={() => mover(1)} disabled={esActual} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
    </div>
  )
}

// Hoja inferior (modal)
export function Hoja({ abierta, titulo, onCerrar, children, pie }) {
  useEffect(() => {
    if (!abierta) return
    const esc = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [abierta, onCerrar])
  if (!abierta) return null
  return (
    <div className="hoja-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="hoja-cab">
          <h2>{titulo}</h2>
          <button className="icono-btn" onClick={onCerrar} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="hoja-cuerpo">{children}</div>
        {pie && <div className="hoja-pie">{pie}</div>}
      </div>
    </div>
  )
}

export function Cuenta({ valor, onChange }) {
  return <Segmento opciones={[['efectivo', 'Efectivo'], ['banco', 'Banco / SINPE']]} valor={valor} onChange={onChange} />
}

export const num = (v) => (v === '' || v == null ? '' : Number(v))

export function Marca({ claro }) {
  return (
    <span className={`marca ${claro ? 'marca-clara' : ''}`} aria-label="asoSIA">
      aso<b>S</b><b>I</b><b>A</b>
    </span>
  )
}
