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

# ====== AÑADIR AL FINAL DE app/schemas.py (NO borrar nada existente) ======
from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal

class PlanillaSemanaCreate(BaseModel):
    semana_inicio: date
    nota: Optional[str] = None

class PlanillaSemanaOut(BaseModel):
    id: int
    semana_inicio: date
    nota: Optional[str] = None
    class Config:
        orm_mode = True

class PlanillaDetCreate(BaseModel):
    empleado_id: Optional[int] = None
    persona: Optional[str] = None
    rol: Optional[str] = None
    horas_previstas: Optional[Decimal] = Decimal("0")
    horas_efectivas: Optional[Decimal] = Decimal("0")
    tarifa_hora_crc: Optional[Decimal] = Decimal("0")
    estado_pago: Optional[str] = "PENDIENTE"

class PlanillaDetUpdate(BaseModel):
    empleado_id: Optional[int] = None
    persona: Optional[str] = None
    rol: Optional[str] = None
    horas_previstas: Optional[Decimal] = None
    horas_efectivas: Optional[Decimal] = None
    tarifa_hora_crc: Optional[Decimal] = None
    estado_pago: Optional[str] = None

class PlanillaDetOut(BaseModel):
    id: int
    planilla_id: int
    empleado_id: Optional[int]
    persona: Optional[str]
    rol: Optional[str]
    horas_previstas: Decimal
    horas_efectivas: Decimal
    tarifa_hora_crc: Decimal
    estado_pago: str
    class Config:
        orm_mode = True

class PlanillaTotalesOut(BaseModel):
    planilla_id: int
    horas_previstas: Decimal
    horas_efectivas: Decimal
    total_crc: Decimal

# app/schemas.py (añadir)

from pydantic import BaseModel, Field
from datetime import date
from typing import Optional, List, Dict, Any

# -------- Planillas ---------
class PlanillaSemanaCreate(BaseModel):
    semana_inicio: date
    nota: Optional[str] = None

class PlanillaSemanaOut(BaseModel):
    id: int
    semana_inicio: date
    nota: Optional[str] = None
    class Config:
        orm_mode = True

class PlanillaDetCreate(BaseModel):
    empleado_id: Optional[int] = None
    persona: Optional[str] = None
    rol: Optional[str] = None
    tarifa_hora_crc: Optional[float] = 0.0

class DiaPayload(BaseModel):
    fecha: date
    horas_reg: Optional[float] = 0
    horas_extra: Optional[float] = 0
    horas_doble: Optional[float] = 0
    feriado: Optional[bool] = False
    horas_feriado: Optional[float] = 0

class PlanillaDiaUpsert(BaseModel):
    dias: List[DiaPayload]

class PlanillaDetResumenOut(BaseModel):
    reg: float
    ext: float
    dob: float
    feriados: int
    horas_feriado: float
    dias_trab: int

class PlanillaDetRowOut(BaseModel):
    id: int
    empleado_id: Optional[int] = None
    empleado_nombre: Optional[str] = None
    persona: Optional[str] = None
    rol: Optional[str] = None
    tarifa_hora_crc: float
    resumen: PlanillaDetResumenOut
    dias: Dict[str, Dict[str, Any]]  # 'YYYY-MM-DD' -> {horas_reg,...}

class PlanillaSemanaDetailOut(BaseModel):
    id: int
    semana_inicio: date
    nota: Optional[str] = None
    detalles: List[PlanillaDetRowOut]
