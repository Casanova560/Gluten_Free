# app/routers/indirectos.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter()

# --------- MODELOS ---------
class IndirectoIn(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=160)
    monto_mensual_crc: float = Field(..., ge=0)
    activo: int = 1

class IndirectoOut(BaseModel):
    id: int
    nombre: str
    monto_mensual_crc: float
    activo: int

class ConfigIndirectos(BaseModel):
    method: str = Field("PORCENTAJE_GLOBAL", description="PORCENTAJE_GLOBAL (default)")
    pct: float = Field(0.0, description="0.18 = 18%")

# --------- CRUD costo_indirecto ---------
@router.get("/indirectos", response_model=list[IndirectoOut])
def list_indirectos(db: Session = Depends(db_dep)):
    rows = db.execute(text("""
        SELECT id, nombre, monto_mensual_crc, activo
        FROM costo_indirecto
        ORDER BY id DESC
    """)).mappings().all()
    return [dict(r) for r in rows]

@router.post("/indirectos", response_model=IndirectoOut)
def create_indirecto(body: IndirectoIn, db: Session = Depends(db_dep)):
    r = db.execute(text("""
        INSERT INTO costo_indirecto (nombre, monto_mensual_crc, activo)
        VALUES (:n, :m, :a)
    """), {"n": body.nombre, "m": body.monto_mensual_crc, "a": body.activo})
    db.commit()
    new_id = r.lastrowid
    row = db.execute(text("""
        SELECT id, nombre, monto_mensual_crc, activo
        FROM costo_indirecto WHERE id = :id
    """), {"id": new_id}).mappings().first()
    return dict(row)

@router.put("/indirectos/{indirecto_id}", response_model=IndirectoOut)
def update_indirecto(indirecto_id: int, body: IndirectoIn, db: Session = Depends(db_dep)):
    upd = db.execute(text("""
        UPDATE costo_indirecto
        SET nombre = :n, monto_mensual_crc = :m, activo = :a
        WHERE id = :id
    """), {"n": body.nombre, "m": body.monto_mensual_crc, "a": body.activo, "id": indirecto_id})
    db.commit()
    if upd.rowcount == 0:
        raise HTTPException(status_code=404, detail="No encontrado")
    row = db.execute(text("""
        SELECT id, nombre, monto_mensual_crc, activo
        FROM costo_indirecto WHERE id = :id
    """), {"id": indirecto_id}).mappings().first()
    return dict(row)

@router.delete("/indirectos/{indirecto_id}")
def delete_indirecto(indirecto_id: int, db: Session = Depends(db_dep)):
    db.execute(text("DELETE FROM costo_indirecto WHERE id = :id"), {"id": indirecto_id})
    db.commit()
    return {"ok": True}

# --------- CONFIG (usa idempotency_key como keystore) ---------
KEY_SCOPE = "config"
KEY_NAME  = "overhead"

@router.get("/config/indirectos", response_model=ConfigIndirectos)
def get_config_indirectos(db: Session = Depends(db_dep)):
    row = db.execute(text("""
        SELECT response_json
        FROM idempotency_key
        WHERE scope = :s AND idempotency_key = :k
        ORDER BY id DESC LIMIT 1
    """), {"s": KEY_SCOPE, "k": KEY_NAME}).first()
    if row and row[0]:
        try:
            # MySQL JSON -> dict
            cfg = row[0]
            return ConfigIndirectos(**cfg)
        except Exception:
            pass
    return ConfigIndirectos()

@router.put("/config/indirectos", response_model=ConfigIndirectos)
def put_config_indirectos(body: ConfigIndirectos, db: Session = Depends(db_dep)):
    db.execute(text("""
        INSERT INTO idempotency_key (scope, idempotency_key, request_hash, response_json)
        VALUES (:s, :k, 'cfg', JSON_OBJECT('method', :m, 'pct', :p))
        ON DUPLICATE KEY UPDATE response_json = VALUES(response_json)
    """), {"s": KEY_SCOPE, "k": KEY_NAME, "m": body.method, "p": body.pct})
    db.commit()
    return body
