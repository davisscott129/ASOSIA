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
  const { usuario, salir, error } = useAuth()
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState(null)
  const [codigo, setCodigo] = useState('')
  const conGoogle = import.meta.env.VITE_LOGIN_GOOGLE === '1'

  const verificar = async (e) => {
    e.preventDefault()
    setEstado({ enviado: true, cargando: true })
    try {
      await api.verificarCodigo(email, codigo)
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
            <h1>Revisá tu correo</h1>
            <p className="tenue">Te enviamos un correo a <strong>{email}</strong>. Escribí el código que trae, o abrí el enlace en este mismo navegador.</p>
            <form onSubmit={verificar} className="form">
              <Campo label="Código del correo">
                <input inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={10} value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} placeholder="123456" autoFocus />
              </Campo>
              <Boton variante="pri" disabled={estado?.cargando}>{estado?.cargando ? 'Entrando…' : 'Entrar'}</Boton>
            </form>
            {estado?.error && <p className="error-txt">{estado.error}</p>}
            <button className="enlace" onClick={() => { setEstado(null); setCodigo('') }}>Usar otro correo</button>
          </>
        ) : (
          <>
            <h1>Entrar</h1>
            {conGoogle && (
              <>
                <Boton variante="google" onClick={() => api.loginGoogle().catch((e) => setEstado({ error: e.message }))}>
                  Continuar con Google
                </Boton>
                <div className="separador"><span>o con tu correo</span></div>
              </>
            )}
            <p className="tenue">Te mandamos un código a tu correo para entrar, sin contraseña.</p>
            <form onSubmit={enviar} className="form">
              <Campo label="Correo">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@gmail.com" autoComplete="email" />
              </Campo>
              <Boton variante="pri" disabled={estado?.cargando}>{estado?.cargando ? 'Enviando…' : 'Enviarme el código'}</Boton>
            </form>
            {estado?.error && <p className="error-txt">{estado.error}</p>}
            <button className="enlace" onClick={() => activarDemo(true)}>Ver la demo con datos de ejemplo</button>
          </>
        )}
      </div>
    </div>
  )
}
