# asoSIA CRM

Inventario, ventas (ASOdita, generales y de eventos), fiados, proveedores y compras, gastos, caja y banco de la ASOSIA.
React + Vite en el navegador, Supabase (Postgres) como base de datos y login.

## Roles

| Rol | Puede |
|---|---|
| **Admin** | Todo, y además agregar, cambiar de rol o quitar acceso a usuarios (Más → Usuarios). |
| **Manager** | Ventas, inventario, eventos, proveedores y compras, gastos, caja, metas. No gestiona usuarios. |
| **Vendedor** | Vender, crear clientes, cobrar fiados, ver stock y eventos. No ve finanzas ni puede anular. |

Solo pueden entrar los correos que estén en la lista de Usuarios. `junta.asosia@gmail.com` viene como **Admin** y desde ahí agrega a los demás.
Siempre tiene que quedar al menos un Admin activo (la base de datos no deja quitar el último).

Las reglas viven en la base de datos (Row Level Security y funciones), no solo en la pantalla:
aunque alguien modifique la app, un vendedor no puede leer la caja ni registrar gastos.

## Puesta en marcha (una sola vez, ~20 min)

### 1. Supabase
1. Creá un proyecto gratis en https://supabase.com (región: `us-east-1` o la más cercana).
2. En Supabase → **SQL Editor** → New query → pegá todo el archivo → **Run**.
3. **Authentication → URL Configuration**
   - *Site URL*: la dirección donde va a quedar la app (por ejemplo `https://crm.asosiaucr.com`).
   - *Redirect URLs*: agregá esa misma y `http://localhost:5173`.
4. Login con Google (recomendado, todos tienen Gmail):
   **Authentication → Sign In / Providers → Google**. Necesita un *OAuth Client ID* de Google Cloud
   (APIs & Services → Credentials → Create OAuth client → Web). En "Authorized redirect URIs" va la URL
   que muestra Supabase en esa misma pantalla (`https://xxxx.supabase.co/auth/v1/callback`).
   El login por enlace al correo funciona sin configurar nada, pero el correo gratuito de Supabase
   manda pocos mensajes por hora; para uso diario conviene Google.

### 2. Correr la app en tu compu
```bash
cp .env.example .env.local      # y pegá Project URL y anon key (Project Settings → API)
npm install
npm run dev                     # abre http://localhost:5173
```

### 3. Publicarla (Vercel, igual que el sitio de ASOSIA)
1. Subí esta carpeta a un repositorio de GitHub.
2. En Vercel → Add New Project → elegí el repo (Vercel detecta Vite solo).
3. En *Environment Variables* agregá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Si querés `crm.asosiaucr.com`, agregalo en Settings → Domains y poné esa URL en Supabase (paso 1.3).

En el celular: abrí la app en el navegador → "Agregar a pantalla de inicio" y queda como una app.

## Cómo funciona el dinero

- Cada colón que entra o sale queda en la tabla `movimientos` (efectivo o banco). Los saldos se calculan
  siempre de ahí; nadie escribe un saldo a mano. Si la caja física no coincide, **Cuadrar caja** registra la diferencia.
- **Venta**: baja el stock y, si se pagó, entra la plata. Si queda saldo, es un **fiado** y necesita cliente.
- **Compra**: sube el stock y recalcula el costo promedio del producto. Puede quedar pendiente de pago.
- **Gasto**: puede quedar pendiente; se puede ligar a un evento y a un proveedor.
- **Anular** (venta o gasto) devuelve stock y revierte la plata; no borra nada, queda el registro.
- **Ajustar stock**: consumo propio, merma, donación o conteo físico (no mueve plata, pero sí cuenta como costo).
- **Eventos**: cada venta, gasto y consumo puede ir a un evento; la ficha del evento muestra su ganancia o pérdida.

## Reparto de inventario por persona
`supabase/reparto.sql` (se corre después de `schema.sql`) agrega:
- **Bodega** = stock total − lo que está en manos de alguien.
- **Entregar**: Admin → Managers y Vendedores; Manager → Vendedores (de bodega o de lo suyo).
- **Vender**: descuenta primero de lo que tiene asignado quien vende. Un Vendedor solo vende lo asignado; Admin/Manager pueden vender de bodega.
- **Devolver/recoger**: vuelve a bodega. Anular una venta devuelve las unidades a la mano de quien vendió.
- Pantalla **Reparto** (Mi inventario para vendedores): qué tiene cada persona, cuánto recibió, devolvió y vendió.

## Modo demo
Sin `.env.local` la app arranca en modo demo con datos de ejemplo guardados solo en el navegador.
`npm run build:demo` genera un solo HTML con la demo en `dist-demo/`.

## Para conectar asosiaucr.com más adelante
La vista pública `catalogo_web` expone solo nombre, variante, categoría, precio y disponibilidad de los productos
marcados "Mostrar en asosiaucr.com" (nunca costos). Desde el sitio:
```js
const { data } = await supabase.from('catalogo_web').select('*')
```
El siguiente paso sería una tabla de pedidos web que el sitio pueda crear y que aparezca en este CRM.

## Estructura
```
supabase/schema.sql     tablas, roles, permisos y operaciones (todo en un archivo)
src/data/supabase.js    conexión real
src/data/demo.js        demo local que imita las mismas reglas
src/pages/              Inicio, Vender, Ventas, Clientes, Inventario, Eventos, Compras, Finanzas, Metas, Usuarios
```
