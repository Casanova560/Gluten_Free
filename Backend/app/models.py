# app/models.py
from sqlalchemy import (
    Column, Integer, BigInteger, String, Numeric, Date, DateTime, Boolean,
    Enum, ForeignKey, Text, JSON
)
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

# =======================
# Catálogos / base
# =======================
class AppUser(Base):
    __tablename__ = "app_user"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    username = Column(String(80), nullable=False, unique=True)
    full_name = Column(String(120))
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class UOM(Base):
    __tablename__ = "uom"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    codigo = Column(String(20), nullable=False, unique=True)
    nombre = Column(String(80), nullable=False)

class Producto(Base):
    __tablename__ = "producto"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    sku = Column(String(64), nullable=False, unique=True)
    nombre = Column(String(160), nullable=False)
    tipo = Column(Enum('MP', 'PT', name="producto_tipo"), nullable=False)
    uom_base_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    # NUEVO: columnas de valor
    precio_venta_crc = Column(Numeric(18, 6), nullable=True)      # PT
    costo_estandar_crc = Column(Numeric(18, 6), nullable=True)    # MP (fallback)
    activo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class Cliente(Base):
    __tablename__ = "cliente"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    nombre = Column(String(160), nullable=False)

class Proveedor(Base):
    __tablename__ = "proveedor"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    nombre = Column(String(160), nullable=False)

class Ubicacion(Base):
    __tablename__ = "ubicacion"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    nombre = Column(String(120), nullable=False, unique=True)
    tipo = Column(Enum('BODEGA', 'PRODUCCION', 'TIENDA', name="ubicacion_tipo"), nullable=False, default='BODEGA')

# =======================
# Recetas / Producción
# =======================
class Receta(Base):
    __tablename__ = "receta"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    nombre = Column(String(160), nullable=False, unique=True)
    producto_salida_id = Column(BigInteger, ForeignKey("producto.id"))
    uom_salida_id = Column(BigInteger, ForeignKey("uom.id"))
    nota = Column(Text)
    activo = Column(Boolean, nullable=False, default=True)

class RecetaDet(Base):
    __tablename__ = "receta_det"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    receta_id = Column(BigInteger, ForeignKey("receta.id"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id"), nullable=False)
    uom_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    cantidad = Column(Numeric(18, 6), nullable=False)
    nota = Column(String(200))

class RecetaSalida(Base):
    __tablename__ = "receta_salida"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    receta_id = Column(BigInteger, ForeignKey("receta.id"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id"), nullable=False)
    uom_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    rendimiento = Column(Numeric(18, 6), nullable=False)
    nota = Column(String(200))

class Tanda(Base):
    __tablename__ = "tanda"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    fecha = Column(Date, nullable=False)
    receta_id = Column(BigInteger, ForeignKey("receta.id"))
    ubicacion_origen_id = Column(BigInteger, ForeignKey("ubicacion.id"))
    ubicacion_destino_id = Column(BigInteger, ForeignKey("ubicacion.id"))
    nota = Column(String(240))

class TandaConsumo(Base):
    __tablename__ = "tanda_consumo"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tanda_id = Column(BigInteger, ForeignKey("tanda.id"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id"), nullable=False)
    uom_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    cantidad = Column(Numeric(18, 6), nullable=False)

class TandaSalida(Base):
    __tablename__ = "tanda_salida"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tanda_id = Column(BigInteger, ForeignKey("tanda.id"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id"), nullable=False)
    uom_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    cantidad = Column(Numeric(18, 6), nullable=False)

# =======================
# Compras / Ventas (cab + det mínimos)
# =======================
class Compra(Base):
    __tablename__ = "compra"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    fecha = Column(Date, nullable=False)
    proveedor_id = Column(BigInteger, ForeignKey("proveedor.id"), nullable=False)
    condicion_pago = Column(Enum('CONTADO', 'CREDITO', name="cond_pago"), default='CONTADO')
    dias_credito = Column(Integer)
    fecha_limite = Column(Date)

class CompraDet(Base):
    __tablename__ = "compra_det"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    compra_id = Column(BigInteger, ForeignKey("compra.id"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id"), nullable=False)
    uom_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    cantidad = Column(Numeric(18, 6), nullable=False)
    costo_unitario_crc = Column(Numeric(18, 6), nullable=False)
    descuento_crc = Column(Numeric(18, 6), nullable=False, default=0)

class Venta(Base):
    __tablename__ = "venta"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    fecha = Column(Date, nullable=False)
    cliente_id = Column(BigInteger, ForeignKey("cliente.id"), nullable=False)
    condicion_pago = Column(Enum('CONTADO', 'CREDITO', name="cond_pago_venta"), default='CONTADO')
    dias_credito = Column(Integer)
    fecha_limite = Column(Date)

class VentaDet(Base):
    __tablename__ = "venta_det"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    venta_id = Column(BigInteger, ForeignKey("venta.id"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id"), nullable=False)
    uom_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    cantidad = Column(Numeric(18, 6), nullable=False)
    precio_unitario_crc = Column(Numeric(18, 6), nullable=False)
    descuento_crc = Column(Numeric(18, 6), nullable=False, default=0)

# =======================
# Costos indirectos y config
# =======================
class CostoIndirecto(Base):
    __tablename__ = "costo_indirecto"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    nombre = Column(String(160), nullable=False)
    monto_mensual_crc = Column(Numeric(18, 6), nullable=False, default=0)
    activo = Column(Boolean, nullable=False, default=True)

class ConfigCosteo(Base):
    __tablename__ = "config_costeo"
    id = Column(Integer, primary_key=True, default=1)
    metodo = Column(Enum('PCT_DIRECTO', 'POR_HORA', 'POR_UNIDAD', name="metodo_costeo"), nullable=False, default='PCT_DIRECTO')
    parametro_json = Column(JSON, nullable=True)

# app/models.py (añadir al final)

from sqlalchemy import Column, BigInteger, Integer, String, Date, DateTime, ForeignKey, Numeric, Boolean, Enum as SAEnum, func
from sqlalchemy.orm import relationship
from .db import Base

class PlanillaSemana(Base):
    __tablename__ = "planilla_semana"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    semana_inicio = Column(Date, nullable=False, unique=True)
    nota = Column(String(240))
    created_at = Column(DateTime, server_default=func.now())

class PlanillaDet(Base):
    __tablename__ = "planilla_det"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    planilla_id = Column(BigInteger, ForeignKey("planilla_semana.id"), nullable=False)
    empleado_id = Column(BigInteger, ForeignKey("empleado.id"), nullable=True)
    persona = Column(String(160), nullable=True)
    rol = Column(String(120), nullable=True)
    horas_previstas = Column(Numeric(10,2), nullable=False, server_default="0")
    horas_efectivas = Column(Numeric(10,2), nullable=False, server_default="0")
    tarifa_hora_crc = Column(Numeric(18,6), nullable=False, server_default="0")
    estado_pago = Column(SAEnum("PENDIENTE","PAGADO", name="estado_pago_planilla"), nullable=False, server_default="PENDIENTE")

class PlanillaDetDia(Base):
    """
    >>> IMPORTANTE: requiere la tabla física planilla_det_dia en tu SQL (id BIGINT PK, det_id FK -> planilla_det.id,
        fecha DATE, horas_reg DECIMAL, horas_extra DECIMAL, horas_doble DECIMAL, feriado TINYINT(1), horas_feriado DECIMAL,
        UNIQUE(det_id, fecha)).
    """
    __tablename__ = "planilla_det_dia"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    det_id = Column(BigInteger, ForeignKey("planilla_det.id"), nullable=False, index=True)
    fecha = Column(Date, nullable=False, index=True)
    horas_reg = Column(Numeric(10,2), nullable=False, server_default="0")
    horas_extra = Column(Numeric(10,2), nullable=False, server_default="0")
    horas_doble = Column(Numeric(10,2), nullable=False, server_default="0")
    feriado = Column(Boolean, nullable=False, server_default="0")
    horas_feriado = Column(Numeric(10,2), nullable=False, server_default="0")
