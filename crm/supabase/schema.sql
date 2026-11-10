-- =====================================================================
--  ASOSIA CRM · Esquema de base de datos (Supabase / Postgres)
--  Pegá TODO este archivo en Supabase → SQL Editor → Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Usuarios autorizados y roles
--    admin    → todo + crear/editar perfiles
--    manager  → todo menos gestionar perfiles
--    vendedor → vender, cobrar fiados, ver stock y clientes (sin finanzas)
-- ---------------------------------------------------------------------
create table if not exists autorizados (
  email      text primary key,
  nombre     text,
  rol        text not null default 'vendedor' check (rol in ('admin','manager','vendedor')),
  activo     boolean not null default true,
  creado_at  timestamptz not null default now()
);

create or replace function _normalizar_email() returns trigger language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  return new;
end $$;

drop trigger if exists t_autorizados_email on autorizados;
create trigger t_autorizados_email before insert or update on autorizados
  for each row execute function _normalizar_email();

-- Siempre debe quedar al menos un admin activo
create or replace function _proteger_ultimo_admin() returns trigger language plpgsql as $$
begin
  if old.rol = 'admin' and old.activo
     and (tg_op = 'DELETE' or new.rol <> 'admin' or not new.activo)
     and (select count(*) from autorizados where rol = 'admin' and activo and email <> old.email) = 0 then
    raise exception 'Debe quedar al menos un admin activo';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists t_ultimo_admin on autorizados;
create trigger t_ultimo_admin before update or delete on autorizados
  for each row execute function _proteger_ultimo_admin();

create or replace function mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from autorizados
  where email = lower(coalesce(auth.jwt() ->> 'email', '')) and activo
$$;

create or replace function tiene_acceso() returns boolean
language sql stable as $$ select public.mi_rol() is not null $$;

create or replace function es_staff() returns boolean
language sql stable as $$ select coalesce(public.mi_rol() in ('admin','manager'), false) $$;

create or replace function es_admin() returns boolean
language sql stable as $$ select coalesce(public.mi_rol() = 'admin', false) $$;

-- Lo que la app pide al entrar: ¿quién soy y qué rol tengo?
create or replace function mi_perfil() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('email', email, 'nombre', nombre, 'rol', rol)
  from autorizados
  where email = lower(coalesce(auth.jwt() ->> 'email', '')) and activo
$$;

-- ---------------------------------------------------------------------
-- 2. Catálogos
-- ---------------------------------------------------------------------
create table if not exists productos (
  id            bigint generated always as identity primary key,
  nombre        text not null,
  variante      text,
  categoria     text not null default 'General',
  precio        numeric(12,2) not null default 0,
  costo         numeric(12,2) not null default 0,
  stock         numeric(12,2) not null default 0,
  stock_minimo  numeric(12,2) not null default 0,
  es_servicio   boolean not null default false,
  en_asodita    boolean not null default true,   -- aparece en la caja rápida de la ASOdita
  visible_web   boolean not null default false,  -- se publica en asosiaucr.com (futuro)
  activo        boolean not null default true,
  creado_at     timestamptz not null default now()
);

create table if not exists clientes (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  telefono   text,
  correo     text,
  carne      text,
  notas      text,
  creado_at  timestamptz not null default now()
);

create table if not exists eventos (
  id           bigint generated always as identity primary key,
  nombre       text not null,
  fecha        date,
  lugar        text,
  presupuesto  numeric(12,2) not null default 0,
  estado       text not null default 'planeado' check (estado in ('planeado','activo','cerrado')),
  notas        text,
  creado_at    timestamptz not null default now()
);

create table if not exists proveedores (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  contacto   text,
  telefono   text,
  correo     text,
  notas      text,
  creado_at  timestamptz not null default now()
);

create table if not exists metas (
  mes    date primary key,         -- primer día del mes
  monto  numeric(12,2) not null default 0
);

-- ---------------------------------------------------------------------
-- 3. Movimientos (ventas, compras, gastos, caja)
-- ---------------------------------------------------------------------
create table if not exists ventas (
  id              bigint generated always as identity primary key,
  fecha           timestamptz not null default now(),
  cliente_id      bigint references clientes(id) on delete set null,
  canal           text not null default 'general' check (canal in ('asodita','general','evento')),
  evento_id       bigint references eventos(id) on delete set null,
  subtotal        numeric(12,2) not null default 0,
  descuento       numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  pagado          numeric(12,2) not null default 0,
  estado          text not null default 'pagada' check (estado in ('pagada','pendiente','anulada')),
  notas           text,
  vendedor_email  text
);

create table if not exists venta_items (
  id           bigint generated always as identity primary key,
  venta_id     bigint not null references ventas(id) on delete cascade,
  producto_id  bigint references productos(id) on delete set null,
  nombre       text not null,
  cantidad     numeric(12,2) not null,
  precio       numeric(12,2) not null,
  costo        numeric(12,2) not null default 0
);

create table if not exists compras (
  id            bigint generated always as identity primary key,
  fecha         date not null default current_date,
  proveedor_id  bigint references proveedores(id) on delete set null,
  evento_id     bigint references eventos(id) on delete set null,
  total         numeric(12,2) not null default 0,
  pagado        numeric(12,2) not null default 0,
  estado        text not null default 'pagada' check (estado in ('pagada','pendiente')),
  notas         text,
  creado_por    text,
  creado_at     timestamptz not null default now()
);

create table if not exists compra_items (
  id           bigint generated always as identity primary key,
  compra_id    bigint not null references compras(id) on delete cascade,
  producto_id  bigint references productos(id) on delete set null,
  nombre       text not null,
  cantidad     numeric(12,2) not null,
  costo        numeric(12,2) not null
);

create table if not exists gastos (
  id            bigint generated always as identity primary key,
  fecha         date not null default current_date,
  categoria     text not null default 'Otros',
  descripcion   text not null,
  monto         numeric(12,2) not null,
  pagado        boolean not null default true,
  anulado       boolean not null default false,
  cuenta        text check (cuenta in ('efectivo','banco')),
  evento_id     bigint references eventos(id) on delete set null,
  proveedor_id  bigint references proveedores(id) on delete set null,
  creado_por    text,
  creado_at     timestamptz not null default now()
);

-- Libro de caja: cada colón que entra o sale queda aquí. Los saldos SIEMPRE salen de esta tabla.
create table if not exists movimientos (
  id          bigint generated always as identity primary key,
  fecha       timestamptz not null default now(),
  cuenta      text not null check (cuenta in ('efectivo','banco')),
  monto       numeric(12,2) not null,          -- positivo entra, negativo sale
  tipo        text not null,                   -- venta, cobro, compra, gasto, traslado, ajuste, anulacion
  venta_id    bigint references ventas(id) on delete set null,
  compra_id   bigint references compras(id) on delete set null,
  gasto_id    bigint references gastos(id) on delete set null,
  nota        text,
  creado_por  text
);

-- Salidas/entradas de inventario que no son venta ni compra (consumo propio, merma, conteo físico, donación)
create table if not exists ajustes_stock (
  id           bigint generated always as identity primary key,
  fecha        timestamptz not null default now(),
  producto_id  bigint references productos(id) on delete cascade,
  cantidad     numeric(12,2) not null,         -- negativo sale, positivo entra
  motivo       text not null check (motivo in ('consumo','merma','conteo','donacion')),
  costo        numeric(12,2) not null default 0,
  evento_id    bigint references eventos(id) on delete set null,
  nota         text,
  creado_por   text
);

create index if not exists i_ventas_fecha on ventas(fecha);
create index if not exists i_ventas_estado on ventas(estado);
create index if not exists i_mov_fecha on movimientos(fecha);
create index if not exists i_gastos_fecha on gastos(fecha);
create index if not exists i_compras_fecha on compras(fecha);

-- ---------------------------------------------------------------------
-- 4. Operaciones (todas atómicas: o se hace todo o nada)
-- ---------------------------------------------------------------------
create or replace function registrar_venta(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint; it jsonb; prod productos;
  v_cant numeric; v_precio numeric;
  v_sub numeric := 0;
  v_desc numeric := coalesce((p->>'descuento')::numeric, 0);
  v_pago numeric := coalesce((p->>'pago')::numeric, 0);
  v_cuenta text := coalesce(p->>'cuenta', 'efectivo');
  v_total numeric;
begin
  if not tiene_acceso() then raise exception 'Sin permiso'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  insert into ventas (cliente_id, canal, evento_id, descuento, notas, vendedor_email, estado)
  values ((p->>'cliente_id')::bigint, coalesce(p->>'canal', 'general'), (p->>'evento_id')::bigint,
          v_desc, p->>'notas', auth.jwt()->>'email', 'pendiente')
  returning id into v_id;

  for it in select * from jsonb_array_elements(p->'items') loop
    select * into prod from productos where id = (it->>'producto_id')::bigint for update;
    if not found then raise exception 'Un producto ya no existe'; end if;
    v_cant := (it->>'cantidad')::numeric;
    v_precio := coalesce((it->>'precio')::numeric, prod.precio);
    if v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    if not prod.es_servicio and prod.stock < v_cant then
      raise exception 'No hay suficiente stock de % (quedan %)', prod.nombre, prod.stock;
    end if;
    insert into venta_items (venta_id, producto_id, nombre, cantidad, precio, costo)
    values (v_id, prod.id, prod.nombre || coalesce(' · ' || prod.variante, ''), v_cant, v_precio, prod.costo);
    if not prod.es_servicio then
      update productos set stock = stock - v_cant where id = prod.id;
    end if;
    v_sub := v_sub + v_cant * v_precio;
  end loop;

  v_total := greatest(v_sub - v_desc, 0);
  v_pago := least(greatest(v_pago, 0), v_total);
  if v_pago < v_total and p->>'cliente_id' is null then
    raise exception 'Para dejar saldo pendiente (fiado) tenés que elegir un cliente';
  end if;

  update ventas set subtotal = v_sub, total = v_total, pagado = v_pago,
         estado = case when v_pago >= v_total then 'pagada' else 'pendiente' end
  where id = v_id;

  if v_pago > 0 then
    insert into movimientos (cuenta, monto, tipo, venta_id, nota, creado_por)
    values (v_cuenta, v_pago, 'venta', v_id, 'Venta #' || v_id, auth.jwt()->>'email');
  end if;
  return v_id;
end $$;

create or replace function cobrar_venta(p_venta bigint, p_monto numeric, p_cuenta text) returns void
language plpgsql security definer set search_path = public as $$
declare v ventas;
begin
  if not tiene_acceso() then raise exception 'Sin permiso'; end if;
  select * into v from ventas where id = p_venta for update;
  if not found or v.estado = 'anulada' then raise exception 'Venta no válida'; end if;
  if p_monto <= 0 or p_monto > v.total - v.pagado then raise exception 'Monto inválido'; end if;
  update ventas set pagado = pagado + p_monto,
         estado = case when pagado + p_monto >= total then 'pagada' else 'pendiente' end
  where id = p_venta;
  insert into movimientos (cuenta, monto, tipo, venta_id, nota, creado_por)
  values (p_cuenta, p_monto, 'cobro', p_venta, 'Cobro venta #' || p_venta, auth.jwt()->>'email');
end $$;

create or replace function anular_venta(p_venta bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v ventas;
begin
  if not es_staff() then raise exception 'Solo admin o manager pueden anular ventas'; end if;
  select * into v from ventas where id = p_venta for update;
  if not found or v.estado = 'anulada' then raise exception 'Venta no válida'; end if;
  update productos pr set stock = pr.stock + vi.cantidad
  from venta_items vi where vi.venta_id = p_venta and vi.producto_id = pr.id and not pr.es_servicio;
  insert into movimientos (cuenta, monto, tipo, venta_id, nota, creado_por)
  select cuenta, -sum(monto), 'anulacion', p_venta, 'Anulación venta #' || p_venta, auth.jwt()->>'email'
  from movimientos where venta_id = p_venta group by cuenta having sum(monto) <> 0;
  update ventas set estado = 'anulada', pagado = 0 where id = p_venta;
end $$;

create or replace function registrar_compra(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint; it jsonb; prod productos; v_cant numeric; v_costo numeric; v_total numeric := 0;
  v_pago numeric := coalesce((p->>'pago')::numeric, 0);
  v_cuenta text := coalesce(p->>'cuenta', 'efectivo');
begin
  if not es_staff() then raise exception 'Sin permiso'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then raise exception 'La compra no tiene productos'; end if;

  insert into compras (fecha, proveedor_id, evento_id, notas, creado_por)
  values (coalesce((p->>'fecha')::date, current_date), (p->>'proveedor_id')::bigint,
          (p->>'evento_id')::bigint, p->>'notas', auth.jwt()->>'email')
  returning id into v_id;

  for it in select * from jsonb_array_elements(p->'items') loop
    select * into prod from productos where id = (it->>'producto_id')::bigint for update;
    if not found then raise exception 'Un producto ya no existe'; end if;
    v_cant := (it->>'cantidad')::numeric;
    v_costo := (it->>'costo')::numeric;
    insert into compra_items (compra_id, producto_id, nombre, cantidad, costo)
    values (v_id, prod.id, prod.nombre || coalesce(' · ' || prod.variante, ''), v_cant, v_costo);
    -- costo promedio ponderado
    update productos set
      costo = case when greatest(stock, 0) + v_cant > 0
                   then round((greatest(stock, 0) * costo + v_cant * v_costo) / (greatest(stock, 0) + v_cant), 2)
                   else v_costo end,
      stock = stock + v_cant
    where id = prod.id;
    v_total := v_total + v_cant * v_costo;
  end loop;

  v_pago := least(greatest(v_pago, 0), v_total);
  update compras set total = v_total, pagado = v_pago,
         estado = case when v_pago >= v_total then 'pagada' else 'pendiente' end
  where id = v_id;
  if v_pago > 0 then
    insert into movimientos (cuenta, monto, tipo, compra_id, nota, creado_por)
    values (v_cuenta, -v_pago, 'compra', v_id, 'Compra #' || v_id, auth.jwt()->>'email');
  end if;
  return v_id;
end $$;

create or replace function pagar_compra(p_compra bigint, p_monto numeric, p_cuenta text) returns void
language plpgsql security definer set search_path = public as $$
declare c compras;
begin
  if not es_staff() then raise exception 'Sin permiso'; end if;
  select * into c from compras where id = p_compra for update;
  if not found then raise exception 'Compra no existe'; end if;
  if p_monto <= 0 or p_monto > c.total - c.pagado then raise exception 'Monto inválido'; end if;
  update compras set pagado = pagado + p_monto,
         estado = case when pagado + p_monto >= total then 'pagada' else 'pendiente' end
  where id = p_compra;
  insert into movimientos (cuenta, monto, tipo, compra_id, nota, creado_por)
  values (p_cuenta, -p_monto, 'compra', p_compra, 'Pago compra #' || p_compra, auth.jwt()->>'email');
end $$;

create or replace function registrar_gasto(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_pagado boolean := coalesce((p->>'pagado')::boolean, true);
begin
  if not es_staff() then raise exception 'Sin permiso'; end if;
  if coalesce((p->>'monto')::numeric, 0) <= 0 then raise exception 'Monto inválido'; end if;
  insert into gastos (fecha, categoria, descripcion, monto, pagado, cuenta, evento_id, proveedor_id, creado_por)
  values (coalesce((p->>'fecha')::date, current_date), coalesce(p->>'categoria', 'Otros'), p->>'descripcion',
          (p->>'monto')::numeric, v_pagado, case when v_pagado then coalesce(p->>'cuenta', 'efectivo') end,
          (p->>'evento_id')::bigint, (p->>'proveedor_id')::bigint, auth.jwt()->>'email')
  returning id into v_id;
  if v_pagado then
    insert into movimientos (cuenta, monto, tipo, gasto_id, nota, creado_por)
    values (coalesce(p->>'cuenta', 'efectivo'), -(p->>'monto')::numeric, 'gasto', v_id, p->>'descripcion', auth.jwt()->>'email');
  end if;
  return v_id;
end $$;

create or replace function pagar_gasto(p_gasto bigint, p_cuenta text) returns void
language plpgsql security definer set search_path = public as $$
declare g gastos;
begin
  if not es_staff() then raise exception 'Sin permiso'; end if;
  select * into g from gastos where id = p_gasto for update;
  if not found or g.pagado or g.anulado then raise exception 'Gasto no válido'; end if;
  update gastos set pagado = true, cuenta = p_cuenta where id = p_gasto;
  insert into movimientos (cuenta, monto, tipo, gasto_id, nota, creado_por)
  values (p_cuenta, -g.monto, 'gasto', p_gasto, g.descripcion, auth.jwt()->>'email');
end $$;

create or replace function anular_gasto(p_gasto bigint) returns void
language plpgsql security definer set search_path = public as $$
declare g gastos;
begin
  if not es_staff() then raise exception 'Sin permiso'; end if;
  select * into g from gastos where id = p_gasto for update;
  if not found or g.anulado then raise exception 'Gasto no válido'; end if;
  insert into movimientos (cuenta, monto, tipo, gasto_id, nota, creado_por)
  select cuenta, -sum(monto), 'anulacion', p_gasto, 'Anulación gasto: ' || g.descripcion, auth.jwt()->>'email'
  from movimientos where gasto_id = p_gasto group by cuenta having sum(monto) <> 0;
  update gastos set anulado = true where id = p_gasto;
end $$;

create or replace function traslado(p_monto numeric, p_de text, p_a text, p_nota text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_staff() then raise exception 'Sin permiso'; end if;
  if p_monto <= 0 or p_de = p_a then raise exception 'Traslado inválido'; end if;
  insert into movimientos (cuenta, monto, tipo, nota, creado_por) values
    (p_de, -p_monto, 'traslado', coalesce(p_nota, 'Traslado a ' || p_a), auth.jwt()->>'email'),
    (p_a,   p_monto, 'traslado', coalesce(p_nota, 'Traslado desde ' || p_de), auth.jwt()->>'email');
end $$;

create or replace function saldos() returns json
language sql stable security definer set search_path = public as $$
  select case when es_staff() then json_build_object(
    'efectivo', coalesce((select sum(monto) from movimientos where cuenta = 'efectivo'), 0),
    'banco',    coalesce((select sum(monto) from movimientos where cuenta = 'banco'), 0)
  ) end
$$;

-- Cuadre de caja: decís cuánto hay realmente y se registra la diferencia
create or replace function ajuste_caja(p_cuenta text, p_saldo_real numeric, p_nota text) returns void
language plpgsql security definer set search_path = public as $$
declare v_actual numeric;
begin
  if not es_staff() then raise exception 'Sin permiso'; end if;
  select coalesce(sum(monto), 0) into v_actual from movimientos where cuenta = p_cuenta;
  if p_saldo_real - v_actual <> 0 then
    insert into movimientos (cuenta, monto, tipo, nota, creado_por)
    values (p_cuenta, p_saldo_real - v_actual, 'ajuste', coalesce(p_nota, 'Ajuste de caja'), auth.jwt()->>'email');
  end if;
end $$;

create or replace function ajustar_stock(p_producto bigint, p_cantidad numeric, p_motivo text, p_nota text, p_evento bigint default null) returns void
language plpgsql security definer set search_path = public as $$
declare prod productos;
begin
  if not es_staff() then raise exception 'Sin permiso'; end if;
  select * into prod from productos where id = p_producto for update;
  if not found then raise exception 'Producto no existe'; end if;
  if p_cantidad = 0 then return; end if;
  insert into ajustes_stock (producto_id, cantidad, motivo, costo, evento_id, nota, creado_por)
  values (p_producto, p_cantidad, p_motivo, prod.costo, p_evento, p_nota, auth.jwt()->>'email');
  update productos set stock = stock + p_cantidad where id = p_producto;
end $$;

-- ---------------------------------------------------------------------
-- 5. Seguridad (Row Level Security)
-- ---------------------------------------------------------------------
alter table autorizados   enable row level security;
alter table productos     enable row level security;
alter table clientes      enable row level security;
alter table eventos       enable row level security;
alter table proveedores   enable row level security;
alter table metas         enable row level security;
alter table ventas        enable row level security;
alter table venta_items   enable row level security;
alter table compras       enable row level security;
alter table compra_items  enable row level security;
alter table gastos        enable row level security;
alter table movimientos   enable row level security;
alter table ajustes_stock enable row level security;

-- autorizados: cada quien se ve a sí mismo; solo admin ve y edita a todos
drop policy if exists p_aut_sel on autorizados;
create policy p_aut_sel on autorizados for select to authenticated
  using (es_admin() or email = lower(auth.jwt()->>'email'));
drop policy if exists p_aut_all on autorizados;
create policy p_aut_all on autorizados for all to authenticated using (es_admin()) with check (es_admin());

-- productos / eventos: todos los roles leen; staff escribe
drop policy if exists p_prod_sel on productos;
create policy p_prod_sel on productos for select to authenticated using (tiene_acceso());
drop policy if exists p_prod_all on productos;
create policy p_prod_all on productos for all to authenticated using (es_staff()) with check (es_staff());

drop policy if exists p_ev_sel on eventos;
create policy p_ev_sel on eventos for select to authenticated using (tiene_acceso());
drop policy if exists p_ev_all on eventos;
create policy p_ev_all on eventos for all to authenticated using (es_staff()) with check (es_staff());

-- clientes: todos leen, crean y editan; solo staff borra
drop policy if exists p_cli_sel on clientes;
create policy p_cli_sel on clientes for select to authenticated using (tiene_acceso());
drop policy if exists p_cli_ins on clientes;
create policy p_cli_ins on clientes for insert to authenticated with check (tiene_acceso());
drop policy if exists p_cli_upd on clientes;
create policy p_cli_upd on clientes for update to authenticated using (tiene_acceso()) with check (tiene_acceso());
drop policy if exists p_cli_del on clientes;
create policy p_cli_del on clientes for delete to authenticated using (es_staff());

-- ventas: todos leen (se crean solo por registrar_venta)
drop policy if exists p_ven_sel on ventas;
create policy p_ven_sel on ventas for select to authenticated using (tiene_acceso());
drop policy if exists p_vi_sel on venta_items;
create policy p_vi_sel on venta_items for select to authenticated using (tiene_acceso());

-- finanzas: solo admin y manager
drop policy if exists p_prov on proveedores;
create policy p_prov on proveedores for all to authenticated using (es_staff()) with check (es_staff());
drop policy if exists p_metas on metas;
create policy p_metas on metas for all to authenticated using (es_staff()) with check (es_staff());
drop policy if exists p_compras on compras;
create policy p_compras on compras for select to authenticated using (es_staff());
drop policy if exists p_ci on compra_items;
create policy p_ci on compra_items for select to authenticated using (es_staff());
drop policy if exists p_gastos on gastos;
create policy p_gastos on gastos for select to authenticated using (es_staff());
drop policy if exists p_mov on movimientos;
create policy p_mov on movimientos for select to authenticated using (es_staff());
drop policy if exists p_aj on ajustes_stock;
create policy p_aj on ajustes_stock for select to authenticated using (es_staff());

-- Las funciones no se pueden llamar sin sesión
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;

-- ---------------------------------------------------------------------
-- 6. Catálogo público (para conectar asosiaucr.com más adelante)
--    Solo expone nombre, precio y si hay stock; nunca costos.
-- ---------------------------------------------------------------------
create or replace view catalogo_web as
  select id, nombre, variante, categoria, precio, (es_servicio or stock > 0) as disponible
  from productos where activo and visible_web;
grant select on catalogo_web to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Usuario inicial: la Junta es Admin y desde la app agrega a los demás
-- ---------------------------------------------------------------------
insert into autorizados (email, nombre, rol) values
  ('junta.asosia@gmail.com', 'Junta Directiva ASOSIA', 'admin')
on conflict (email) do nothing;
