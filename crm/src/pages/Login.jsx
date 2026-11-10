import { useState } from 'react'
import { api, activarDemo } from '../data/api'
import { useAuth } from '../auth'
import { Boton, Campo, Marca } from '../ui'

const ROLES_DEMO = [
  ['admin', 'Admin', 'Todo, y además crea y edita perfiles.'],
  ['manager', 'Manager', 'Ventas, inventario, compras y finanzas.'],
  ['vendedor', 'Vendedor', 'Vende, cobra fiados y ve el stock.'],
]

export default function Login({ sinAcceso }) {
  const { usuario, salir, error, refrescar } = useAuth()
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState(() => (api.avisoInicio ? { error: api.avisoInicio } : null))
  const [codigo, setCodigo] = useState('')
  const [clave, setClave] = useState('')
  const [conCodigo, setConCodigo] = useState(false)

  const entrarClave = async (e) => {
    e.preventDefault()
    setEstado({ cargando: true })
    try { await api.loginClave(email, clave) } catch (err) { setEstado({ error: err.message }) }
  }
  
  const [nueva, setNueva] = useState('')
  const [nueva2, setNueva2] = useState('')
  const verificar = async (e) => {
    e.preventDefault()
    if (nueva.length < 8) return setEstado({ enviado: true, error: 'La contraseña debe tener al menos 8 caracteres.' })
    if (nueva !== nueva2) return setEstado({ enviado: true, error: 'Las dos contraseñas no coinciden.' })
    setEstado({ enviado: true, cargando: true })
    try {
      // Si algo falla después del código, la app igual pide crear la contraseña antes de entrar
      try { sessionStorage.setItem('asosia-crear-clave', '1') } catch { /* */ }
      await api.verificarCodigo(email, codigo)
      await api.crearClave(nueva)
      refrescar()
    } catch (err) {
      setEstado({ enviado: true, error: err.message })
    }
  }

  const enviar = async (e) => {
    e.preventDefault()
    setEstado({ cargando: true })
    try {
      await api.loginCorreo(email)
      setEstado({ enviado: true })
    } catch (err) {
      setEstado({ error: err.message })
    }
  }

  return (
    <div className="login">
      <div className="login-franja">
        <Marca claro />
        <p>Inventario, ventas y finanzas de la Asociación de Estudiantes de la Sede Interuniversitaria de Alajuela.</p>
      </div>

      <div className="login-caja">
        {api.modo === 'demo' ? (
          <>
            <h1>Entrá a la demo</h1>
            <p className="tenue">Los datos son de ejemplo y quedan solo en este navegador. Elegí con qué rol querés verla:</p>
            <div className="roles-demo">
              {ROLES_DEMO.map(([r, t, d]) => (
                <button key={r} onClick={() => api.entrarComo(r)}>
                  <strong>{t}</strong>
                  <span>{d}</span>
                </button>
              ))}
            </div>
            <button className="enlace" onClick={() => { api.reiniciar(); window.location.reload() }}>Reiniciar datos de ejemplo</button>
          </>
        ) : sinAcceso ? (
          <>
            <h1>Tu correo no tiene acceso</h1>
            <p className="tenue">
              Entraste como <strong>{usuario?.email}</strong>, pero ese correo no está autorizado. Pedile a un admin de la asociación que te agregue en Usuarios.
            </p>
            {error && <p className="error-txt">{error}</p>}
            <Boton onClick={salir}>Usar otro correo</Boton>
          </>
        ) : estado?.enviado ? (
          <>
            <h1>Creá tu contraseña</h1>
            <p className="tenue">Te mandamos un código a <strong>{email}</strong>. Escribilo y elegí la contraseña con la que vas a entrar de ahora en adelante.</p>
            <form onSubmit={verificar} className="form">
              <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
              <Campo label="Código del correo">
                <input inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={10} value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} placeholder="123456" autoFocus />
              </Campo>
              <Campo label="Contraseña nueva" ayuda="Mínimo 8 caracteres. Cuando el celular pregunte si guardarla, decile que sí.">
                <input type="password" name="new-password" autoComplete="new-password" required minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} />
              </Campo>
              <Campo label="Repetila">
                <input type="password" autoComplete="new-password" required minLength={8} value={nueva2} onChange={(e) => setNueva2(e.target.value)} />
              </Campo>
              <Boton variante="pri" disabled={estado?.cargando}>{estado?.cargando ? 'Guardando…' : 'Crear contraseña y entrar'}</Boton>
            </form>
            {estado?.error && <p className="error-txt">{estado.error}</p>}
            <button className="enlace" onClick={() => { setEstado(null); setCodigo('') }}>Pedir otro código</button>
          </>
        ) : conCodigo ? (
          <>
            <h1>Entrar con un código</h1>
            <p className="tenue">Para la primera vez o si se te olvidó la contraseña. Te mandamos un código de 6 dígitos al correo.</p>
            <form onSubmit={enviar} className="form">
              <Campo label="Correo">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@gmail.com" autoComplete="email" />
              </Campo>
              <Boton variante="pri" disabled={estado?.cargando}>{estado?.cargando ? 'Enviando…' : 'Enviarme el código'}</Boton>
            </form>
            {estado?.error && <p className="error-txt">{estado.error}</p>}
            <button className="enlace" onClick={() => { setConCodigo(false); setEstado(null) }}>Volver a entrar con contraseña</button>
          </>
        ) : (
          <>
            <h1>Entrar</h1>
            <p className="tenue">En el celular, al tocar Contraseña te ofrece llenarla con Face ID o huella si la guardaste.</p>
            <form onSubmit={entrarClave} className="form">
              <Campo label="Correo">
                <input type="email" name="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@gmail.com" autoComplete="username" />
              </Campo>
              <Campo label="Contraseña">
                <input type="password" name="password" required value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" />
              </Campo>
              <Boton variante="pri" disabled={estado?.cargando}>{estado?.cargando ? 'Entrando…' : 'Entrar'}</Boton>
            </form>
            {estado?.error && <p className="error-txt">{estado.error}</p>}
            <button className="enlace" onClick={() => { setConCodigo(true); setEstado(null) }}>¿Primera vez o se te olvidó la contraseña? Entrá con un código al correo</button>
            <button className="enlace tenue" onClick={() => activarDemo(true)}>Ver la demo con datos de ejemplo</button>
          </>
        )}
      </div>
    </div>
  )
}
