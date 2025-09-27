# app/routers/produccion.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, text, func
from decimal import Decimal
from typing import List
from ..db import get_db
from .. import models
from ..schemas import TandaCreate, TandaLine, CosteoTandaOut, CosteoIngrediente

router = APIRouter(prefix="/produccion", tags=["produccion"])

# ===== Crear tanda e ítems =====
@router.post("/tandas")
def crear_tanda(payload: TandaCreate, db: Session = Depends(get_db)):
    t = models.Tanda(**payload.dict())
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id}

@router.post("/tandas/{tanda_id}/consumos")
def add_consumo(tanda_id: int, line: TandaLine, db: Session = Depends(get_db)):
    t = db.get(models.Tanda, tanda_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tanda no encontrada")
    # Validar MP
    p = db.get(models.Producto, line.producto_id)
    if not p or p.tipo != 'MP':
        raise HTTPException(status_code=400, detail="El consumo debe ser Materia Prima (MP).")
    row = models.TandaConsumo(tanda_id=tanda_id, **line.dict())
    db.add(row)
    db.commit()
    return {"ok": True, "id": row.id}

@router.post("/tandas/{tanda_id}/salidas")
def add_salida(tanda_id: int, line: TandaLine, db: Session = Depends(get_db)):
    t = db.get(models.Tanda, tanda_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tanda no encontrada")
    # Validar PT
    p = db.get(models.Producto, line.producto_id)
    if not p or p.tipo != 'PT':
        raise HTTPException(status_code=400, detail="La salida debe ser Producto Terminado (PT).")
    row = models.TandaSalida(tanda_id=tanda_id, **line.dict())
    db.add(row)
    db.commit()
    return {"ok": True, "id": row.id}

# ===== Costeo de tanda =====
@router.get("/tandas/costeo/{tanda_id}", response_model=CosteoTandaOut)
def costear_tanda(tanda_id: int, db: Session = Depends(get_db)):
    t = db.get(models.Tanda, tanda_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tanda no encontrada")

    # Consumos con valor a la fecha (usa función SQL fn_costo_mp_al)
    sql = text("""
      SELECT
        p.nombre AS nombre,
        tc.cantidad,
        fn_costo_mp_al(:fref, tc.producto_id) AS costo_unitario_crc,
        CAST(tc.cantidad * fn_costo_mp_al(:fref, tc.producto_id) AS DECIMAL(18,6)) AS costo_total_crc
      FROM tanda_consumo tc
      JOIN producto p ON p.id=tc.producto_id
      WHERE tc.tanda_id=:tid
    """)
    items = [CosteoIngrediente(**dict(r)) for r in db.execute(sql, {"tid": tanda_id, "fref": t.fecha}).mappings().all()]
    costo_directo = sum(Decimal(str(i.costo_total_crc)) for i in items)

    # % indirecto desde config
    row = db.execute(text("SELECT metodo, parametro_json FROM config_costeo WHERE id=1")).mappings().first()
    metodo = (row["metodo"] if row else "PCT_DIRECTO") or "PCT_DIRECTO"
    pct = Decimal(str(row["parametro_json"].get("porcentaje"))) if (row and row["parametro_json"] and row["parametro_json"].get("porcentaje") is not None) else Decimal("0")

    if metodo != "PCT_DIRECTO":
        # Para mantenerlo simple aquí: si no es PCT_DIRECTO, asignamos 0 y se puede extender
        pct = Decimal("0")

    costo_indirecto = (costo_directo * pct).quantize(Decimal("0.000001"))
    total = costo_directo + costo_indirecto

    # Cantidad total salida para unitario real
    q_out = db.execute(text("SELECT COALESCE(SUM(cantidad),0) FROM tanda_salida WHERE tanda_id=:tid"), {"tid": tanda_id}).scalar() or 0
    unit = None
    if Decimal(str(q_out)) > 0:
        unit = (total / Decimal(str(q_out))).quantize(Decimal("0.000001"))

    return CosteoTandaOut(
        tanda_id=tanda_id,
        costo_directo_crc=costo_directo,
        costo_indirecto_crc=costo_indirecto,
        costo_total_crc=total,
        unitario_crc=unit,
        consumos=items
    )
