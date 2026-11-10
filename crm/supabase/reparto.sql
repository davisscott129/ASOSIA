-- =====================================================================
--  Reparto de inventario por persona (correr después de schema.sql)
--  Bodega = productos.stock − lo que está en manos de alguien.
-- =====================================================================

create table if not exists existencias (
  email        text not null,
  producto_id  bigint not null references productos(id) on delete cascade,
  cantidad     numeric(12,2) not null default 0 check (cantidad >= 0),
  primary key (email, producto_id)
);

create table if not exists distribuciones (
  id           bigint generated always as identity primary key,
  fecha        timestamptz not null default now(),
  producto_id  bigint not null references productos(id) on delete cascade,
  de_email     text,            -- null = bodega
  a_email      text,            -- null = bodega
  cantidad     numeric(12,2) not null check (cantidad > 0),
  nota         text,
  creado_por   text
);
create index if not exists i_dist_producto on distribuciones(producto_id);
create index if not exists i_exist_producto on existencias(producto_id);

-- Cuánto de la venta salió de la mano de quien vendió (para devolverlo si se anula)
alter table venta_items add column if not exists de_mano numeric(12,2) not null default 0;

alter table existencias enable row level security;
alter table distribuciones enable row level security;

drop policy if exists p_exist_sel on existencias;
create policy p_exist_sel on existencias for select to authenticated
  using ((select es_staff()) or email = lower((select auth.jwt()) ->> 'email'));
drop policy if exists p_dist_sel on distribuciones;
create policy p_dist_sel on distribuciones for select to authenticated
  using ((select es_staff()) or de_email = lower((select auth.jwt()) ->> 'email') or a_email = lower((select auth.jwt()) ->> 'email'));

create or replace function _mi_email() returns text
language sql stable set search_path = public as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function _bodega(p_producto bigint) returns numeric
language sql stable security definer set search_path = public as $$
  select p.stock - coalesce((select sum(cantidad) from existencias e where e.producto_id = p.id), 0)
  from productos p where p.id = p_producto
$$;

-- Personas a las que el usuario actual puede entregar o recoger inventario
create or replace function equipo() returns table (email text, nombre text, rol text)
language sql stable security definer set search_path = public as $$
  select a.email, a.nombre, a.rol from autorizados a
  where a.activo and (
    (mi_rol() = 'admin') or
    (mi_rol() = 'manager' and (a.rol = 'vendedor' or a.email = _mi_email()))
  )
  order by case a.rol when 'admin' then 0 when 'manager' then 1 else 2 end, a.nombre
$$;

-- Entregar (de bodega o de mi mano → persona) o recoger/devolver (persona → bodega)
create or replace function distribuir(p_producto bigint, p_cantidad numeric, p_de text, p_a text, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  yo text := _mi_email(); rol_yo text := mi_rol();
  de text := nullif(lower(trim(p_de)), ''); a text := nullif(lower(trim(p_a)), '');
  rol_a text; rol_de text; prod productos; disp numeric;
begin
  if rol_yo is null then raise exception 'Sin permiso'; end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'Cantidad inválida'; end if;
  if (de is null and a is null) or de = a then raise exception 'Movimiento inválido'; end if;
  select * into prod from productos where id = p_producto for update;
  if not found or prod.es_servicio then raise exception 'Ese producto no se puede repartir'; end if;

  if a is not null then
    select rol into rol_a from autorizados where email = a and activo;
    if rol_a is null then raise exception 'Esa persona no tiene acceso al CRM'; end if;
  end if;
  if de is not null then
    select rol into rol_de from autorizados where email = de;
  end if;

  if a is not null then
    -- Entregar: admin a manager/vendedor; manager a vendedor. El origen es la bodega o mi propia mano.
    if not (rol_yo = 'admin' or (rol_yo = 'manager' and rol_a = 'vendedor')) then
      raise exception 'No podés entregarle inventario a esa persona';
    end if;
    if de is not null and de <> yo then raise exception 'Solo podés entregar de la bodega o de lo que tenés vos'; end if;
  else
    -- Recoger/devolver a bodega: cada quien devuelve lo suyo; admin recoge de cualquiera; manager de vendedores.
    if not (de = yo or rol_yo = 'admin' or (rol_yo = 'manager' and rol_de = 'vendedor')) then
      raise exception 'No podés recoger inventario de esa persona';
    end if;
  end if;

  if de is null then
    disp := _bodega(p_producto);
    if disp < p_cantidad then raise exception 'En bodega solo hay % de %', disp, prod.nombre; end if;
  else
    select coalesce((select cantidad from existencias where email = de and producto_id = p_producto for update), 0) into disp;
    if disp < p_cantidad then raise exception 'Esa persona solo tiene % de %', disp, prod.nombre; end if;
    update existencias set cantidad = cantidad - p_cantidad where email = de and producto_id = p_producto;
  end if;

  if a is not null then
    insert into existencias (email, producto_id, cantidad) values (a, p_producto, p_cantidad)
    on conflict (email, producto_id) do update set cantidad = existencias.cantidad + excluded.cantidad;
  end if;

  insert into distribuciones (producto_id, de_email, a_email, cantidad, nota, creado_por)
  values (p_producto, de, a, p_cantidad, p_nota, yo);
end $$;

-- Lo que el usuario actual puede vender de cada producto
create or replace function mi_disponible() returns table (producto_id bigint, mio numeric, bodega numeric)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce((select cantidad from existencias e where e.email = _mi_email() and e.producto_id = p.id), 0),
         case when es_staff() then _bodega(p.id) else 0 end
  from productos p where tiene_acceso() and p.activo and not p.es_servicio
$$;

-- Resumen por persona y producto: tiene, recibió, devolvió, vendió
create or replace function inventario_personas() returns table (
  email text, nombre text, rol text, producto_id bigint, producto text,
  tiene numeric, recibido numeric, devuelto numeric, vendido numeric, monto_vendido numeric)
language sql stable security definer set search_path = public as $$
  with gente as (
    select a.email, a.nombre, a.rol from autorizados a
    where mi_rol() = 'admin'
       or (mi_rol() = 'manager' and (a.rol = 'vendedor' or a.email = _mi_email()))
       or a.email = _mi_email()
  ),
  ventas_p as (
    select v.vendedor_email as email, vi.producto_id, sum(vi.cantidad) cant, sum(vi.cantidad * vi.precio) monto
    from ventas v join venta_items vi on vi.venta_id = v.id
    where v.estado <> 'anulada' group by 1, 2
  ),
  pares as (
    select email, producto_id from existencias
    union select a_email, producto_id from distribuciones where a_email is not null
    union select email, producto_id from ventas_p where producto_id is not null
  )
  select g.email, g.nombre, g.rol, pr.id, pr.nombre || coalesce(' · ' || pr.variante, ''),
    coalesce((select cantidad from existencias e where e.email = g.email and e.producto_id = pr.id), 0),
    coalesce((select sum(cantidad) from distribuciones d where d.a_email = g.email and d.producto_id = pr.id), 0),
    coalesce((select sum(cantidad) from distribuciones d where d.de_email = g.email and d.a_email is null and d.producto_id = pr.id), 0),
    coalesce(vp.cant, 0), coalesce(vp.monto, 0)
  from gente g
  join pares pa on pa.email = g.email
  join productos pr on pr.id = pa.producto_id
  left join ventas_p vp on vp.email = g.email and vp.producto_id = pr.id
  order by g.nombre, pr.nombre
$$;

-- Venta: descuenta primero de lo que tiene asignado quien vende
create or replace function registrar_venta(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint; it jsonb; prod productos;
  v_cant numeric; v_precio numeric; v_mio numeric; v_mano numeric; v_resto numeric;
  v_sub numeric := 0;
  v_desc numeric := coalesce((p->>'descuento')::numeric, 0);
  v_pago numeric := coalesce((p->>'pago')::numeric, 0);
  v_cuenta text := coalesce(p->>'cuenta', 'efectivo');
  v_total numeric;
  yo text := _mi_email();
begin
  if not tiene_acceso() then raise exception 'Sin permiso'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  insert into ventas (cliente_id, canal, evento_id, descuento, notas, vendedor_email, estado)
  values ((p->>'cliente_id')::bigint, coalesce(p->>'canal', 'general'), (p->>'evento_id')::bigint,
          v_desc, p->>'notas', yo, 'pendiente')
  returning id into v_id;

  for it in select * from jsonb_array_elements(p->'items') loop
    select * into prod from productos where id = (it->>'producto_id')::bigint for update;
    if not found then raise exception 'Un producto ya no existe'; end if;
    v_cant := (it->>'cantidad')::numeric;
    v_precio := coalesce((it->>'precio')::numeric, prod.precio);
    if v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    v_mano := 0;
    if not prod.es_servicio then
      select coalesce((select cantidad from existencias where email = yo and producto_id = prod.id for update), 0) into v_mio;
      v_mano := least(v_mio, v_cant);
      v_resto := v_cant - v_mano;
      if v_resto > 0 then
        if not es_staff() then
          raise exception 'Solo tenés % de % asignados. Pedile a un manager que te entregue más.', v_mio, prod.nombre;
        end if;
        if _bodega(prod.id) < v_resto then
          raise exception 'No hay suficiente stock de % (quedan % en bodega)', prod.nombre, _bodega(prod.id);
        end if;
      end if;
      if v_mano > 0 then
        update existencias set cantidad = cantidad - v_mano where email = yo and producto_id = prod.id;
      end if;
      update productos set stock = stock - v_cant where id = prod.id;
    end if;
    insert into venta_items (venta_id, producto_id, nombre, cantidad, precio, costo, de_mano)
    values (v_id, prod.id, prod.nombre || coalesce(' · ' || prod.variante, ''), v_cant, v_precio, prod.costo, v_mano);
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
    values (v_cuenta, v_pago, 'venta', v_id, 'Venta #' || v_id, yo);
  end if;
  return v_id;
end $$;

-- Anular: devuelve el stock y, lo que salió de la mano del vendedor, vuelve a su mano
create or replace function anular_venta(p_venta bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v ventas;
begin
  if not es_staff() then raise exception 'Solo admin o manager pueden anular ventas'; end if;
  select * into v from ventas where id = p_venta for update;
  if not found or v.estado = 'anulada' then raise exception 'Venta no válida'; end if;
  update productos pr set stock = pr.stock + vi.cantidad
  from venta_items vi where vi.venta_id = p_venta and vi.producto_id = pr.id and not pr.es_servicio;
  insert into existencias (email, producto_id, cantidad)
  select v.vendedor_email, vi.producto_id, vi.de_mano from venta_items vi
  where vi.venta_id = p_venta and vi.de_mano > 0 and vi.producto_id is not null and v.vendedor_email is not null
  on conflict (email, producto_id) do update set cantidad = existencias.cantidad + excluded.cantidad;
  insert into movimientos (cuenta, monto, tipo, venta_id, nota, creado_por)
  select cuenta, -sum(monto), 'anulacion', p_venta, 'Anulación venta #' || p_venta, _mi_email()
  from movimientos where venta_id = p_venta group by cuenta having sum(monto) <> 0;
  update ventas set estado = 'anulada', pagado = 0 where id = p_venta;
end $$;

-- Un ajuste de stock (merma, conteo) no puede dejar la bodega en negativo
create or replace function ajustar_stock(p_producto bigint, p_cantidad numeric, p_motivo text, p_nota text, p_evento bigint default null) returns void
language plpgsql security definer set search_path = public as $$
declare prod productos;
begin
  if not es_staff() then raise exception 'Sin permiso'; end if;
  select * into prod from productos where id = p_producto for update;
  if not found then raise exception 'Producto no existe'; end if;
  if p_cantidad = 0 then return; end if;
  if p_cantidad < 0 and _bodega(p_producto) < -p_cantidad then
    raise exception 'En bodega solo hay % (el resto está repartido). Recogé primero lo que haga falta.', _bodega(p_producto);
  end if;
  insert into ajustes_stock (producto_id, cantidad, motivo, costo, evento_id, nota, creado_por)
  values (p_producto, p_cantidad, p_motivo, prod.costo, p_evento, p_nota, _mi_email());
  update productos set stock = stock + p_cantidad where id = p_producto;
end $$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;

-- ---------------------------------------------------------------------
-- Nombres de perfil
-- ---------------------------------------------------------------------
create or replace function cambiar_mi_nombre(p_nombre text) returns void
language plpgsql security definer set search_path = public as $$
declare n text := nullif(trim(p_nombre), '');
begin
  if not tiene_acceso() then raise exception 'Sin permiso'; end if;
  if n is null or length(n) > 60 then raise exception 'Escribí un nombre de hasta 60 letras'; end if;
  update autorizados set nombre = n where email = _mi_email();
end $$;

create or replace function nombres_equipo() returns table (email text, nombre text)
language sql stable security definer set search_path = public as $$
  select a.email, coalesce(a.nombre, a.email) from autorizados a where tiene_acceso()
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;

-- ---------------------------------------------------------------------
-- Compra al por mayor: costo_total + unidades, precio de venta y producto nuevo
-- (reemplaza registrar_compra de schema.sql)
-- ---------------------------------------------------------------------
create or replace function registrar_compra(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint; it jsonb; prod productos; v_cant numeric; v_costo numeric; v_linea numeric; v_total numeric := 0;
  v_pago numeric := coalesce((p->>'pago')::numeric, 0);
  v_cuenta text := coalesce(p->>'cuenta', 'efectivo');
  v_precio numeric;
begin
  if not es_staff() then raise exception 'Sin permiso'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then raise exception 'La compra no tiene productos'; end if;
  insert into compras (fecha, proveedor_id, evento_id, notas, creado_por)
  values (coalesce((p->>'fecha')::date, current_date), (p->>'proveedor_id')::bigint,
          (p->>'evento_id')::bigint, p->>'notas', auth.jwt()->>'email')
  returning id into v_id;
  for it in select * from jsonb_array_elements(p->'items') loop
    v_cant := (it->>'cantidad')::numeric;
    if v_cant is null or v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    v_precio := nullif(it->>'precio', '')::numeric;
    if it ? 'nuevo' then
      if coalesce(trim(it->'nuevo'->>'nombre'), '') = '' then raise exception 'Falta el nombre del producto nuevo'; end if;
      insert into productos (nombre, variante, categoria, precio, costo, stock)
      values (trim(it->'nuevo'->>'nombre'), nullif(trim(it->'nuevo'->>'variante'), ''),
              coalesce(nullif(trim(it->'nuevo'->>'categoria'), ''), 'General'), coalesce(v_precio, 0), 0, 0)
      returning * into prod;
    else
      select * into prod from productos where id = (it->>'producto_id')::bigint for update;
      if not found then raise exception 'Un producto ya no existe'; end if;
    end if;
    if it ? 'costo_total' then
      v_linea := (it->>'costo_total')::numeric;
      v_costo := round(v_linea / v_cant, 2);
    else
      v_costo := (it->>'costo')::numeric;
      v_linea := v_cant * v_costo;
    end if;
    if v_linea is null or v_linea < 0 then raise exception 'Costo inválido'; end if;
    insert into compra_items (compra_id, producto_id, nombre, cantidad, costo)
    values (v_id, prod.id, prod.nombre || coalesce(' · ' || prod.variante, ''), v_cant, v_costo);
    update productos set
      costo = case when greatest(stock, 0) + v_cant > 0
                   then round((greatest(stock, 0) * costo + v_linea) / (greatest(stock, 0) + v_cant), 2)
                   else v_costo end,
      stock = stock + v_cant,
      precio = coalesce(v_precio, precio)
    where id = prod.id;
    v_total := v_total + v_linea;
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

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
