# app/schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import date

# ========= Productos =========
class ProductoBase(BaseModel):
    sku: Optional[str] = None
    nombre: str
    tipo: str
    uom_base_id: int
    activo: Optional[bool] = True
    # NUEVO
    precio_venta_crc: Optional[Decimal] = None
    costo_estandar_crc: Optional[Decimal] = None

class ProductoCreate(ProductoBase):
    pass

class ProductoUpdate(BaseModel):
    sku: Optional[str] = None
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    uom_base_id: Optional[int] = None
    activo: Optional[bool] = None
    precio_venta_crc: Optional[Decimal] = None
    costo_estandar_crc: Optional[Decimal] = None

class ProductoOut(ProductoBase):
    id: int
    class Config:
        from_attributes = True

# ========= Recetas =========
class RecetaCreate(BaseModel):
    nombre: str
    producto_salida_id: Optional[int] = None
    uom_salida_id: Optional[int] = None
    nota: Optional[str] = None
    activo: Optional[bool] = True

class RecetaOut(RecetaCreate):
    id: int
    class Config:
        from_attributes = True

class RecetaIngCreate(BaseModel):
    producto_id: int
    uom_id: int
    cantidad: Decimal
    nota: Optional[str] = None

class RecetaOutCreate(BaseModel):
    producto_id: int
    uom_id: int
    rendimiento: Decimal
    nota: Optional[str] = None

# ========= Producción =========
class TandaCreate(BaseModel):
    fecha: date
    receta_id: Optional[int] = None
    ubicacion_origen_id: Optional[int] = None
    ubicacion_destino_id: Optional[int] = None
    nota: Optional[str] = None

class TandaLine(BaseModel):
    producto_id: int
    uom_id: int
    cantidad: Decimal

# ========= Finanzas =========
class CostoIndirectoCreate(BaseModel):
    nombre: str
    monto_mensual_crc: Decimal
    activo: Optional[bool] = True

class CostoIndirectoOut(CostoIndirectoCreate):
    id: int
    class Config:
        from_attributes = True

class ConfigCosteoIn(BaseModel):
    metodo: str = Field(default="PCT_DIRECTO")
    pct: Optional[float] = None  # si metodo='PCT_DIRECTO' (porcentaje 0..1)

class ConfigCosteoOut(BaseModel):
    metodo: str
    pct: Optional[float] = None

# ========= Costeo (salidas API) =========
class CosteoIngrediente(BaseModel):
    nombre: str
    cantidad: Decimal
    costo_unitario_crc: Decimal
    costo_total_crc: Decimal

class CosteoRecetaOut(BaseModel):
    receta_id: int
    rendimiento_total: Optional[Decimal] = None
    costo_directo_crc: Decimal
    costo_indirecto_asignado_crc: Decimal
    costo_total_crc: Decimal
    unitario_crc: Optional[Decimal] = None
    ingredientes: List[CosteoIngrediente]

class CosteoTandaOut(BaseModel):
    tanda_id: int
    costo_directo_crc: Decimal
    costo_indirecto_crc: Decimal
    costo_total_crc: Decimal
    unitario_crc: Optional[Decimal] = None
    consumos: List[CosteoIngrediente]
