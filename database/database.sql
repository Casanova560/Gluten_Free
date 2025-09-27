-- ======================================================================
-- dltaller_app - SCRIPT COMPLETO (MySQL 8+)
-- Crea esquema, tablas, FKs, índices y vistas en orden válido.
-- ======================================================================

-- Contexto de BD
CREATE DATABASE IF NOT EXISTS dltaller_app
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE dltaller_app;

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ======================================================================
-- 1) Catálogos/base
-- ======================================================================
CREATE TABLE app_user (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL UNIQUE,
  full_name VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE uom (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE producto (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(64) NOT NULL UNIQUE,
  nombre VARCHAR(160) NOT NULL,
  tipo ENUM('MP','PT') NOT NULL,
  uom_base_id BIGINT NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_producto_uom_base FOREIGN KEY (uom_base_id) REFERENCES uom(id)
) ENGINE=InnoDB;

CREATE INDEX ix_producto_nombre ON producto(nombre);

CREATE TABLE cliente (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(160) NOT NULL,
  num_doc VARCHAR(40),
  telefono VARCHAR(40),
  email VARCHAR(120),
  direccion VARCHAR(240),
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cliente_num_doc (num_doc)
) ENGINE=InnoDB;

CREATE INDEX ix_cliente_nombre ON cliente(nombre);
CREATE INDEX ix_cliente_num_doc ON cliente(num_doc);

CREATE TABLE proveedor (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(160) NOT NULL,
  num_doc VARCHAR(40),
  telefono VARCHAR(40),
  email VARCHAR(120),
  direccion VARCHAR(240),
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_proveedor_num_doc (num_doc)
) ENGINE=InnoDB;

CREATE INDEX ix_proveedor_nombre ON proveedor(nombre);
CREATE INDEX ix_proveedor_num_doc ON proveedor(num_doc);

CREATE TABLE ubicacion (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  tipo ENUM('BODEGA','PRODUCCION','TIENDA') NOT NULL DEFAULT 'BODEGA',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ======================================================================
-- 2) Rutas
-- ======================================================================
CREATE TABLE ruta (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  descripcion VARCHAR(255),
  dia_semana TINYINT,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT ck_ruta_dia CHECK (dia_semana IS NULL OR (dia_semana BETWEEN 1 AND 7))
) ENGINE=InnoDB;

CREATE TABLE ruta_entrega (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  ruta_id BIGINT NOT NULL,
  cliente_id BIGINT NOT NULL,
  orden INT NOT NULL,
  ventana_horaria VARCHAR(60),
  nota VARCHAR(200),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rent_ruta    FOREIGN KEY (ruta_id) REFERENCES ruta(id) ON DELETE CASCADE,
  CONSTRAINT fk_rent_cliente FOREIGN KEY (cliente_id) REFERENCES cliente(id) ON DELETE CASCADE,
  CONSTRAINT ck_rent_orden CHECK (orden >= 1),
  UNIQUE KEY uq_rent_ruta_cliente (ruta_id, cliente_id),
  KEY ix_rent_ruta (ruta_id),
  KEY ix_rent_cliente (cliente_id),
  KEY ix_rent_ruta_orden (ruta_id, orden)
) ENGINE=InnoDB;

-- ======================================================================
-- 3) Recetas y producción
-- ======================================================================
CREATE TABLE receta (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(160) NOT NULL UNIQUE,
  producto_salida_id BIGINT,
  uom_salida_id BIGINT,
  nota TEXT,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_receta_prod_salida FOREIGN KEY (producto_salida_id) REFERENCES producto(id),
  CONSTRAINT fk_receta_uom_salida  FOREIGN KEY (uom_salida_id) REFERENCES uom(id)
) ENGINE=InnoDB;

CREATE TABLE receta_det (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  receta_id BIGINT NOT NULL,
  producto_id BIGINT NOT NULL,
  uom_id BIGINT NOT NULL,
  cantidad DECIMAL(18,6) NOT NULL,
  nota VARCHAR(200),
  CONSTRAINT fk_receta_det_receta FOREIGN KEY (receta_id) REFERENCES receta(id) ON DELETE CASCADE,
  CONSTRAINT fk_receta_det_prod   FOREIGN KEY (producto_id) REFERENCES producto(id),
  CONSTRAINT fk_receta_det_uom    FOREIGN KEY (uom_id) REFERENCES uom(id),
  CONSTRAINT ck_receta_det_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;

CREATE TABLE receta_salida (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  receta_id BIGINT NOT NULL,
  producto_id BIGINT NOT NULL,
  uom_id BIGINT NOT NULL,
  rendimiento DECIMAL(18,6) NOT NULL,
  nota VARCHAR(200),
  CONSTRAINT fk_receta_salida_receta FOREIGN KEY (receta_id) REFERENCES receta(id) ON DELETE CASCADE,
  CONSTRAINT fk_receta_salida_prod   FOREIGN KEY (producto_id) REFERENCES producto(id),
  CONSTRAINT fk_receta_salida_uom    FOREIGN KEY (uom_id) REFERENCES uom(id),
  CONSTRAINT ck_receta_salida_rend   CHECK (rendimiento > 0)
) ENGINE=InnoDB;

CREATE TABLE tanda (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  fecha DATE NOT NULL,
  receta_id BIGINT,
  ubicacion_origen_id BIGINT,
  ubicacion_destino_id BIGINT,
  nota VARCHAR(240),
  created_by BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tanda_receta  FOREIGN KEY (receta_id) REFERENCES receta(id),
  CONSTRAINT fk_tanda_origen  FOREIGN KEY (ubicacion_origen_id) REFERENCES ubicacion(id),
  CONSTRAINT fk_tanda_destino FOREIGN KEY (ubicacion_destino_id) REFERENCES ubicacion(id),
  CONSTRAINT fk_tanda_user    FOREIGN KEY (created_by) REFERENCES app_user(id)
) ENGINE=InnoDB;

CREATE INDEX ix_tanda_fecha ON tanda(fecha);

CREATE TABLE tanda_consumo (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tanda_id BIGINT NOT NULL,
  producto_id BIGINT NOT NULL,
  uom_id BIGINT NOT NULL,
  cantidad DECIMAL(18,6) NOT NULL,
  CONSTRAINT fk_tconsumo_tanda FOREIGN KEY (tanda_id) REFERENCES tanda(id) ON DELETE CASCADE,
  CONSTRAINT fk_tconsumo_prod  FOREIGN KEY (producto_id) REFERENCES producto(id),
  CONSTRAINT fk_tconsumo_uom   FOREIGN KEY (uom_id) REFERENCES uom(id),
  CONSTRAINT ck_tconsumo_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;

CREATE TABLE tanda_salida (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tanda_id BIGINT NOT NULL,
  producto_id BIGINT NOT NULL,
  uom_id BIGINT NOT NULL,
  cantidad DECIMAL(18,6) NOT NULL,
  CONSTRAINT fk_tsalida_tanda FOREIGN KEY (tanda_id) REFERENCES tanda(id) ON DELETE CASCADE,
  CONSTRAINT fk_tsalida_prod  FOREIGN KEY (producto_id) REFERENCES producto(id),
  CONSTRAINT fk_tsalida_uom   FOREIGN KEY (uom_id) REFERENCES uom(id),
  CONSTRAINT ck_tsalida_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;

-- ======================================================================
-- 4) Compras / Ventas
-- ======================================================================
CREATE TABLE compra (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  fecha DATE NOT NULL,
  proveedor_id BIGINT NOT NULL,
  moneda ENUM('CRC','USD') NOT NULL DEFAULT 'CRC',
  tipo_cambio DECIMAL(18,6),
  condicion_pago ENUM('CONTADO','CREDITO') NOT NULL DEFAULT 'CONTADO',
  dias_credito INT,
  fecha_limite DATE,
  estado_cobro_pago ENUM('PENDIENTE','PAGADO') NOT NULL DEFAULT 'PENDIENTE',
  nota VARCHAR(240),
  created_by BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_compra_prov FOREIGN KEY (proveedor_id) REFERENCES proveedor(id),
  CONSTRAINT fk_compra_user FOREIGN KEY (created_by) REFERENCES app_user(id)
) ENGINE=InnoDB;

CREATE INDEX ix_compra_fecha ON compra(fecha);

CREATE TABLE compra_det (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  compra_id BIGINT NOT NULL,
  producto_id BIGINT NOT NULL,
  uom_id BIGINT NOT NULL,
  cantidad DECIMAL(18,6) NOT NULL,
  costo_unitario_crc DECIMAL(18,6) NOT NULL,
  descuento_crc DECIMAL(18,6) NOT NULL DEFAULT 0,
  CONSTRAINT fk_cdet_compra FOREIGN KEY (compra_id) REFERENCES compra(id) ON DELETE CASCADE,
  CONSTRAINT fk_cdet_prod   FOREIGN KEY (producto_id) REFERENCES producto(id),
  CONSTRAINT fk_cdet_uom    FOREIGN KEY (uom_id) REFERENCES uom(id),
  CONSTRAINT ck_cdet_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_cdet_cost     CHECK (costo_unitario_crc >= 0),
  CONSTRAINT ck_cdet_desc     CHECK (descuento_crc >= 0)
) ENGINE=InnoDB;

CREATE TABLE venta (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  fecha DATE NOT NULL,
  cliente_id BIGINT NOT NULL,
  moneda ENUM('CRC','USD') NOT NULL DEFAULT 'CRC',
  tipo_cambio DECIMAL(18,6),
  condicion_pago ENUM('CONTADO','CREDITO') NOT NULL DEFAULT 'CONTADO',
  dias_credito INT,
  fecha_limite DATE,
  estado_cobro_pago ENUM('PENDIENTE','PAGADO') NOT NULL DEFAULT 'PENDIENTE',
  ruta_id BIGINT,
  nota VARCHAR(240),
  created_by BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_venta_cliente FOREIGN KEY (cliente_id) REFERENCES cliente(id),
  CONSTRAINT fk_venta_ruta    FOREIGN KEY (ruta_id) REFERENCES ruta(id),
  CONSTRAINT fk_venta_user    FOREIGN KEY (created_by) REFERENCES app_user(id)
) ENGINE=InnoDB;

CREATE INDEX ix_venta_fecha ON venta(fecha);

CREATE TABLE venta_det (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  venta_id BIGINT NOT NULL,
  producto_id BIGINT NOT NULL,
  uom_id BIGINT NOT NULL,
  cantidad DECIMAL(18,6) NOT NULL,
  precio_unitario_crc DECIMAL(18,6) NOT NULL,
  descuento_crc DECIMAL(18,6) NOT NULL DEFAULT 0,
  CONSTRAINT fk_vdet_venta FOREIGN KEY (venta_id) REFERENCES venta(id) ON DELETE CASCADE,
  CONSTRAINT fk_vdet_prod  FOREIGN KEY (producto_id) REFERENCES producto(id),
  CONSTRAINT fk_vdet_uom   FOREIGN KEY (uom_id) REFERENCES uom(id),
  CONSTRAINT ck_vdet_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_vdet_precio   CHECK (precio_unitario_crc >= 0),
  CONSTRAINT ck_vdet_desc     CHECK (descuento_crc >= 0)
) ENGINE=InnoDB;

-- ======================================================================
-- 5) Gastos, inversiones, planilla, empleados, vacaciones
-- ======================================================================
CREATE TABLE categoria_gasto (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE gasto (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  fecha DATE NOT NULL,
  categoria_id BIGINT NOT NULL,
  monto_crc DECIMAL(18,6) NOT NULL,
  proveedor_id BIGINT,
  metodo_pago ENUM('EFECTIVO','TRANSFERENCIA','TARJETA','OTRO') NOT NULL DEFAULT 'EFECTIVO',
  nota VARCHAR(240),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gasto_categoria FOREIGN KEY (categoria_id) REFERENCES categoria_gasto(id),
  CONSTRAINT fk_gasto_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedor(id),
  CONSTRAINT ck_gasto_monto CHECK (monto_crc > 0)
) ENGINE=InnoDB;

CREATE INDEX ix_gasto_fecha ON gasto(fecha);

CREATE TABLE inversion (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  fecha DATE NOT NULL,
  item VARCHAR(160) NOT NULL,
  monto_crc DECIMAL(18,6) NOT NULL,
  proveedor_id BIGINT,
  nota VARCHAR(240),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inversion_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedor(id),
  CONSTRAINT ck_inversion_monto CHECK (monto_crc > 0)
) ENGINE=InnoDB;

CREATE INDEX ix_inversion_fecha ON inversion(fecha);

CREATE TABLE empleado (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(160) NOT NULL,
  num_doc VARCHAR(40),
  telefono VARCHAR(40),
  email VARCHAR(120),
  direccion VARCHAR(240),
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_empleado_num_doc (num_doc)
) ENGINE=InnoDB;

CREATE TABLE planilla_semana (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  semana_inicio DATE NOT NULL,
  nota VARCHAR(240),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_planilla_semana (semana_inicio)
) ENGINE=InnoDB;

CREATE TABLE planilla_det (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  planilla_id BIGINT NOT NULL,
  empleado_id BIGINT NULL,
  persona VARCHAR(160) NULL,
  rol VARCHAR(120),
  horas_previstas DECIMAL(10,2) NOT NULL DEFAULT 0,
  horas_efectivas DECIMAL(10,2) NOT NULL DEFAULT 0,
  tarifa_hora_crc DECIMAL(18,6) NOT NULL DEFAULT 0,
  estado_pago ENUM('PENDIENTE','PAGADO') NOT NULL DEFAULT 'PENDIENTE',
  CONSTRAINT fk_planilla_det FOREIGN KEY (planilla_id) REFERENCES planilla_semana(id) ON DELETE CASCADE,
  CONSTRAINT fk_planilla_det_empleado FOREIGN KEY (empleado_id) REFERENCES empleado(id),
  CONSTRAINT ck_horas_prev CHECK (horas_previstas >= 0),
  CONSTRAINT ck_horas_efec CHECK (horas_efectivas >= 0),
  CONSTRAINT ck_tarifa CHECK (tarifa_hora_crc >= 0)
) ENGINE=InnoDB;

CREATE TABLE vacaciones (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  empleado_id BIGINT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  dias_total DECIMAL(6,2) NOT NULL,
  estado ENUM('SOLICITADO','APROBADO','RECHAZADO','GOZADO') NOT NULL DEFAULT 'SOLICITADO',
  nota VARCHAR(240),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vac_empleado FOREIGN KEY (empleado_id) REFERENCES empleado(id),
  CONSTRAINT ck_vac_dias  CHECK (dias_total > 0),
  CONSTRAINT ck_vac_rango CHECK (fecha_fin >= fecha_inicio)
) ENGINE=InnoDB;

-- ======================================================================
-- 6) Idempotencia
-- ======================================================================
CREATE TABLE idempotency_key (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  scope VARCHAR(80) NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  request_hash VARCHAR(128) NOT NULL,
  response_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_idem (scope, idempotency_key)
) ENGINE=InnoDB;

-- ======================================================================
-- 7) Tesorería (cobros/pagos)
-- ======================================================================
CREATE TABLE cobro (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  venta_id BIGINT NOT NULL,
  fecha DATE NOT NULL,
  monto_crc DECIMAL(18,6) NOT NULL,
  metodo ENUM('EFECTIVO','TRANSFERENCIA','TARJETA','OTRO') NOT NULL DEFAULT 'EFECTIVO',
  referencia VARCHAR(120),
  nota VARCHAR(240),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cobro_venta FOREIGN KEY (venta_id) REFERENCES venta(id) ON DELETE CASCADE,
  CONSTRAINT ck_cobro_monto CHECK (monto_crc > 0)
) ENGINE=InnoDB;

CREATE INDEX ix_cobro_venta ON cobro(venta_id);
CREATE INDEX ix_cobro_fecha ON cobro(fecha);

CREATE TABLE pago (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  compra_id BIGINT NOT NULL,
  fecha DATE NOT NULL,
  monto_crc DECIMAL(18,6) NOT NULL,
  metodo ENUM('EFECTIVO','TRANSFERENCIA','TARJETA','OTRO') NOT NULL DEFAULT 'EFECTIVO',
  referencia VARCHAR(120),
  nota VARCHAR(240),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pago_compra FOREIGN KEY (compra_id) REFERENCES compra(id) ON DELETE CASCADE,
  CONSTRAINT ck_pago_monto CHECK (monto_crc > 0)
) ENGINE=InnoDB;

CREATE INDEX ix_pago_compra ON pago(compra_id);
CREATE INDEX ix_pago_fecha ON pago(fecha);

-- ======================================================================
-- 8) Inventario (kardex) y merma
-- ======================================================================
CREATE TABLE inv_mov (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  fecha DATETIME NOT NULL,
  producto_id BIGINT NOT NULL,
  uom_id BIGINT NOT NULL,
  tipo ENUM('IN','OUT','ADJ') NOT NULL,
  cantidad DECIMAL(18,6) NOT NULL,
  motivo ENUM('COMPRA','PRODUCCION_SALIDA','CONSUMO_RECETA','VENTA','MERMA','AJUSTE') NOT NULL,
  ref_tabla VARCHAR(40),
  ref_id BIGINT,
  ubicacion_id BIGINT,
  nota VARCHAR(240),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_imov_producto FOREIGN KEY (producto_id) REFERENCES producto(id),
  CONSTRAINT fk_imov_uom      FOREIGN KEY (uom_id) REFERENCES uom(id),
  CONSTRAINT fk_imov_ubic     FOREIGN KEY (ubicacion_id) REFERENCES ubicacion(id),
  CONSTRAINT ck_imov_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;

CREATE INDEX ix_imov_prod_fecha ON inv_mov(producto_id, fecha);
CREATE INDEX ix_imov_tipo ON inv_mov(tipo);

CREATE TABLE merma (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  fecha DATE NOT NULL,
  producto_id BIGINT NOT NULL,
  uom_id BIGINT NOT NULL,
  cantidad DECIMAL(18,6) NOT NULL,
  ubicacion_id BIGINT,
  motivo VARCHAR(160),
  nota VARCHAR(240),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_merma_prod FOREIGN KEY (producto_id) REFERENCES producto(id),
  CONSTRAINT fk_merma_uom  FOREIGN KEY (uom_id) REFERENCES uom(id),
  CONSTRAINT fk_merma_ubi  FOREIGN KEY (ubicacion_id) REFERENCES ubicacion(id),
  CONSTRAINT ck_merma_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;

CREATE INDEX ix_merma_fecha ON merma(fecha);
CREATE INDEX ix_merma_prod  ON merma(producto_id);

-- ======================================================================
-- 9) Costos indirectos (para costeo)
-- ======================================================================
CREATE TABLE costo_indirecto (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(160) NOT NULL,
  monto_mensual_crc DECIMAL(18,6) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_ci_monto CHECK (monto_mensual_crc >= 0)
) ENGINE=InnoDB;

-- ======================================================================
-- 10) Vistas (crear en orden: primero totales/base, luego dependientes)
-- ======================================================================

-- Existencias simples por MP/PT (basadas en compras/consumos y producción/ventas)
CREATE OR REPLACE VIEW v_existencias_mp AS
SELECT
  p.id AS producto_id, p.sku, p.nombre, p.uom_base_id,
  COALESCE(cmp.total_comp, 0) - COALESCE(tcons.total_cons, 0) AS existencias,
  COALESCE(cmp.total_comp, 0) AS total_comprado,
  COALESCE(tcons.total_cons, 0) AS total_consumido
FROM producto p
LEFT JOIN (
  SELECT cd.producto_id, SUM(cd.cantidad) AS total_comp
  FROM compra_det cd JOIN compra c ON c.id = cd.compra_id
  GROUP BY cd.producto_id
) cmp ON cmp.producto_id = p.id
LEFT JOIN (
  SELECT tc.producto_id, SUM(tc.cantidad) AS total_cons
  FROM tanda_consumo tc JOIN tanda t ON t.id = tc.tanda_id
  GROUP BY tc.producto_id
) tcons ON tcons.producto_id = p.id
WHERE p.tipo = 'MP';

CREATE OR REPLACE VIEW v_existencias_pt AS
SELECT
  p.id AS producto_id, p.sku, p.nombre, p.uom_base_id,
  COALESCE(tsal.total_prod, 0) - COALESCE(vd.total_vtas, 0) AS existencias,
  COALESCE(tsal.total_prod, 0) AS total_producido,
  COALESCE(vd.total_vtas, 0) AS total_vendido
FROM producto p
LEFT JOIN (
  SELECT ts.producto_id, SUM(ts.cantidad) AS total_prod
  FROM tanda_salida ts JOIN tanda t ON t.id = ts.tanda_id
  GROUP BY ts.producto_id
) tsal ON tsal.producto_id = p.id
LEFT JOIN (
  SELECT vd.producto_id, SUM(vd.cantidad) AS total_vtas
  FROM venta_det vd JOIN venta v ON v.id = vd.venta_id
  GROUP BY vd.producto_id
) vd ON vd.producto_id = p.id
WHERE p.tipo = 'PT';

-- Totales por cabecera (compras/ventas) - base para CxP/CxC
CREATE OR REPLACE VIEW v_compra_totales AS
SELECT
  c.id, c.fecha, c.proveedor_id,
  SUM((cd.costo_unitario_crc * cd.cantidad) - cd.descuento_crc) AS total_crc
FROM compra c
LEFT JOIN compra_det cd ON cd.compra_id = c.id
GROUP BY c.id, c.fecha, c.proveedor_id;

CREATE OR REPLACE VIEW v_venta_totales AS
SELECT
  v.id, v.fecha, v.cliente_id, v.ruta_id,
  SUM((vd.precio_unitario_crc * vd.cantidad) - vd.descuento_crc) AS total_crc
FROM venta v
LEFT JOIN venta_det vd ON vd.venta_id = v.id
GROUP BY v.id, v.fecha, v.cliente_id, v.ruta_id;

-- Sugerencias por frecuencia
CREATE OR REPLACE VIEW v_producto_sugerencias AS
SELECT p.id, p.sku, p.nombre, p.tipo,
       COALESCE(vv.usos, 0) + COALESCE(cc.usos, 0) + COALESCE(ts.usos, 0) AS score_uso
FROM producto p
LEFT JOIN ( SELECT vd.producto_id, COUNT(*) usos FROM venta_det vd GROUP BY vd.producto_id ) vv
  ON vv.producto_id = p.id
LEFT JOIN ( SELECT cd.producto_id, COUNT(*) usos FROM compra_det cd GROUP BY cd.producto_id ) cc
  ON cc.producto_id = p.id
LEFT JOIN ( SELECT ts.producto_id, COUNT(*) usos FROM tanda_salida ts GROUP BY ts.producto_id ) ts
  ON ts.producto_id = p.id
ORDER BY score_uso DESC;

-- Clientes por ruta
CREATE OR REPLACE VIEW v_ruta_clientes AS
SELECT r.id AS ruta_id, r.nombre AS ruta_nombre, r.dia_semana,
       re.cliente_id, c.nombre AS cliente_nombre, re.orden, re.ventana_horaria
FROM ruta r
JOIN ruta_entrega re ON re.ruta_id = r.id
JOIN cliente c       ON c.id = re.cliente_id
ORDER BY r.id, re.orden;

-- Resumen por movimientos (últimas entradas/salidas + saldo por kardex)
CREATE OR REPLACE VIEW v_inventario_resumen AS
SELECT
  p.id AS producto_id, p.sku, p.nombre, p.tipo,
  MAX(CASE WHEN im.tipo='IN'  THEN im.fecha END)  AS ultima_entrada,
  MAX(CASE WHEN im.tipo='OUT' THEN im.fecha END)  AS ultima_salida,
  SUM(CASE WHEN im.tipo='IN'  THEN im.cantidad ELSE 0 END)
  - SUM(CASE WHEN im.tipo='OUT' THEN im.cantidad ELSE 0 END) AS existencias_mov
FROM producto p
LEFT JOIN inv_mov im ON im.producto_id = p.id
GROUP BY p.id, p.sku, p.nombre, p.tipo;

-- Último costo de compra por producto
CREATE OR REPLACE VIEW v_ultimo_costo_compra AS
SELECT
  cd.producto_id,
  CAST(SUBSTRING_INDEX(
    GROUP_CONCAT(cd.costo_unitario_crc ORDER BY c.fecha DESC, cd.id DESC),
    ',', 1
  ) AS DECIMAL(18,6)) AS costo_unitario_crc
FROM compra_det cd
JOIN compra c ON c.id = cd.compra_id
GROUP BY cd.producto_id;

-- Costo directo por receta
CREATE OR REPLACE VIEW v_costo_receta_directo AS
SELECT r.id AS receta_id, r.nombre AS receta_nombre,
       SUM(rd.cantidad * COALESCE(ucc.costo_unitario_crc, 0)) AS costo_directo_crc
FROM receta r
JOIN receta_det rd ON rd.receta_id = r.id
LEFT JOIN v_ultimo_costo_compra ucc ON ucc.producto_id = rd.producto_id
GROUP BY r.id, r.nombre;

-- Producción del mes actual (para prorrateo simple)
CREATE OR REPLACE VIEW v_produccion_mes_actual AS
SELECT ts.producto_id, ts.tanda_id, t.receta_id, SUM(ts.cantidad) AS cantidad_total
FROM tanda_salida ts
JOIN tanda t ON t.id = ts.tanda_id
WHERE DATE_FORMAT(t.fecha, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
GROUP BY ts.producto_id, ts.tanda_id, t.receta_id;

-- Total de indirectos activos del mes (requiere costo_indirecto ya creado)
CREATE OR REPLACE VIEW v_indirecto_mes_actual AS
SELECT SUM(ci.monto_mensual_crc) AS total_indirecto_mes
FROM costo_indirecto ci
WHERE ci.activo = 1;

-- Costo total (directo + prorrateo por volumen mensual)
CREATE OR REPLACE VIEW v_costo_receta_total AS
SELECT
  r.id AS receta_id,
  r.nombre AS receta_nombre,
  COALESCE(crd.costo_directo_crc, 0) AS costo_directo_crc,
  COALESCE((SELECT total_indirecto_mes FROM v_indirecto_mes_actual), 0) *
    COALESCE(pmr.cant_receta / NULLIF(pmt.cant_total_mes,0), 0) AS costo_indirecto_asignado_crc,
  COALESCE(crd.costo_directo_crc, 0) +
  COALESCE((SELECT total_indirecto_mes FROM v_indirecto_mes_actual), 0) *
    COALESCE(pmr.cant_receta / NULLIF(pmt.cant_total_mes,0), 0) AS costo_total_crc
FROM receta r
LEFT JOIN v_costo_receta_directo crd ON crd.receta_id = r.id
LEFT JOIN ( SELECT receta_id, SUM(cantidad_total) AS cant_receta
            FROM v_produccion_mes_actual GROUP BY receta_id ) pmr ON pmr.receta_id = r.id
LEFT JOIN ( SELECT SUM(cantidad_total) AS cant_total_mes
            FROM v_produccion_mes_actual ) pmt ON 1=1;

-- CxC / CxP (requiere v_venta_totales y v_compra_totales)
CREATE OR REPLACE VIEW v_cxc AS
SELECT
  v.id AS venta_id, v.fecha, v.fecha_limite, v.cliente_id,
  (SELECT total_crc FROM v_venta_totales vt WHERE vt.id = v.id) AS total_crc,
  COALESCE((SELECT SUM(c.monto_crc) FROM cobro c WHERE c.venta_id = v.id), 0) AS cobrado_crc,
  ( (SELECT total_crc FROM v_venta_totales vt WHERE vt.id = v.id)
    - COALESCE((SELECT SUM(c.monto_crc) FROM cobro c WHERE c.venta_id = v.id), 0) ) AS saldo_crc,
  CASE
    WHEN v.estado_cobro_pago='PAGADO' THEN 0
    WHEN v.fecha_limite IS NULL THEN 0
    WHEN CURDATE() > v.fecha_limite THEN DATEDIFF(CURDATE(), v.fecha_limite)
    ELSE 0
  END AS dias_vencido
FROM venta v;

CREATE OR REPLACE VIEW v_cxp AS
SELECT
  c.id AS compra_id, c.fecha, c.fecha_limite, c.proveedor_id,
  (SELECT total_crc FROM v_compra_totales ct WHERE ct.id = c.id) AS total_crc,
  COALESCE((SELECT SUM(p.monto_crc) FROM pago p WHERE p.compra_id = c.id), 0) AS pagado_crc,
  ( (SELECT total_crc FROM v_compra_totales ct WHERE ct.id = c.id)
    - COALESCE((SELECT SUM(p.monto_crc) FROM pago p WHERE p.compra_id = c.id), 0) ) AS saldo_crc,
  CASE
    WHEN c.estado_cobro_pago='PAGADO' THEN 0
    WHEN c.fecha_limite IS NULL THEN 0
    WHEN CURDATE() > c.fecha_limite THEN DATEDIFF(CURDATE(), c.fecha_limite)
    ELSE 0
  END AS dias_vencido
FROM compra c;

CREATE OR REPLACE VIEW v_cxc_tramos AS
SELECT
  cliente_id,
  SUM(CASE WHEN dias_vencido<=0 THEN saldo_crc ELSE 0 END) AS al_dia,
  SUM(CASE WHEN dias_vencido BETWEEN 1 AND 30 THEN saldo_crc ELSE 0 END) AS d1_30,
  SUM(CASE WHEN dias_vencido BETWEEN 31 AND 60 THEN saldo_crc ELSE 0 END) AS d31_60,
  SUM(CASE WHEN dias_vencido BETWEEN 61 AND 90 THEN saldo_crc ELSE 0 END) AS d61_90,
  SUM(CASE WHEN dias_vencido > 90 THEN saldo_crc ELSE 0 END) AS d90p
FROM v_cxc
WHERE saldo_crc > 0
GROUP BY cliente_id;

CREATE OR REPLACE VIEW v_cxp_tramos AS
SELECT
  proveedor_id,
  SUM(CASE WHEN dias_vencido<=0 THEN saldo_crc ELSE 0 END) AS al_dia,
  SUM(CASE WHEN dias_vencido BETWEEN 1 AND 30 THEN saldo_crc ELSE 0 END) AS d1_30,
  SUM(CASE WHEN dias_vencido BETWEEN 31 AND 60 THEN saldo_crc ELSE 0 END) AS d31_60,
  SUM(CASE WHEN dias_vencido BETWEEN 61 AND 90 THEN saldo_crc ELSE 0 END) AS d61_90,
  SUM(CASE WHEN dias_vencido > 90 THEN saldo_crc ELSE 0 END) AS d90p
FROM v_cxp
WHERE saldo_crc > 0
GROUP BY proveedor_id;

-- Dashboards
CREATE OR REPLACE VIEW v_ventas_diarias AS
SELECT v.fecha, SUM(vt.total_crc) AS total_crc
FROM venta v
JOIN v_venta_totales vt ON vt.id = v.id
GROUP BY v.fecha
ORDER BY v.fecha DESC;

CREATE OR REPLACE VIEW v_compras_diarias AS
SELECT c.fecha, SUM(ct.total_crc) AS total_crc
FROM compra c
JOIN v_compra_totales ct ON ct.id = c.id
GROUP BY c.fecha
ORDER BY c.fecha DESC;

CREATE OR REPLACE VIEW v_margen_directo_mes AS
SELECT
  DATE_FORMAT(v.fecha,'%Y-%m') AS ym,
  SUM(vt.total_crc) AS ventas_crc,
  COALESCE((SELECT SUM(crd.costo_directo_crc) FROM v_costo_receta_directo crd),0) AS costo_directo_crc_aprox,
  SUM(vt.total_crc) - COALESCE((SELECT SUM(crd.costo_directo_crc) FROM v_costo_receta_directo crd),0) AS margen_directo_crc
FROM venta v
JOIN v_venta_totales vt ON vt.id = v.id
GROUP BY ym
ORDER BY ym DESC;

-- ======================================================================
-- FIN
-- ======================================================================

-- ===========================
-- Costeo: tablas y vistas
-- ===========================

-- 1) Indirectos (pool mensual) y config de método
CREATE TABLE IF NOT EXISTS costo_indirecto (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(160) NOT NULL,
  monto_mensual_crc DECIMAL(18,6) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS config_costeo (
  id TINYINT PRIMARY KEY DEFAULT 1,
  metodo ENUM('PCT_DIRECTO','POR_HORA','POR_UNIDAD') NOT NULL DEFAULT 'PCT_DIRECTO',
  parametro_json JSON NULL,     -- ej: {"porcentaje":0.18} o {"tarifa_h":2500} o {"tarifa_unidad":35}
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO config_costeo (id, metodo, parametro_json)
VALUES (1, 'PCT_DIRECTO', JSON_OBJECT('porcentaje', NULL)); -- NULL => se calcula dinámico por pool/mes

-- 2) Costo promedio de MP (basado en compras)
CREATE OR REPLACE VIEW v_mp_costo_promedio AS
SELECT
  cd.producto_id,
  CASE WHEN SUM(cd.cantidad) > 0
       THEN SUM((cd.costo_unitario_crc * cd.cantidad) - cd.descuento_crc) / SUM(cd.cantidad)
       ELSE 0 END AS costo_prom_crc
FROM compra_det cd
JOIN compra c ON c.id = cd.compra_id
GROUP BY cd.producto_id;

-- 3) Costo directo por receta (componentes MP * costo promedio)
CREATE OR REPLACE VIEW v_costo_receta_directo AS
SELECT
  r.id AS receta_id,
  r.nombre AS receta_nombre,
  ROUND(SUM(rd.cantidad * COALESCE(mp.costo_prom_crc,0)), 6) AS costo_directo_crc
FROM receta r
JOIN receta_det rd        ON rd.receta_id = r.id
LEFT JOIN v_mp_costo_promedio mp ON mp.producto_id = rd.producto_id
GROUP BY r.id, r.nombre;

-- 4) Totales del mes (para calcular % indirecto si no está fijo en config)
--    Directo del mes: costo de consumos en tandas * costo promedio
CREATE OR REPLACE VIEW v_costo_directo_mes AS
SELECT
  DATE_FORMAT(CURRENT_DATE, '%Y-%m') AS ym,
  ROUND(SUM(tc.cantidad * COALESCE(mp.costo_prom_crc,0)),6) AS total_directo_mes_crc
FROM tanda_consumo tc
JOIN tanda t ON t.id = tc.tanda_id
LEFT JOIN v_mp_costo_promedio mp ON mp.producto_id = tc.producto_id
WHERE t.fecha >= DATE_FORMAT(CURRENT_DATE,'%Y-%m-01');

CREATE OR REPLACE VIEW v_indirecto_mes_actual AS
SELECT
  DATE_FORMAT(CURRENT_DATE, '%Y-%m') AS ym,
  ROUND(SUM(CASE WHEN ci.activo=1 THEN ci.monto_mensual_crc ELSE 0 END),6) AS total_indirecto_mes_crc
FROM costo_indirecto ci;

-- 5) Costo total de receta (directo + indirecto asignado)
--    Si config_costeo.parametro_json->'$.porcentaje' es NULL, calcula porcentaje dinámico:
--    pct = indirecto_mes / NULLIF(directo_mes,0). Si no hay base mes, pct=0.
CREATE OR REPLACE VIEW v_costo_receta_total AS
SELECT
  d.receta_id,
  d.receta_nombre,
  d.costo_directo_crc,
  ROUND(
    d.costo_directo_crc *
    COALESCE(
      JSON_EXTRACT(cc.parametro_json, '$.porcentaje'),
      (SELECT CASE WHEN vdm.total_directo_mes_crc > 0
                   THEN (vim.total_indirecto_mes_crc / vdm.total_directo_mes_crc)
                   ELSE 0 END
       FROM v_costo_directo_mes vdm, v_indirecto_mes_actual vim)
    )
  ,6) AS costo_indirecto_asignado_crc,
  ROUND(
    d.costo_directo_crc +
    d.costo_directo_crc *
    COALESCE(
      JSON_EXTRACT(cc.parametro_json, '$.porcentaje'),
      (SELECT CASE WHEN vdm.total_directo_mes_crc > 0
                   THEN (vim.total_indirecto_mes_crc / vdm.total_directo_mes_crc)
                   ELSE 0 END
       FROM v_costo_directo_mes vdm, v_indirecto_mes_actual vim)
    )
  ,6) AS costo_total_crc
FROM v_costo_receta_directo d
CROSS JOIN config_costeo cc;

-- 6) Costo real por tanda (consumos reales + indirecto por método)
--    Nota: el método POR_HORA/POR_UNIDAD usa parametro_json si existe.
CREATE OR REPLACE VIEW v_costo_tanda AS
SELECT
  t.id AS tanda_id,
  t.fecha,
  ROUND(SUM(tc.cantidad * COALESCE(mp.costo_prom_crc,0)),6) AS costo_directo_crc,
  -- Indirecto segun config:
  ROUND(CASE
    WHEN cc.metodo='PCT_DIRECTO' THEN
      SUM(tc.cantidad * COALESCE(mp.costo_prom_crc,0)) *
      COALESCE(JSON_EXTRACT(cc.parametro_json,'$.porcentaje'),
               (SELECT CASE WHEN vdm.total_directo_mes_crc > 0
                            THEN (vim.total_indirecto_mes_crc / vdm.total_directo_mes_crc)
                            ELSE 0 END
                FROM v_costo_directo_mes vdm, v_indirecto_mes_actual vim))
    WHEN cc.metodo='POR_HORA' THEN
      COALESCE(JSON_EXTRACT(cc.parametro_json,'$.tarifa_h'),0) * COALESCE(JSON_EXTRACT(t.nota,'$.horas'),0)
    WHEN cc.metodo='POR_UNIDAD' THEN
      COALESCE(JSON_EXTRACT(cc.parametro_json,'$.tarifa_unidad'),0) *
      (SELECT COALESCE(SUM(ts.cantidad),0) FROM tanda_salida ts WHERE ts.tanda_id=t.id)
    ELSE 0 END, 6
  ) AS costo_indirecto_crc,
  -- Total
  ROUND(
    SUM(tc.cantidad * COALESCE(mp.costo_prom_crc,0)) +
    CASE
      WHEN cc.metodo='PCT_DIRECTO' THEN
        SUM(tc.cantidad * COALESCE(mp.costo_prom_crc,0)) *
        COALESCE(JSON_EXTRACT(cc.parametro_json,'$.porcentaje'),
                 (SELECT CASE WHEN vdm.total_directo_mes_crc > 0
                              THEN (vim.total_indirecto_mes_crc / vdm.total_directo_mes_crc)
                              ELSE 0 END
                  FROM v_costo_directo_mes vdm, v_indirecto_mes_actual vim))
      WHEN cc.metodo='POR_HORA' THEN
        COALESCE(JSON_EXTRACT(cc.parametro_json,'$.tarifa_h'),0) * COALESCE(JSON_EXTRACT(t.nota,'$.horas'),0)
      WHEN cc.metodo='POR_UNIDAD' THEN
        COALESCE(JSON_EXTRACT(cc.parametro_json,'$.tarifa_unidad'),0) *
        (SELECT COALESCE(SUM(ts.cantidad),0) FROM tanda_salida ts WHERE ts.tanda_id=t.id)
      ELSE 0
    END
  ,6) AS costo_total_crc
FROM tanda t
LEFT JOIN tanda_consumo tc       ON tc.tanda_id = t.id
LEFT JOIN v_mp_costo_promedio mp ON mp.producto_id = tc.producto_id
CROSS JOIN config_costeo cc
GROUP BY t.id, t.fecha, cc.metodo, cc.parametro_json;

-- 7) Costos unitarios estimados de receta segun salida configurada (rendimiento total)
--    Útil para /costeo/recetas/{id}?rendimiento=...
CREATE OR REPLACE VIEW v_receta_rendimiento AS
SELECT
  r.id AS receta_id,
  COALESCE(SUM(rs.rendimiento), 0) AS rendimiento_total
FROM receta r
LEFT JOIN receta_salida rs ON rs.receta_id = r.id
GROUP BY r.id;

/* =========================================================
   PATCH COSTEO (MP → Recetas → Tandas)  —  MySQL compatible
   ========================================================= */
USE dltaller_app;

-- ============= 1) Agregar columnas si faltan (producto) =============
-- precio_venta_crc (para PT) y costo_estandar_crc (para MP)

SET @sql := IF (
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'producto'
       AND COLUMN_NAME = 'precio_venta_crc') = 0,
  'ALTER TABLE producto ADD COLUMN precio_venta_crc DECIMAL(18,6) NULL AFTER uom_base_id;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF (
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'producto'
       AND COLUMN_NAME = 'costo_estandar_crc') = 0,
  'ALTER TABLE producto ADD COLUMN costo_estandar_crc DECIMAL(18,6) NULL AFTER precio_venta_crc;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ================== 2) Vistas de costo de MP ==================
-- 2.1 Último costo registrado por MP (en CRC)
CREATE OR REPLACE VIEW v_costo_mp_ultimo AS
SELECT
  cd.producto_id,
  CAST(
    SUBSTRING_INDEX(
      GROUP_CONCAT(cd.costo_unitario_crc ORDER BY c.fecha DESC, cd.id DESC),
      ',', 1
    ) AS DECIMAL(18,6)
  ) AS costo_unitario_crc
FROM compra_det cd
JOIN compra c ON c.id = cd.compra_id
GROUP BY cd.producto_id;

-- 2.2 Promedio ponderado histórico por MP
CREATE OR REPLACE VIEW v_costo_mp_promedio AS
SELECT
  cd.producto_id,
  CASE
    WHEN SUM(cd.cantidad) > 0
      THEN CAST(SUM(cd.costo_unitario_crc * cd.cantidad) / SUM(cd.cantidad) AS DECIMAL(18,6))
    ELSE NULL
  END AS costo_unitario_crc
FROM compra_det cd
GROUP BY cd.producto_id;

-- 2.3 Costo “actual” por MP: último -> promedio -> costo_estandar -> 0
CREATE OR REPLACE VIEW v_costo_mp_actual AS
SELECT
  p.id AS producto_id,
  COALESCE(u.costo_unitario_crc, pr.costo_unitario_crc, p.costo_estandar_crc, 0) AS costo_unitario_crc
FROM producto p
LEFT JOIN v_costo_mp_ultimo   u  ON u.producto_id = p.id
LEFT JOIN v_costo_mp_promedio pr ON pr.producto_id = p.id
WHERE p.tipo = 'MP';

-- ================= 3) Vistas de costeo de receta =================
-- 3.1 Detalle por ingrediente (usa costo actual de MP)
CREATE OR REPLACE VIEW v_receta_costeo_det AS
SELECT
  r.id            AS receta_id,
  rd.id           AS receta_det_id,
  rd.producto_id,
  p.nombre        AS producto_nombre,
  rd.uom_id,
  u.nombre        AS uom_nombre,
  rd.cantidad,
  ca.costo_unitario_crc,
  CAST(rd.cantidad * ca.costo_unitario_crc AS DECIMAL(18,6)) AS costo_total_crc
FROM receta_det rd
JOIN receta   r   ON r.id = rd.receta_id
JOIN producto p   ON p.id = rd.producto_id
JOIN uom     u    ON u.id = rd.uom_id
LEFT JOIN v_costo_mp_actual ca ON ca.producto_id = rd.producto_id;

-- 3.2 Rendimiento total de receta (sumando salidas)
CREATE OR REPLACE VIEW v_receta_rendimiento AS
SELECT
  rs.receta_id,
  SUM(rs.rendimiento) AS rendimiento_total
FROM receta_salida rs
GROUP BY rs.receta_id;

-- 3.3 Totales (directo y unitario estimado por rendimiento)
CREATE OR REPLACE VIEW v_receta_costeo_totales AS
SELECT
  d.receta_id,
  CAST(SUM(d.costo_total_crc) AS DECIMAL(18,6)) AS costo_directo_crc,
  r.rendimiento_total,
  CASE
    WHEN r.rendimiento_total IS NOT NULL AND r.rendimiento_total > 0
      THEN CAST(SUM(d.costo_total_crc) / r.rendimiento_total AS DECIMAL(18,6))
    ELSE NULL
  END AS unitario_estimado_crc
FROM v_receta_costeo_det d
LEFT JOIN v_receta_rendimiento r ON r.receta_id = d.receta_id
GROUP BY d.receta_id, r.rendimiento_total;

-- ============= 4) Función costo MP “a la fecha” (para tandas) =============
-- (Sin OR REPLACE; se hace DROP + CREATE. Con DELIMITER y READS SQL DATA)

DROP FUNCTION IF EXISTS fn_costo_mp_al;
DELIMITER $$

CREATE FUNCTION fn_costo_mp_al(fecha_ref DATE, mp_id BIGINT)
RETURNS DECIMAL(18,6)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE v_costo DECIMAL(18,6) DEFAULT NULL;

  -- último costo con fecha <= fecha_ref
  SELECT cd.costo_unitario_crc
    INTO v_costo
  FROM compra_det cd
  JOIN compra c ON c.id = cd.compra_id
  WHERE cd.producto_id = mp_id
    AND c.fecha <= fecha_ref
  ORDER BY c.fecha DESC, cd.id DESC
  LIMIT 1;

  IF v_costo IS NULL THEN
    -- fallback: costo_estandar del producto
    SELECT p.costo_estandar_crc
      INTO v_costo
    FROM producto p
    WHERE p.id = mp_id
    LIMIT 1;
  END IF;

  RETURN IFNULL(v_costo, 0);
END $$
DELIMITER ;

-- ==================== 5) (Opcional) Ejemplo de uso ====================
-- Costeo de una tanda puntual por fecha (para endpoints/reporte):
-- SELECT
--   t.id AS tanda_id,
--   tc.producto_id,
--   p.nombre AS producto_nombre,
--   tc.uom_id,
--   u.nombre AS uom_nombre,
--   tc.cantidad,
--   fn_costo_mp_al(t.fecha, tc.producto_id) AS costo_unitario_crc,
--   CAST(tc.cantidad * fn_costo_mp_al(t.fecha, tc.producto_id) AS DECIMAL(18,6)) AS costo_total_crc
-- FROM tanda t
-- JOIN tanda_consumo tc ON tc.tanda_id = t.id
-- JOIN producto p ON p.id = tc.producto_id
-- JOIN uom u ON u.id = tc.uom_id
-- WHERE t.id = 123;  -- reemplazar por la tanda a analizar

/* =========================================================
   PATCH sobre esquema existente (MySQL 8)
   Añade columnas, vistas, función y triggers de flujo/costeo
   ========================================================= */
USE dltaller_app;

-- ============= 1) Agregar columnas si faltan (producto) =============
-- precio_venta_crc (para PT) y costo_estandar_crc (para MP)

SET @sql := IF (
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'producto'
       AND COLUMN_NAME = 'precio_venta_crc') = 0,
  'ALTER TABLE producto ADD COLUMN precio_venta_crc DECIMAL(18,6) NULL AFTER uom_base_id;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF (
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'producto'
       AND COLUMN_NAME = 'costo_estandar_crc') = 0,
  'ALTER TABLE producto ADD COLUMN costo_estandar_crc DECIMAL(18,6) NULL AFTER precio_venta_crc;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ================== 2) Vistas de costo de MP ==================
-- 2.1 Último costo registrado por MP (en CRC)
CREATE OR REPLACE VIEW v_costo_mp_ultimo AS
SELECT
  cd.producto_id,
  CAST(
    SUBSTRING_INDEX(
      GROUP_CONCAT(cd.costo_unitario_crc ORDER BY c.fecha DESC, cd.id DESC),
      ',', 1
    ) AS DECIMAL(18,6)
  ) AS costo_unitario_crc
FROM compra_det cd
JOIN compra c ON c.id = cd.compra_id
GROUP BY cd.producto_id;

-- 2.2 Promedio ponderado histórico por MP
CREATE OR REPLACE VIEW v_costo_mp_promedio AS
SELECT
  cd.producto_id,
  CASE
    WHEN SUM(cd.cantidad) > 0
      THEN CAST(SUM(cd.costo_unitario_crc * cd.cantidad) / SUM(cd.cantidad) AS DECIMAL(18,6))
    ELSE NULL
  END AS costo_unitario_crc
FROM compra_det cd
GROUP BY cd.producto_id;

-- 2.3 Costo “actual” por MP: último -> promedio -> costo_estandar -> 0
CREATE OR REPLACE VIEW v_costo_mp_actual AS
SELECT
  p.id AS producto_id,
  COALESCE(u.costo_unitario_crc, pr.costo_unitario_crc, p.costo_estandar_crc, 0) AS costo_unitario_crc
FROM producto p
LEFT JOIN v_costo_mp_ultimo   u  ON u.producto_id = p.id
LEFT JOIN v_costo_mp_promedio pr ON pr.producto_id = p.id
WHERE p.tipo = 'MP';

-- ============ 3) Vistas de costeo de receta (detalle + totales) ============
-- 3.1 Detalle por ingrediente (usa costo “actual” de MP)
CREATE OR REPLACE VIEW v_receta_costeo_det AS
SELECT
  r.id            AS receta_id,
  rd.id           AS receta_det_id,
  rd.producto_id,
  p.nombre        AS producto_nombre,
  rd.uom_id,
  u.nombre        AS uom_nombre,
  rd.cantidad,
  ca.costo_unitario_crc,
  CAST(rd.cantidad * ca.costo_unitario_crc AS DECIMAL(18,6)) AS costo_total_crc
FROM receta_det rd
JOIN receta   r   ON r.id = rd.receta_id
JOIN producto p   ON p.id = rd.producto_id
JOIN uom     u    ON u.id = rd.uom_id
LEFT JOIN v_costo_mp_actual ca ON ca.producto_id = rd.producto_id;

-- 3.2 Rendimiento total de receta (sumando salidas)
CREATE OR REPLACE VIEW v_receta_rendimiento AS
SELECT
  rs.receta_id,
  SUM(rs.rendimiento) AS rendimiento_total
FROM receta_salida rs
GROUP BY rs.receta_id;

-- 3.3 Totales (directo y unitario estimado por rendimiento)
CREATE OR REPLACE VIEW v_receta_costeo_totales AS
SELECT
  d.receta_id,
  CAST(SUM(d.costo_total_crc) AS DECIMAL(18,6)) AS costo_directo_crc,
  r.rendimiento_total,
  CASE
    WHEN r.rendimiento_total IS NOT NULL AND r.rendimiento_total > 0
      THEN CAST(SUM(d.costo_total_crc) / r.rendimiento_total AS DECIMAL(18,6))
    ELSE NULL
  END AS unitario_estimado_crc
FROM v_receta_costeo_det d
LEFT JOIN v_receta_rendimiento r ON r.receta_id = d.receta_id
GROUP BY d.receta_id, r.rendimiento_total;

-- ========= 4) Función costo MP “a la fecha” (para tandas/valorizar) =========
DROP FUNCTION IF EXISTS fn_costo_mp_al;
DELIMITER $$
CREATE FUNCTION fn_costo_mp_al(fecha_ref DATE, mp_id BIGINT)
RETURNS DECIMAL(18,6)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE v_costo DECIMAL(18,6) DEFAULT NULL;

  -- último costo con fecha <= fecha_ref
  SELECT cd.costo_unitario_crc
    INTO v_costo
  FROM compra_det cd
  JOIN compra c ON c.id = cd.compra_id
  WHERE cd.producto_id = mp_id
    AND c.fecha <= fecha_ref
  ORDER BY c.fecha DESC, cd.id DESC
  LIMIT 1;

  IF v_costo IS NULL THEN
    -- fallback: costo_estandar del producto
    SELECT p.costo_estandar_crc
      INTO v_costo
    FROM producto p
    WHERE p.id = mp_id
    LIMIT 1;
  END IF;

  RETURN IFNULL(v_costo, 0);
END$$
DELIMITER ;

-- ======== 5) Inventario MP valorizado (existencias * costo actual) ========
CREATE OR REPLACE VIEW v_existencias_mp_valorizadas AS
SELECT
  vmp.producto_id,
  p.sku,
  p.nombre,
  p.uom_base_id,
  vmp.existencias,
  cma.costo_unitario_crc,
  (vmp.existencias * cma.costo_unitario_crc) AS valor_crc
FROM v_existencias_mp vmp
JOIN producto p ON p.id = vmp.producto_id
LEFT JOIN v_costo_mp_actual cma ON cma.producto_id = vmp.producto_id;

-- ===================== 6) TRIGGERS de reglas de flujo =====================
-- Limpieza previa por si existían
DROP TRIGGER IF EXISTS trg_compra_det_only_mp;
DROP TRIGGER IF EXISTS trg_compra_det_only_mp_upd;
DROP TRIGGER IF EXISTS trg_venta_det_only_pt;
DROP TRIGGER IF EXISTS trg_venta_det_only_pt_upd;
DROP TRIGGER IF EXISTS trg_tconsumo_only_mp;
DROP TRIGGER IF EXISTS trg_tconsumo_only_mp_upd;
DROP TRIGGER IF EXISTS trg_tsalida_only_pt;
DROP TRIGGER IF EXISTS trg_tsalida_only_pt_upd;

DELIMITER $$

-- COMPRA_DET: sólo MP
CREATE TRIGGER trg_compra_det_only_mp
BEFORE INSERT ON compra_det
FOR EACH ROW
BEGIN
  DECLARE v_tipo VARCHAR(2);
  SELECT tipo INTO v_tipo FROM producto WHERE id = NEW.producto_id LIMIT 1;
  IF v_tipo IS NULL OR v_tipo <> 'MP' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sólo puedes registrar Materia Prima (MP) en compras.';
  END IF;
END$$

CREATE TRIGGER trg_compra_det_only_mp_upd
BEFORE UPDATE ON compra_det
FOR EACH ROW
BEGIN
  DECLARE v_tipo VARCHAR(2);
  SELECT tipo INTO v_tipo FROM producto WHERE id = NEW.producto_id LIMIT 1;
  IF v_tipo IS NULL OR v_tipo <> 'MP' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sólo puedes registrar Materia Prima (MP) en compras.';
  END IF;
END$$

-- VENTA_DET: sólo PT
CREATE TRIGGER trg_venta_det_only_pt
BEFORE INSERT ON venta_det
FOR EACH ROW
BEGIN
  DECLARE v_tipo VARCHAR(2);
  SELECT tipo INTO v_tipo FROM producto WHERE id = NEW.producto_id LIMIT 1;
  IF v_tipo IS NULL OR v_tipo <> 'PT' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sólo puedes vender Producto Terminado (PT) en ventas.';
  END IF;
END$$

CREATE TRIGGER trg_venta_det_only_pt_upd
BEFORE UPDATE ON venta_det
FOR EACH ROW
BEGIN
  DECLARE v_tipo VARCHAR(2);
  SELECT tipo INTO v_tipo FROM producto WHERE id = NEW.producto_id LIMIT 1;
  IF v_tipo IS NULL OR v_tipo <> 'PT' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sólo puedes vender Producto Terminado (PT) en ventas.';
  END IF;
END$$

-- TANDA_CONSUMO: sólo MP
CREATE TRIGGER trg_tconsumo_only_mp
BEFORE INSERT ON tanda_consumo
FOR EACH ROW
BEGIN
  DECLARE v_tipo VARCHAR(2);
  SELECT tipo INTO v_tipo FROM producto WHERE id = NEW.producto_id LIMIT 1;
  IF v_tipo IS NULL OR v_tipo <> 'MP' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'En consumo de tanda sólo se permite MP.';
  END IF;
END$$

CREATE TRIGGER trg_tconsumo_only_mp_upd
BEFORE UPDATE ON tanda_consumo
FOR EACH ROW
BEGIN
  DECLARE v_tipo VARCHAR(2);
  SELECT tipo INTO v_tipo FROM producto WHERE id = NEW.producto_id LIMIT 1;
  IF v_tipo IS NULL OR v_tipo <> 'MP' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'En consumo de tanda sólo se permite MP.';
  END IF;
END$$

-- TANDA_SALIDA: sólo PT
CREATE TRIGGER trg_tsalida_only_pt
BEFORE INSERT ON tanda_salida
FOR EACH ROW
BEGIN
  DECLARE v_tipo VARCHAR(2);
  SELECT tipo INTO v_tipo FROM producto WHERE id = NEW.producto_id LIMIT 1;
  IF v_tipo IS NULL OR v_tipo <> 'PT' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'En salida de tanda sólo se permite PT.';
  END IF;
END$$

CREATE TRIGGER trg_tsalida_only_pt_upd
BEFORE UPDATE ON tanda_salida
FOR EACH ROW
BEGIN
  DECLARE v_tipo VARCHAR(2);
  SELECT tipo INTO v_tipo FROM producto WHERE id = NEW.producto_id LIMIT 1;
  IF v_tipo IS NULL OR v_tipo <> 'PT' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'En salida de tanda sólo se permite PT.';
  END IF;
END$$

DELIMITER ;

SET @sql := IF (
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'producto'
     AND COLUMN_NAME = 'precio_venta_crc') = 0,
  'ALTER TABLE producto ADD COLUMN precio_venta_crc DECIMAL(18,6) NULL AFTER uom_base_id;',
  'SELECT 1;'
); PREPARE s1 FROM @sql; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @sql := IF (
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'producto'
     AND COLUMN_NAME = 'costo_estandar_crc') = 0,
  'ALTER TABLE producto ADD COLUMN costo_estandar_crc DECIMAL(18,6) NULL AFTER precio_venta_crc;',
  'SELECT 1;'
); PREPARE s2 FROM @sql; EXECUTE s2; DEALLOCATE PREPARE s2;

CREATE TABLE IF NOT EXISTS config_costeo (
  id TINYINT PRIMARY KEY DEFAULT 1,
  metodo ENUM('PORCENTAJE_GLOBAL') NOT NULL DEFAULT 'PORCENTAJE_GLOBAL',
  parametro_json JSON NULL, -- { "pct": 0.18 }
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO config_costeo (id, metodo, parametro_json)
VALUES (1, 'PORCENTAJE_GLOBAL', JSON_OBJECT('pct', 0.18));
