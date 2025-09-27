# app/routers/finanzas.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from typing import List
from ..db import get_db
from .. import models
from ..schemas import (
    CostoIndirectoCreate, CostoIndirectoOut,
    ConfigCosteoIn, ConfigCosteoOut
)

router = APIRouter(prefix="/finanzas", tags=["finanzas"])

# ===== Partidas de indirectos =====
@router.get("/indirectos", response_model=List[CostoIndirectoOut])
def list_indirectos(db: Session = Depends(get_db)):
    return db.execute(select(models.CostoIndirecto)).scalars().all()

@router.post("/indirectos", response_model=CostoIndirectoOut)
def create_indirecto(payload: CostoIndirectoCreate, db: Session = Depends(get_db)):
    row = models.CostoIndirecto(**payload.dict())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

# ===== Configuración de costeo =====
@router.get("/config/indirectos", response_model=ConfigCosteoOut)
def get_cfg(db: Session = Depends(get_db)):
    row = db.get(models.ConfigCosteo, 1)
    if not row:
        # bootstrap
        row = models.ConfigCosteo(id=1, metodo="PCT_DIRECTO", parametro_json={"porcentaje": None})
        db.add(row)
        db.commit()
        db.refresh(row)
    pct = None
    if row.parametro_json and row.parametro_json.get("porcentaje") is not None:
        pct = float(row.parametro_json["porcentaje"])
    return ConfigCosteoOut(metodo=row.metodo, pct=pct)

@router.put("/config/indirectos", response_model=ConfigCosteoOut)
def set_cfg(payload: ConfigCosteoIn, db: Session = Depends(get_db)):
    row = db.get(models.ConfigCosteo, 1)
    if not row:
        row = models.ConfigCosteo(id=1)
        db.add(row)
    row.metodo = payload.metodo
    pjson = row.parametro_json or {}
    if payload.metodo == "PCT_DIRECTO":
        # payload.pct puede venir 18 -> 18% o 0.18; normaliza
        pct = payload.pct
        if pct is not None and pct > 1:
            pct = pct / 100.0
        pjson["porcentaje"] = pct
    else:
        pjson["porcentaje"] = None
    row.parametro_json = pjson
    db.commit()
    db.refresh(row)
    return ConfigCosteoOut(metodo=row.metodo, pct=row.parametro_json.get("porcentaje"))
