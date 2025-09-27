from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/recetas", tags=["recetas"])

@router.get("")
def listar(db = Depends(db_dep)):
    return db.execute(text(
        "SELECT id, nombre, producto_salida_id, uom_salida_id, activo, nota FROM receta ORDER BY id DESC"
    )).mappings().all()

@router.post("")
def crear(payload: dict, db = Depends(db_dep)):
    data = {
        "nombre": payload.get("nombre"),
        "producto_salida_id": payload.get("producto_salida_id"),
        "uom_salida_id": payload.get("uom_salida_id"),
        "nota": payload.get("nota"),
        "activo": 1 if str(payload.get("activo","1")) in ("1","true","True") else 0,
    }
    if not (data["nombre"] or "").strip():
        raise HTTPException(400, "nombre requerido")
    res = db.execute(text("""
        INSERT INTO receta (nombre, producto_salida_id, uom_salida_id, nota, activo)
        VALUES (:nombre, :producto_salida_id, :uom_salida_id, :nota, :activo)
    """), data)
    db.commit()
    return {"id": res.lastrowid}

@router.get("/{receta_id}/ingredientes")
def listar_ingredientes(receta_id: int, db = Depends(db_dep)):
    return db.execute(text("""
        SELECT id, receta_id, producto_id, uom_id, cantidad
        FROM receta_det WHERE receta_id=:id ORDER BY id
    """), {"id": receta_id}).mappings().all()

@router.post("/{receta_id}/ingredientes")
def agregar_ingrediente(receta_id: int, payload: dict, db = Depends(db_dep)):
    data = {
        "receta_id": receta_id,
        "producto_id": payload.get("producto_id"),
        "uom_id": payload.get("uom_id"),
        "cantidad": payload.get("cantidad"),
    }
    if not data["producto_id"]:
        raise HTTPException(400, "producto_id requerido")
    db.execute(text("""
        INSERT INTO receta_det (receta_id, producto_id, uom_id, cantidad)
        VALUES (:receta_id, :producto_id, :uom_id, :cantidad)
    """), data)
    db.commit()
    return {"ok": True}

@router.get("/{receta_id}/salidas")
def listar_salidas(receta_id: int, db = Depends(db_dep)):
    return db.execute(text("""
        SELECT id, receta_id, producto_id, uom_id, rendimiento AS cantidad
        FROM receta_salida WHERE receta_id=:id ORDER BY id
    """), {"id": receta_id}).mappings().all()

@router.post("/{receta_id}/salidas")
def agregar_salida(receta_id: int, payload: dict, db = Depends(db_dep)):
    data = {
        "receta_id": receta_id,
        "producto_id": payload.get("producto_id"),
        "uom_id": payload.get("uom_id"),
        "rendimiento": payload.get("rendimiento"),
    }
    if not data["producto_id"]:
        raise HTTPException(400, "producto_id requerido")
    db.execute(text("""
        INSERT INTO receta_salida (receta_id, producto_id, uom_id, rendimiento)
        VALUES (:receta_id, :producto_id, :uom_id, :rendimiento)
    """), data)
    db.commit()
    return {"ok": True}
