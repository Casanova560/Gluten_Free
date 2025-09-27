# app/routers/recetas.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from decimal import Decimal
from typing import List, Optional
from ..db import get_db
from .. import models
from ..schemas import (
    RecetaCreate, RecetaOut, RecetaIngCreate, RecetaOutCreate,
    CosteoRecetaOut, CosteoIngrediente
)

router = APIRouter(prefix="/recetas", tags=["recetas"])

# ===== CRUD básico =====
@router.get("", response_model=List[RecetaOut])
def list_recetas(db: Session = Depends(get_db)):
    return db.execute(select(models.Receta)).scalars().all()

@router.post("", response_model=RecetaOut)
def create_receta(payload: RecetaCreate, db: Session = Depends(get_db)):
    rec = models.Receta(**payload.dict())
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec

@router.post("/{receta_id}/ingredientes")
def add_ingrediente(receta_id: int, payload: RecetaIngCreate, db: Session = Depends(get_db)):
    rec = db.get(models.Receta, receta_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    # Sólo MP en ingredientes
    prod = db.get(models.Producto, payload.producto_id)
    if not prod or prod.tipo != 'MP':
        raise HTTPException(status_code=400, detail="Ingrediente debe ser Materia Prima (MP).")
    row = models.RecetaDet(receta_id=receta_id, **payload.dict())
    db.add(row)
    db.commit()
    return {"ok": True, "id": row.id}

@router.get("/{receta_id}/ingredientes", response_model=List[dict])
def list_ingredientes(receta_id: int, db: Session = Depends(get_db)):
    sql = text("""
      SELECT rd.id, rd.producto_id, rd.uom_id, rd.cantidad, p.nombre
      FROM receta_det rd JOIN producto p ON p.id=rd.producto_id
      WHERE rd.receta_id=:rid
    """)
    rows = db.execute(sql, {"rid": receta_id}).mappings().all()
    return [dict(r) for r in rows]

@router.post("/{receta_id}/salidas")
def add_salida(receta_id: int, payload: RecetaOutCreate, db: Session = Depends(get_db)):
    rec = db.get(models.Receta, receta_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    # Sólo PT como salida
    prod = db.get(models.Producto, payload.producto_id)
    if not prod or prod.tipo != 'PT':
        raise HTTPException(status_code=400, detail="Salida debe ser Producto Terminado (PT).")
    row = models.RecetaSalida(receta_id=receta_id, **payload.dict())
    db.add(row)
    db.commit()
    return {"ok": True, "id": row.id}

@router.get("/{receta_id}/salidas", response_model=List[dict])
def list_salidas(receta_id: int, db: Session = Depends(get_db)):
    sql = text("""
      SELECT rs.id, rs.producto_id, rs.uom_id, rs.rendimiento, p.nombre
      FROM receta_salida rs JOIN producto p ON p.id=rs.producto_id
      WHERE rs.receta_id=:rid
    """)
    rows = db.execute(sql, {"rid": receta_id}).mappings().all()
    return [dict(r) for r in rows]

# ===== Costeo de receta =====
@router.get("/costeo/{receta_id}", response_model=CosteoRecetaOut)
def costear_receta(
    receta_id: int,
    rendimiento: Optional[Decimal] = Query(None),
    porcentaje_indirecto: Optional[float] = Query(None),  # 18 -> 18% o 0.18
    db: Session = Depends(get_db)
):
    # Ingredientes con costo (vista v_receta_costeo_det)
    sql_det = text("""
      SELECT producto_nombre AS nombre, cantidad, costo_unitario_crc, costo_total_crc
      FROM v_receta_costeo_det
      WHERE receta_id = :rid
    """)
    det = [CosteoIngrediente(**dict(r)) for r in db.execute(sql_det, {"rid": receta_id}).mappings().all()]

    # Totales (vista v_receta_costeo_totales)
    sql_tot = text("""
      SELECT receta_id, costo_directo_crc, rendimiento_total, unitario_estimado_crc
      FROM v_receta_costeo_totales
      WHERE receta_id = :rid
    """)
    tot = db.execute(sql_tot, {"rid": receta_id}).mappings().first()
    if not tot:
        raise HTTPException(status_code=404, detail="Receta sin ingredientes.")

    costo_directo = Decimal(tot["costo_directo_crc"] or 0)
    rend_base = rendimiento if rendimiento is not None else (tot["rendimiento_total"] or None)

    # % indirecto: si llega param => normalizar; si no, tomar config_costeo.parametro_json->porcentaje (puede ser NULL => 0)
    pct = None
    if porcentaje_indirecto is not None:
        pct = Decimal(str(porcentaje_indirecto))
        if pct > 1:  # usuario mandó 18 => 18%
            pct = pct / 100
    else:
        row = db.execute(text("SELECT JSON_EXTRACT(parametro_json,'$.porcentaje') AS pct FROM config_costeo WHERE id=1")).first()
        if row and row[0] is not None:
            pct = Decimal(str(row[0]))
        else:
            pct = Decimal("0")  # si no hay base de mes aquí, dejamos 0; (el prorrateo dinámico lo haces a nivel de vista si quieres)

    costo_indirecto = (costo_directo * pct).quantize(Decimal("0.000001"))
    costo_total = costo_directo + costo_indirecto
    unit = None
    if rend_base and Decimal(str(rend_base)) > 0:
        unit = (costo_total / Decimal(str(rend_base))).quantize(Decimal("0.000001"))

    return CosteoRecetaOut(
        receta_id=receta_id,
        rendimiento_total=rend_base,
        costo_directo_crc=costo_directo,
        costo_indirecto_asignado_crc=costo_indirecto,
        costo_total_crc=costo_total,
        unitario_crc=unit,
        ingredientes=det
    )
