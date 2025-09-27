from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/produccion", tags=["produccion"])

@router.post("/tandas")
def crear_tanda(payload: dict, db = Depends(db_dep)):
    data = {
        "fecha": payload.get("fecha"),
        "tanda_receta_id": payload.get("tanda_receta_id"),
        "cantidad_tandas": payload.get("cantidad_tandas"),
        "nota": payload.get("nota"),
    }
    if not data["fecha"]:
        raise HTTPException(400, "fecha requerida")
    res = db.execute(text("""
        INSERT INTO tanda (fecha, tanda_receta_id, cantidad_tandas, nota)
        VALUES (:fecha, :tanda_receta_id, :cantidad_tandas, :nota)
    """), data)
    db.commit()
    return {"id": res.lastrowid}

@router.post("/tandas/{tanda_id}/consumos")
def agregar_consumo(tanda_id: int, payload: dict, db = Depends(db_dep)):
    data = {
        "tanda_id": tanda_id,
        "producto_id": payload.get("producto_id"),
        "uom_id": payload.get("uom_id"),
        "cantidad": payload.get("cantidad"),
    }
    if not data["producto_id"]:
        raise HTTPException(400, "producto_id requerido")
    db.execute(text("""
        INSERT INTO tanda_consumo (tanda_id, producto_id, uom_id, cantidad)
        VALUES (:tanda_id, :producto_id, :uom_id, :cantidad)
    """), data)
    db.execute(text("""
        INSERT INTO inv_mov (fecha, producto_id, uom_id, cantidad, tipo, ref, ref_id)
        SELECT t.fecha, :producto_id, :uom_id, -:cantidad, 'PROD_CONSUMO', 'tanda', :tanda_id
        FROM tanda t WHERE t.id=:tanda_id
    """), data)
    db.commit()
    return {"ok": True}

@router.post("/tandas/{tanda_id}/salidas")
def agregar_salida(tanda_id: int, payload: dict, db = Depends(db_dep)):
    data = {
        "tanda_id": tanda_id,
        "producto_id": payload.get("producto_id"),
        "uom_id": payload.get("uom_id"),
        "cantidad": payload.get("cantidad"),
    }
    if not data["producto_id"]:
        raise HTTPException(400, "producto_id requerido")
    db.execute(text("""
        INSERT INTO tanda_salida (tanda_id, producto_id, uom_id, cantidad)
        VALUES (:tanda_id, :producto_id, :uom_id, :cantidad)
    """), data)
    db.execute(text("""
        INSERT INTO inv_mov (fecha, producto_id, uom_id, cantidad, tipo, ref, ref_id)
        SELECT t.fecha, :producto_id, :uom_id, :cantidad, 'PROD_SALIDA', 'tanda', :tanda_id
        FROM tanda t WHERE t.id=:tanda_id
    """), data)
    db.commit()
    return {"ok": True}
