-- ======================================================================
-- dltaller_app - Demo data for local testing (MySQL 8+)
-- Run after database.sql to populate sample catalog, recipe, and flow data.
-- Compatible with MySQL Workbench or mysql CLI.
-- ======================================================================

USE dltaller_app;

START TRANSACTION;

-- ----------------------------------------------------------------------
-- Units of measure
-- ----------------------------------------------------------------------
INSERT INTO uom (codigo, nombre)
VALUES
  ('KG', 'Kilogramo'),
  ('G',  'Gramo'),
  ('LT', 'Litro'),
  ('UN', 'Unidad')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ----------------------------------------------------------------------
-- Application users
-- ----------------------------------------------------------------------
INSERT INTO app_user (username, full_name)
VALUES
  ('demo', 'Usuario Demo'),
  ('ana.ops', 'Ana Operaciones')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- ----------------------------------------------------------------------
-- Locations
-- ----------------------------------------------------------------------
INSERT INTO ubicacion (nombre, tipo)
VALUES
  ('Bodega Central', 'BODEGA'),
  ('Planta Produccion', 'PRODUCCION'),
  ('Tienda Principal', 'TIENDA')
ON DUPLICATE KEY UPDATE tipo = VALUES(tipo);

-- ----------------------------------------------------------------------
-- Suppliers
-- ----------------------------------------------------------------------
INSERT INTO proveedor (id, nombre, num_doc, telefono, email, direccion, activo)
VALUES
  (2001, 'Insumos GF', 'J-001-1001', '+506 2222 1001', 'compras@insumosgf.test', 'San Jose, CR', 1),
  (2002, 'Campo Verde', 'J-001-1002', '+506 2222 1002', 'ventas@campoverde.test', 'Cartago, CR', 1)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  telefono = VALUES(telefono),
  email = VALUES(email),
  direccion = VALUES(direccion),
  activo = VALUES(activo);

-- ----------------------------------------------------------------------
-- Customers
-- ----------------------------------------------------------------------
INSERT INTO cliente (id, nombre, num_doc, telefono, email, direccion, activo)
VALUES
  (3001, 'Panaderia Saludable', '3-101-000111', '+506 8888 3001', 'contacto@pansaludable.test', 'Escazu, CR', 1),
  (3002, 'Mercado Verde', '3-101-000222', '+506 8888 3002', 'ordenes@mercadoverde.test', 'Heredia, CR', 1),
  (3003, 'Cafe Natural', '3-101-000333', '+506 8888 3003', 'compras@cafenatural.test', 'San Pedro, CR', 1),
  (3004, 'Super Vida Sana', '3-101-000444', '+506 8888 3004', 'compras@supervidasana.test', 'Alajuela, CR', 1)
ON DUPLICATE KEY UPDATE
  telefono = VALUES(telefono),
  email = VALUES(email),
  direccion = VALUES(direccion),
  activo = VALUES(activo);

-- ----------------------------------------------------------------------
-- Products (MP and PT)
-- ----------------------------------------------------------------------
INSERT INTO producto (sku, nombre, tipo, uom_base_id, precio_venta_crc, costo_estandar_crc, activo)
SELECT 'MP-HARINA-ARROZ', 'Harina de arroz integral', 'MP', u.id, NULL, 1750.00, 1
FROM uom u WHERE u.codigo = 'KG'
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  uom_base_id = VALUES(uom_base_id),
  precio_venta_crc = VALUES(precio_venta_crc),
  costo_estandar_crc = VALUES(costo_estandar_crc),
  activo = VALUES(activo);

INSERT INTO producto (sku, nombre, tipo, uom_base_id, precio_venta_crc, costo_estandar_crc, activo)
SELECT 'MP-SIROP-AGAVE', 'Sirop de agave organico', 'MP', u.id, NULL, 4100.00, 1
FROM uom u WHERE u.codigo = 'LT'
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  uom_base_id = VALUES(uom_base_id),
  precio_venta_crc = VALUES(precio_venta_crc),
  costo_estandar_crc = VALUES(costo_estandar_crc),
  activo = VALUES(activo);

INSERT INTO producto (sku, nombre, tipo, uom_base_id, precio_venta_crc, costo_estandar_crc, activo)
SELECT 'MP-AMARANTO', 'Amaranto inflado', 'MP', u.id, NULL, 2300.00, 1
FROM uom u WHERE u.codigo = 'KG'
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  uom_base_id = VALUES(uom_base_id),
  precio_venta_crc = VALUES(precio_venta_crc),
  costo_estandar_crc = VALUES(costo_estandar_crc),
  activo = VALUES(activo);

INSERT INTO producto (sku, nombre, tipo, uom_base_id, precio_venta_crc, costo_estandar_crc, activo)
SELECT 'PT-PAN-QUINOA', 'Pan de quinoa', 'PT', u.id, 3800.00, 2800.00, 1
FROM uom u WHERE u.codigo = 'UN'
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  uom_base_id = VALUES(uom_base_id),
  precio_venta_crc = VALUES(precio_venta_crc),
  costo_estandar_crc = VALUES(costo_estandar_crc),
  activo = VALUES(activo);

INSERT INTO producto (sku, nombre, tipo, uom_base_id, precio_venta_crc, costo_estandar_crc, activo)
SELECT 'PT-GAL-COCO', 'Galletas de coco', 'PT', u.id, 2100.00, 1500.00, 1
FROM uom u WHERE u.codigo = 'UN'
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  uom_base_id = VALUES(uom_base_id),
  precio_venta_crc = VALUES(precio_venta_crc),
  costo_estandar_crc = VALUES(costo_estandar_crc),
  activo = VALUES(activo);

INSERT INTO producto (sku, nombre, tipo, uom_base_id, precio_venta_crc, costo_estandar_crc, activo)
SELECT 'PT-BARRA-AMARANTO', 'Barra energetica de amaranto', 'PT', u.id, 2800.00, 1900.00, 1
FROM uom u WHERE u.codigo = 'UN'
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  uom_base_id = VALUES(uom_base_id),
  precio_venta_crc = VALUES(precio_venta_crc),
  costo_estandar_crc = VALUES(costo_estandar_crc),
  activo = VALUES(activo);

-- ----------------------------------------------------------------------
-- Recipe (Pan de Quinoa)
-- ----------------------------------------------------------------------
INSERT INTO receta (nombre, producto_salida_id, uom_salida_id, nota, activo)
SELECT 'Pan de Quinoa', p.id, u.id, 'Receta demo para tandas de pan de quinoa', 1
FROM producto p
JOIN uom u ON u.codigo = 'UN'
WHERE p.sku = 'PT-PAN-QUINOA'
ON DUPLICATE KEY UPDATE
  producto_salida_id = VALUES(producto_salida_id),
  uom_salida_id = VALUES(uom_salida_id),
  nota = VALUES(nota),
  activo = VALUES(activo);

-- ----------------------------------------------------------------------
-- Recipe ingredients
-- ----------------------------------------------------------------------
INSERT INTO receta_det (id, receta_id, producto_id, uom_id, cantidad, costo_unitario_crc, otros_costos_crc, nota)
VALUES (
  4001,
  (SELECT id FROM receta WHERE nombre = 'Pan de Quinoa'),
  (SELECT id FROM producto WHERE sku = 'MP-HARINA-ARROZ'),
  (SELECT id FROM uom WHERE codigo = 'KG'),
  1.500,
  1750.00,
  0.00,
  'Harina base'
)
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  costo_unitario_crc = VALUES(costo_unitario_crc),
  otros_costos_crc = VALUES(otros_costos_crc),
  nota = VALUES(nota);

INSERT INTO receta_det (id, receta_id, producto_id, uom_id, cantidad, costo_unitario_crc, otros_costos_crc, nota)
VALUES (
  4002,
  (SELECT id FROM receta WHERE nombre = 'Pan de Quinoa'),
  (SELECT id FROM producto WHERE sku = 'MP-SIROP-AGAVE'),
  (SELECT id FROM uom WHERE codigo = 'LT'),
  0.150,
  4100.00,
  0.00,
  'Endulzante natural'
)
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  costo_unitario_crc = VALUES(costo_unitario_crc),
  otros_costos_crc = VALUES(otros_costos_crc),
  nota = VALUES(nota);

-- ----------------------------------------------------------------------
-- Recipe output
-- ----------------------------------------------------------------------
INSERT INTO receta_salida (id, receta_id, producto_id, uom_id, rendimiento, nota)
VALUES (
  4501,
  (SELECT id FROM receta WHERE nombre = 'Pan de Quinoa'),
  (SELECT id FROM producto WHERE sku = 'PT-PAN-QUINOA'),
  (SELECT id FROM uom WHERE codigo = 'UN'),
  12.000,
  'Rinde 12 unidades'
)
ON DUPLICATE KEY UPDATE
  producto_id = VALUES(producto_id),
  uom_id = VALUES(uom_id),
  rendimiento = VALUES(rendimiento),
  nota = VALUES(nota);

-- ----------------------------------------------------------------------
-- Purchases (one header + detail)
-- ----------------------------------------------------------------------
INSERT INTO compra (id, fecha, proveedor_id, moneda, tipo_cambio, condicion_pago, dias_credito, fecha_limite, estado_cobro_pago, nota, factor_extra, factor_doble, factor_feriado, created_by)
VALUES (
  5001,
  '2024-05-10',
  (SELECT id FROM proveedor WHERE nombre = 'Insumos GF'),
  'CRC',
  NULL,
  'CREDITO',
  30,
  '2024-06-09',
  'PENDIENTE',
  'Compra demo de materia prima',
  NULL,
  NULL,
  NULL,
  (SELECT id FROM app_user WHERE username = 'ana.ops')
)
ON DUPLICATE KEY UPDATE
  proveedor_id = VALUES(proveedor_id),
  condicion_pago = VALUES(condicion_pago),
  dias_credito = VALUES(dias_credito),
  fecha_limite = VALUES(fecha_limite),
  estado_cobro_pago = VALUES(estado_cobro_pago),
  nota = VALUES(nota),
  created_by = VALUES(created_by);

INSERT INTO compra_det (id, compra_id, producto_id, uom_id, cantidad, costo_unitario_crc, descuento_crc)
VALUES (
  500101,
  5001,
  (SELECT id FROM producto WHERE sku = 'MP-HARINA-ARROZ'),
  (SELECT id FROM uom WHERE codigo = 'KG'),
  25.000,
  1750.00,
  0.00
)
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  costo_unitario_crc = VALUES(costo_unitario_crc),
  descuento_crc = VALUES(descuento_crc);

INSERT INTO compra (id, fecha, proveedor_id, moneda, tipo_cambio, condicion_pago, dias_credito, fecha_limite, estado_cobro_pago, nota, factor_extra, factor_doble, factor_feriado, created_by)
VALUES (
  5002,
  '2024-06-02',
  (SELECT id FROM proveedor WHERE nombre = 'Campo Verde'),
  'CRC',
  NULL,
  'CREDITO',
  15,
  '2024-06-17',
  'PENDIENTE',
  'Compra de amaranto y sirop',
  NULL,
  NULL,
  NULL,
  (SELECT id FROM app_user WHERE username = 'demo')
)
ON DUPLICATE KEY UPDATE
  proveedor_id = VALUES(proveedor_id),
  condicion_pago = VALUES(condicion_pago),
  dias_credito = VALUES(dias_credito),
  fecha_limite = VALUES(fecha_limite),
  estado_cobro_pago = VALUES(estado_cobro_pago),
  nota = VALUES(nota),
  created_by = VALUES(created_by);

INSERT INTO compra_det (id, compra_id, producto_id, uom_id, cantidad, costo_unitario_crc, descuento_crc)
VALUES
  (
    500201,
    5002,
    (SELECT id FROM producto WHERE sku = 'MP-AMARANTO'),
    (SELECT id FROM uom WHERE codigo = 'KG'),
    18.000,
    2300.00,
    0.00
  ),
  (
    500202,
    5002,
    (SELECT id FROM producto WHERE sku = 'MP-SIROP-AGAVE'),
    (SELECT id FROM uom WHERE codigo = 'LT'),
    8.000,
    4100.00,
    0.00
  )
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  costo_unitario_crc = VALUES(costo_unitario_crc),
  descuento_crc = VALUES(descuento_crc);

INSERT INTO compra (id, fecha, proveedor_id, moneda, tipo_cambio, condicion_pago, dias_credito, fecha_limite, estado_cobro_pago, nota, factor_extra, factor_doble, factor_feriado, created_by)
VALUES (
  5003,
  '2024-07-08',
  (SELECT id FROM proveedor WHERE nombre = 'Insumos GF'),
  'CRC',
  NULL,
  'CONTADO',
  NULL,
  NULL,
  'PAGADO',
  'Reabastecimiento de harinas',
  NULL,
  NULL,
  NULL,
  (SELECT id FROM app_user WHERE username = 'ana.ops')
)
ON DUPLICATE KEY UPDATE
  proveedor_id = VALUES(proveedor_id),
  condicion_pago = VALUES(condicion_pago),
  dias_credito = VALUES(dias_credito),
  fecha_limite = VALUES(fecha_limite),
  estado_cobro_pago = VALUES(estado_cobro_pago),
  nota = VALUES(nota),
  created_by = VALUES(created_by);

INSERT INTO compra_det (id, compra_id, producto_id, uom_id, cantidad, costo_unitario_crc, descuento_crc)
VALUES
  (
    500301,
    5003,
    (SELECT id FROM producto WHERE sku = 'MP-HARINA-ARROZ'),
    (SELECT id FROM uom WHERE codigo = 'KG'),
    30.000,
    1700.00,
    0.00
  ),
  (
    500302,
    5003,
    (SELECT id FROM producto WHERE sku = 'MP-AMARANTO'),
    (SELECT id FROM uom WHERE codigo = 'KG'),
    12.000,
    2350.00,
    0.00
  )
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  costo_unitario_crc = VALUES(costo_unitario_crc),
  descuento_crc = VALUES(descuento_crc);

INSERT INTO compra (id, fecha, proveedor_id, moneda, tipo_cambio, condicion_pago, dias_credito, fecha_limite, estado_cobro_pago, nota, factor_extra, factor_doble, factor_feriado, created_by)
VALUES (
  5004,
  '2024-08-22',
  (SELECT id FROM proveedor WHERE nombre = 'Campo Verde'),
  'CRC',
  NULL,
  'CREDITO',
  20,
  '2024-09-11',
  'PENDIENTE',
  'Ingredientes temporada alta',
  NULL,
  NULL,
  NULL,
  (SELECT id FROM app_user WHERE username = 'ana.ops')
)
ON DUPLICATE KEY UPDATE
  proveedor_id = VALUES(proveedor_id),
  condicion_pago = VALUES(condicion_pago),
  dias_credito = VALUES(dias_credito),
  fecha_limite = VALUES(fecha_limite),
  estado_cobro_pago = VALUES(estado_cobro_pago),
  nota = VALUES(nota),
  created_by = VALUES(created_by);

INSERT INTO compra_det (id, compra_id, producto_id, uom_id, cantidad, costo_unitario_crc, descuento_crc)
VALUES
  (
    500401,
    5004,
    (SELECT id FROM producto WHERE sku = 'MP-SIROP-AGAVE'),
    (SELECT id FROM uom WHERE codigo = 'LT'),
    12.000,
    4150.00,
    0.00
  ),
  (
    500402,
    5004,
    (SELECT id FROM producto WHERE sku = 'MP-AMARANTO'),
    (SELECT id FROM uom WHERE codigo = 'KG'),
    20.000,
    2400.00,
    0.00
  )
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  costo_unitario_crc = VALUES(costo_unitario_crc),
  descuento_crc = VALUES(descuento_crc);

-- ----------------------------------------------------------------------
-- Sales (one header + detail)
-- ----------------------------------------------------------------------
INSERT INTO venta (id, codigo_factura, fecha, cliente_id, moneda, tipo_cambio, condicion_pago, dias_credito, fecha_limite, estado_cobro_pago, ruta_id, nota, factor_extra, factor_doble, factor_feriado, created_by)
VALUES (
  6001,
  'FAC-DEM-001',
  '2024-05-18',
  (SELECT id FROM cliente WHERE nombre = 'Panaderia Saludable'),
  'CRC',
  NULL,
  'CONTADO',
  NULL,
  NULL,
  'PAGADO',
  NULL,
  'Pedido demo pan de quinoa',
  NULL,
  NULL,
  NULL,
  (SELECT id FROM app_user WHERE username = 'demo')
)
ON DUPLICATE KEY UPDATE
  cliente_id = VALUES(cliente_id),
  condicion_pago = VALUES(condicion_pago),
  estado_cobro_pago = VALUES(estado_cobro_pago),
  nota = VALUES(nota),
  created_by = VALUES(created_by);

INSERT INTO venta_det (id, venta_id, producto_id, uom_id, cantidad, precio_unitario_crc, descuento_crc)
VALUES (
  600101,
  6001,
  (SELECT id FROM producto WHERE sku = 'PT-PAN-QUINOA'),
  (SELECT id FROM uom WHERE codigo = 'UN'),
  8.000,
  3800.00,
  0.00
)
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  precio_unitario_crc = VALUES(precio_unitario_crc),
  descuento_crc = VALUES(descuento_crc);

INSERT INTO venta (id, codigo_factura, fecha, cliente_id, moneda, tipo_cambio, condicion_pago, dias_credito, fecha_limite, estado_cobro_pago, ruta_id, nota, factor_extra, factor_doble, factor_feriado, created_by)
VALUES (
  6002,
  'FAC-DEM-002',
  '2024-06-05',
  (SELECT id FROM cliente WHERE nombre = 'Panaderia Saludable'),
  'CRC',
  NULL,
  'CREDITO',
  15,
  '2024-06-20',
  'PENDIENTE',
  NULL,
  'Pedido trimestral pan quinoa',
  NULL,
  NULL,
  NULL,
  (SELECT id FROM app_user WHERE username = 'demo')
)
ON DUPLICATE KEY UPDATE
  cliente_id = VALUES(cliente_id),
  condicion_pago = VALUES(condicion_pago),
  dias_credito = VALUES(dias_credito),
  fecha_limite = VALUES(fecha_limite),
  estado_cobro_pago = VALUES(estado_cobro_pago),
  nota = VALUES(nota),
  created_by = VALUES(created_by);

INSERT INTO venta_det (id, venta_id, producto_id, uom_id, cantidad, precio_unitario_crc, descuento_crc)
VALUES
  (
    600201,
    6002,
    (SELECT id FROM producto WHERE sku = 'PT-PAN-QUINOA'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    12.000,
    3800.00,
    0.00
  ),
  (
    600202,
    6002,
    (SELECT id FROM producto WHERE sku = 'PT-GAL-COCO'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    10.000,
    2100.00,
    0.00
  )
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  precio_unitario_crc = VALUES(precio_unitario_crc),
  descuento_crc = VALUES(descuento_crc);

INSERT INTO venta (id, codigo_factura, fecha, cliente_id, moneda, tipo_cambio, condicion_pago, dias_credito, fecha_limite, estado_cobro_pago, ruta_id, nota, factor_extra, factor_doble, factor_feriado, created_by)
VALUES (
  6003,
  'FAC-DEM-003',
  '2024-06-28',
  (SELECT id FROM cliente WHERE nombre = 'Mercado Verde'),
  'CRC',
  NULL,
  'CONTADO',
  NULL,
  NULL,
  'PAGADO',
  NULL,
  'Kit galletas y barras',
  NULL,
  NULL,
  NULL,
  (SELECT id FROM app_user WHERE username = 'ana.ops')
)
ON DUPLICATE KEY UPDATE
  cliente_id = VALUES(cliente_id),
  condicion_pago = VALUES(condicion_pago),
  dias_credito = VALUES(dias_credito),
  fecha_limite = VALUES(fecha_limite),
  estado_cobro_pago = VALUES(estado_cobro_pago),
  nota = VALUES(nota),
  created_by = VALUES(created_by);

INSERT INTO venta_det (id, venta_id, producto_id, uom_id, cantidad, precio_unitario_crc, descuento_crc)
VALUES
  (
    600301,
    6003,
    (SELECT id FROM producto WHERE sku = 'PT-GAL-COCO'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    30.000,
    2050.00,
    0.00
  ),
  (
    600302,
    6003,
    (SELECT id FROM producto WHERE sku = 'PT-BARRA-AMARANTO'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    25.000,
    2800.00,
    0.00
  )
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  precio_unitario_crc = VALUES(precio_unitario_crc),
  descuento_crc = VALUES(descuento_crc);

INSERT INTO venta (id, codigo_factura, fecha, cliente_id, moneda, tipo_cambio, condicion_pago, dias_credito, fecha_limite, estado_cobro_pago, ruta_id, nota, factor_extra, factor_doble, factor_feriado, created_by)
VALUES (
  6004,
  'FAC-DEM-004',
  '2024-07-12',
  (SELECT id FROM cliente WHERE nombre = 'Cafe Natural'),
  'CRC',
  NULL,
  'CONTADO',
  NULL,
  NULL,
  'PAGADO',
  NULL,
  'Entrega cafe saludable julio',
  NULL,
  NULL,
  NULL,
  (SELECT id FROM app_user WHERE username = 'demo')
)
ON DUPLICATE KEY UPDATE
  cliente_id = VALUES(cliente_id),
  condicion_pago = VALUES(condicion_pago),
  dias_credito = VALUES(dias_credito),
  fecha_limite = VALUES(fecha_limite),
  estado_cobro_pago = VALUES(estado_cobro_pago),
  nota = VALUES(nota),
  created_by = VALUES(created_by);

INSERT INTO venta_det (id, venta_id, producto_id, uom_id, cantidad, precio_unitario_crc, descuento_crc)
VALUES
  (
    600401,
    6004,
    (SELECT id FROM producto WHERE sku = 'PT-PAN-QUINOA'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    10.000,
    3850.00,
    0.00
  ),
  (
    600402,
    6004,
    (SELECT id FROM producto WHERE sku = 'PT-BARRA-AMARANTO'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    18.000,
    2800.00,
    0.00
  )
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  precio_unitario_crc = VALUES(precio_unitario_crc),
  descuento_crc = VALUES(descuento_crc);

INSERT INTO venta (id, codigo_factura, fecha, cliente_id, moneda, tipo_cambio, condicion_pago, dias_credito, fecha_limite, estado_cobro_pago, ruta_id, nota, factor_extra, factor_doble, factor_feriado, created_by)
VALUES (
  6005,
  'FAC-DEM-005',
  '2024-08-03',
  (SELECT id FROM cliente WHERE nombre = 'Super Vida Sana'),
  'CRC',
  NULL,
  'CREDITO',
  20,
  '2024-08-23',
  'PENDIENTE',
  NULL,
  'Apertura tienda saludable',
  NULL,
  NULL,
  NULL,
  (SELECT id FROM app_user WHERE username = 'ana.ops')
)
ON DUPLICATE KEY UPDATE
  cliente_id = VALUES(cliente_id),
  condicion_pago = VALUES(condicion_pago),
  dias_credito = VALUES(dias_credito),
  fecha_limite = VALUES(fecha_limite),
  estado_cobro_pago = VALUES(estado_cobro_pago),
  nota = VALUES(nota),
  created_by = VALUES(created_by);

INSERT INTO venta_det (id, venta_id, producto_id, uom_id, cantidad, precio_unitario_crc, descuento_crc)
VALUES
  (
    600501,
    6005,
    (SELECT id FROM producto WHERE sku = 'PT-GAL-COCO'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    40.000,
    2100.00,
    0.00
  ),
  (
    600502,
    6005,
    (SELECT id FROM producto WHERE sku = 'PT-BARRA-AMARANTO'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    35.000,
    2750.00,
    0.00
  )
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  precio_unitario_crc = VALUES(precio_unitario_crc),
  descuento_crc = VALUES(descuento_crc);

INSERT INTO venta (id, codigo_factura, fecha, cliente_id, moneda, tipo_cambio, condicion_pago, dias_credito, fecha_limite, estado_cobro_pago, ruta_id, nota, factor_extra, factor_doble, factor_feriado, created_by)
VALUES (
  6006,
  'FAC-DEM-006',
  '2024-09-15',
  (SELECT id FROM cliente WHERE nombre = 'Panaderia Saludable'),
  'CRC',
  NULL,
  'CONTADO',
  NULL,
  NULL,
  'PAGADO',
  NULL,
  'Lote especial festivales',
  NULL,
  NULL,
  NULL,
  (SELECT id FROM app_user WHERE username = 'demo')
)
ON DUPLICATE KEY UPDATE
  cliente_id = VALUES(cliente_id),
  condicion_pago = VALUES(condicion_pago),
  dias_credito = VALUES(dias_credito),
  fecha_limite = VALUES(fecha_limite),
  estado_cobro_pago = VALUES(estado_cobro_pago),
  nota = VALUES(nota),
  created_by = VALUES(created_by);

INSERT INTO venta_det (id, venta_id, producto_id, uom_id, cantidad, precio_unitario_crc, descuento_crc)
VALUES
  (
    600601,
    6006,
    (SELECT id FROM producto WHERE sku = 'PT-PAN-QUINOA'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    20.000,
    3800.00,
    0.00
  ),
  (
    600602,
    6006,
    (SELECT id FROM producto WHERE sku = 'PT-BARRA-AMARANTO'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    15.000,
    2825.00,
    0.00
  )
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  precio_unitario_crc = VALUES(precio_unitario_crc),
  descuento_crc = VALUES(descuento_crc);

INSERT INTO venta (id, codigo_factura, fecha, cliente_id, moneda, tipo_cambio, condicion_pago, dias_credito, fecha_limite, estado_cobro_pago, ruta_id, nota, factor_extra, factor_doble, factor_feriado, created_by)
VALUES (
  6007,
  'FAC-DEM-007',
  '2024-10-02',
  (SELECT id FROM cliente WHERE nombre = 'Mercado Verde'),
  'CRC',
  NULL,
  'CREDITO',
  30,
  '2024-11-01',
  'PENDIENTE',
  NULL,
  'Reposicion Q4',
  NULL,
  NULL,
  NULL,
  (SELECT id FROM app_user WHERE username = 'ana.ops')
)
ON DUPLICATE KEY UPDATE
  cliente_id = VALUES(cliente_id),
  condicion_pago = VALUES(condicion_pago),
  dias_credito = VALUES(dias_credito),
  fecha_limite = VALUES(fecha_limite),
  estado_cobro_pago = VALUES(estado_cobro_pago),
  nota = VALUES(nota),
  created_by = VALUES(created_by);

INSERT INTO venta_det (id, venta_id, producto_id, uom_id, cantidad, precio_unitario_crc, descuento_crc)
VALUES
  (
    600701,
    6007,
    (SELECT id FROM producto WHERE sku = 'PT-GAL-COCO'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    45.000,
    2120.00,
    0.00
  ),
  (
    600702,
    6007,
    (SELECT id FROM producto WHERE sku = 'PT-BARRA-AMARANTO'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    40.000,
    2780.00,
    0.00
  ),
  (
    600703,
    6007,
    (SELECT id FROM producto WHERE sku = 'PT-PAN-QUINOA'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    18.000,
    3820.00,
    0.00
  )
ON DUPLICATE KEY UPDATE
  cantidad = VALUES(cantidad),
  precio_unitario_crc = VALUES(precio_unitario_crc),
  descuento_crc = VALUES(descuento_crc);

-- ----------------------------------------------------------------------
-- Cobros registrados (para CxC)
-- ----------------------------------------------------------------------
INSERT INTO cobro (id, venta_id, fecha, monto_crc, metodo, referencia, nota)
VALUES
  (9601, 6001, '2024-05-19', 30400.00, 'TRANSFERENCIA', 'TRX-6001', 'Pago completo pedido mayo'),
  (9602, 6002, '2024-06-12', 45000.00, 'TRANSFERENCIA', 'TRX-6002', 'Abono inicial 6002'),
  (9603, 6003, '2024-06-30', 131500.00, 'TRANSFERENCIA', 'TRX-6003', 'Pago completo kit junio'),
  (9604, 6004, '2024-07-15', 88900.00, 'TARJETA', 'POS-6004', 'Venta mostrador'),
  (9605, 6005, '2024-08-15', 90000.00, 'TRANSFERENCIA', 'TRX-6005', 'Abono apertura'),
  (9606, 6006, '2024-09-18', 70000.00, 'EFECTIVO', 'EF-6006A', 'Pago parcial feria'),
  (9607, 6006, '2024-09-25', 48375.00, 'EFECTIVO', 'EF-6006B', 'Saldo feria cancelado')
ON DUPLICATE KEY UPDATE
  fecha = VALUES(fecha),
  monto_crc = VALUES(monto_crc),
  metodo = VALUES(metodo),
  referencia = VALUES(referencia),
  nota = VALUES(nota);

-- ----------------------------------------------------------------------
-- Pagos a proveedores (CxP)
-- ----------------------------------------------------------------------
INSERT INTO pago (id, compra_id, fecha, monto_crc, metodo, referencia, nota)
VALUES
  (9701, 5001, '2024-05-25', 20000.00, 'TRANSFERENCIA', 'PAY-5001A', 'Abono compra mayo'),
  (9702, 5002, '2024-06-18', 35000.00, 'TRANSFERENCIA', 'PAY-5002', 'Abono parcial 5002'),
  (9703, 5003, '2024-07-10', 79200.00, 'TRANSFERENCIA', 'PAY-5003', 'Pago completo reabastecimiento')
ON DUPLICATE KEY UPDATE
  fecha = VALUES(fecha),
  monto_crc = VALUES(monto_crc),
  metodo = VALUES(metodo),
  referencia = VALUES(referencia),
  nota = VALUES(nota);

-- ----------------------------------------------------------------------
-- Gastos operativos
-- ----------------------------------------------------------------------
INSERT INTO categoria_gasto (id, nombre)
VALUES
  (9101, 'Servicios Publicos'),
  (9102, 'Logistica'),
  (9103, 'Marketing')
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre);

INSERT INTO gasto (id, fecha, categoria_id, monto_crc, proveedor_id, metodo_pago, nota)
VALUES
  (9001, '2024-05-31', (SELECT id FROM categoria_gasto WHERE nombre = 'Servicios Publicos'), 125000.00, NULL, 'TRANSFERENCIA', 'Electricidad y agua mayo'),
  (9002, '2024-06-05', (SELECT id FROM categoria_gasto WHERE nombre = 'Logistica'), 42000.00, NULL, 'EFECTIVO', 'Envios a clientes junio'),
  (9003, '2024-07-02', (SELECT id FROM categoria_gasto WHERE nombre = 'Marketing'), 38000.00, NULL, 'TARJETA', 'Campana degustacion julio'),
  (9004, '2024-08-28', (SELECT id FROM categoria_gasto WHERE nombre = 'Logistica'), 45000.00, NULL, 'TRANSFERENCIA', 'Reparto regional agosto')
ON DUPLICATE KEY UPDATE
  fecha = VALUES(fecha),
  categoria_id = VALUES(categoria_id),
  monto_crc = VALUES(monto_crc),
  proveedor_id = VALUES(proveedor_id),
  metodo_pago = VALUES(metodo_pago),
  nota = VALUES(nota);

-- ----------------------------------------------------------------------
-- Recursos humanos / planillas
-- ----------------------------------------------------------------------
INSERT INTO empleado (id, nombre, num_doc, telefono, email, direccion, tarifa_hora_crc, activo)
VALUES
  (8001, 'Laura Ramos', '1-185-000111', '+506 7001 1111', 'laura@glutenfree.test', 'San Jose, CR', 3500.00, 1),
  (8002, 'Jorge Solis', '1-185-000222', '+506 7001 2222', 'jorge@glutenfree.test', 'Alajuela, CR', 3200.00, 1),
  (8003, 'Maria Brenes', '1-185-000333', '+506 7001 3333', 'maria@glutenfree.test', 'Cartago, CR', 2800.00, 1)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  telefono = VALUES(telefono),
  email = VALUES(email),
  direccion = VALUES(direccion),
  tarifa_hora_crc = VALUES(tarifa_hora_crc),
  activo = VALUES(activo);

INSERT INTO planilla_semana (id, semana_inicio, nota, factor_extra, factor_doble, factor_feriado)
VALUES
  (7101, '2024-05-13', 'Semana lanzamiento producto', NULL, NULL, NULL),
  (7102, '2024-06-10', 'Refuerzo pedidos junio', NULL, NULL, NULL),
  (7103, '2024-07-08', 'Eventos y ferias julio', NULL, NULL, NULL),
  (7104, '2024-08-12', 'Ajuste produccion agosto', NULL, NULL, NULL)
ON DUPLICATE KEY UPDATE
  nota = VALUES(nota),
  factor_extra = VALUES(factor_extra),
  factor_doble = VALUES(factor_doble),
  factor_feriado = VALUES(factor_feriado);

INSERT INTO planilla_det (id, planilla_id, empleado_id, persona, rol, horas_previstas, horas_efectivas, tarifa_hora_crc, estado_pago)
VALUES
  (710101, 7101, 8001, NULL, 'Produccion', 40.00, 38.00, 3500.00, 'PAGADO'),
  (710102, 7101, 8002, NULL, 'Empaque', 36.00, 34.00, 3200.00, 'PAGADO'),
  (710201, 7102, 8001, NULL, 'Produccion', 42.00, 41.00, 3500.00, 'PAGADO'),
  (710202, 7102, 8003, NULL, 'Ventas feria', 28.00, 29.00, 2800.00, 'PAGADO'),
  (710301, 7103, 8001, NULL, 'Produccion', 44.00, 45.00, 3500.00, 'PAGADO'),
  (710302, 7103, 8002, NULL, 'Empaque', 38.00, 37.00, 3250.00, 'PAGADO'),
  (710303, 7103, 8003, NULL, 'Marketing campo', 24.00, 26.00, 2850.00, 'PAGADO'),
  (710401, 7104, 8001, NULL, 'Produccion', 40.00, 39.00, 3600.00, 'PENDIENTE'),
  (710402, 7104, 8002, NULL, 'Empaque', 32.00, 33.00, 3300.00, 'PENDIENTE'),
  (710403, 7104, 8003, NULL, 'Soporte ventas', 30.00, 28.00, 2900.00, 'PAGADO')
ON DUPLICATE KEY UPDATE
  planilla_id = VALUES(planilla_id),
  empleado_id = VALUES(empleado_id),
  persona = VALUES(persona),
  rol = VALUES(rol),
  horas_previstas = VALUES(horas_previstas),
  horas_efectivas = VALUES(horas_efectivas),
  tarifa_hora_crc = VALUES(tarifa_hora_crc),
  estado_pago = VALUES(estado_pago);

INSERT INTO planilla_det_dia (id, det_id, fecha, horas_reg, horas_extra, horas_doble, feriado, horas_feriado)
VALUES
  (711001, 710101, '2024-05-13', 8.00, 1.00, 0.00, 0, 0.00),
  (711002, 710101, '2024-05-14', 8.00, 0.50, 0.00, 0, 0.00),
  (711003, 710102, '2024-05-13', 7.00, 0.00, 0.00, 0, 0.00),
  (711004, 710102, '2024-05-14', 7.00, 0.25, 0.00, 0, 0.00),
  (711005, 710202, '2024-06-15', 6.00, 1.50, 0.00, 0, 0.00),
  (711006, 710303, '2024-07-12', 5.00, 0.00, 0.00, 0, 0.00)
ON DUPLICATE KEY UPDATE
  horas_reg = VALUES(horas_reg),
  horas_extra = VALUES(horas_extra),
  horas_doble = VALUES(horas_doble),
  feriado = VALUES(feriado),
  horas_feriado = VALUES(horas_feriado);

-- ----------------------------------------------------------------------
-- Mermas de inventario
-- ----------------------------------------------------------------------
INSERT INTO merma (id, fecha, producto_id, uom_id, cantidad, ubicacion_id, motivo, nota)
VALUES
  (
    9401,
    '2024-06-03',
    (SELECT id FROM producto WHERE sku = 'PT-PAN-QUINOA'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    2.000,
    (SELECT id FROM ubicacion WHERE nombre = 'Bodega Central'),
    'Producto fuera de especificacion',
    'Pan con textura inconsistente'
  ),
  (
    9402,
    '2024-07-20',
    (SELECT id FROM producto WHERE sku = 'PT-GAL-COCO'),
    (SELECT id FROM uom WHERE codigo = 'UN'),
    5.000,
    (SELECT id FROM ubicacion WHERE nombre = 'Planta Produccion'),
    'Rotura de empaques',
    'Golpe durante despacho'
  )
ON DUPLICATE KEY UPDATE
  fecha = VALUES(fecha),
  producto_id = VALUES(producto_id),
  uom_id = VALUES(uom_id),
  cantidad = VALUES(cantidad),
  ubicacion_id = VALUES(ubicacion_id),
  motivo = VALUES(motivo),
  nota = VALUES(nota);

COMMIT;

SELECT 'Demo data ready' AS status_message;
