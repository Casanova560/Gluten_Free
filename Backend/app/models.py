# app/models.py
from sqlalchemy import (
    Column, Integer, BigInteger, String, Enum, DECIMAL, Date, Text, ForeignKey,
    TIMESTAMP, Boolean
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .db import Base

class UOM(Base):
    __tablename__ = "uom"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    codigo = Column(String(20), nullable=False, unique=True)
    nombre = Column(String(80), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=True, onupdate=func.current_timestamp())

class Producto(Base):
    __tablename__ = "producto"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    sku = Column(String(64), nullable=False, unique=True)
    nombre = Column(String(160), nullable=False)
    tipo = Column(Enum('MP', 'PT'), nullable=False)
    uom_base_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    # NUEVO: compat con patch SQL
    precio_venta_crc = Column(DECIMAL(18,6), nullable=True)
    costo_estandar_crc = Column(DECIMAL(18,6), nullable=True)
    activo = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=True, onupdate=func.current_timestamp())

    uom_base = relationship("UOM")

class Cliente(Base):
    __tablename__ = "cliente"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    nombre = Column(String(160), nullable=False)

class Proveedor(Base):
    __tablename__ = "proveedor"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    nombre = Column(String(160), nullable=False)

class Compra(Base):
    __tablename__ = "compra"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    fecha = Column(Date, nullable=False)
    proveedor_id = Column(BigInteger, ForeignKey("proveedor.id"), nullable=False)
    moneda = Column(Enum('CRC','USD'), nullable=False, default='CRC')
    tipo_cambio = Column(DECIMAL(18,6), nullable=True)
    condicion_pago = Column(Enum('CONTADO','CREDITO'), nullable=False, default='CONTADO')
    estado_cobro_pago = Column(Enum('PENDIENTE','PAGADO'), nullable=False, default='PENDIENTE')
    nota = Column(String(240), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

class CompraDet(Base):
    __tablename__ = "compra_det"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    compra_id = Column(BigInteger, ForeignKey("compra.id"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id"), nullable=False)
    uom_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    cantidad = Column(DECIMAL(18,6), nullable=False)
    costo_unitario_crc = Column(DECIMAL(18,6), nullable=False)
    descuento_crc = Column(DECIMAL(18,6), nullable=False, default=0)

class Venta(Base):
    __tablename__ = "venta"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    fecha = Column(Date, nullable=False)
    cliente_id = Column(BigInteger, ForeignKey("cliente.id"), nullable=False)
    moneda = Column(Enum('CRC','USD'), nullable=False, default='CRC')
    tipo_cambio = Column(DECIMAL(18,6), nullable=True)
    condicion_pago = Column(Enum('CONTADO','CREDITO'), nullable=False, default='CONTADO')
    estado_cobro_pago = Column(Enum('PENDIENTE','PAGADO'), nullable=False, default='PENDIENTE')
    nota = Column(String(240), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

class VentaDet(Base):
    __tablename__ = "venta_det"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    venta_id = Column(BigInteger, ForeignKey("venta.id"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id"), nullable=False)
    uom_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    cantidad = Column(DECIMAL(18,6), nullable=False)
    precio_unitario_crc = Column(DECIMAL(18,6), nullable=False)
    descuento_crc = Column(DECIMAL(18,6), nullable=False, default=0)

class Receta(Base):
    __tablename__ = "receta"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    nombre = Column(String(160), nullable=False)
    producto_salida_id = Column(BigInteger, ForeignKey("producto.id"), nullable=True)
    uom_salida_id = Column(BigInteger, ForeignKey("uom.id"), nullable=True)
    nota = Column(Text, nullable=True)
    activo = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=True, onupdate=func.current_timestamp())

class RecetaDet(Base):
    __tablename__ = "receta_det"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    receta_id = Column(BigInteger, ForeignKey("receta.id"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id"), nullable=False)  # MP
    uom_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    cantidad = Column(DECIMAL(18,6), nullable=False)
    nota = Column(String(200), nullable=True)

class RecetaSalida(Base):
    __tablename__ = "receta_salida"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    receta_id = Column(BigInteger, ForeignKey("receta.id"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id"), nullable=False)  # PT
    uom_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    rendimiento = Column(DECIMAL(18,6), nullable=False)
    nota = Column(String(200), nullable=True)

class Tanda(Base):
    __tablename__ = "tanda"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    fecha = Column(Date, nullable=False)
    receta_id = Column(BigInteger, ForeignKey("receta.id"), nullable=True)

class TandaConsumo(Base):
    __tablename__ = "tanda_consumo"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tanda_id = Column(BigInteger, ForeignKey("tanda.id"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id"), nullable=False)  # MP
    uom_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    cantidad = Column(DECIMAL(18,6), nullable=False)

class TandaSalida(Base):
    __tablename__ = "tanda_salida"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tanda_id = Column(BigInteger, ForeignKey("tanda.id"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id"), nullable=False)  # PT
    uom_id = Column(BigInteger, ForeignKey("uom.id"), nullable=False)
    cantidad = Column(DECIMAL(18,6), nullable=False)
