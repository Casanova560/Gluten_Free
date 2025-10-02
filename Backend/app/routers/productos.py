from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from ..utils.deps import db_dep

router = APIRouter(prefix="/productos", tags=["productos"])

@router.get("")
def list_productos(
    q: str | None = Query(None),
    tipo: str | None = Query(None, regex="^(MP|PT)$"),
    activo: int | None = Query(None),
    db = Depends(db_dep),
):
    base = "SELECT id, sku, nombre, tipo, uom_base_id, activo, precio_venta_crc, costo_estandar_crc FROM producto WHERE 1=1"
    params = {}
    if tipo:
        base += " AND tipo = :tipo"; params["tipo"] = tipo
    if q:
        base += " AND (sku LIKE :q OR nombre LIKE :q)"; params["q"] = f"%{q}%"
    if activo is not None:
        base += " AND activo = :activo"; params["activo"] = 1 if str(activo) in ("1","true","True") else 0
    base += " ORDER BY id DESC LIMIT 500"
    return db.execute(text(base), params).mappings().all()

@router.post("")
def create_producto(payload: dict, db = Depends(db_dep)):
    fields = ["sku", "nombre", "tipo", "uom_base_id", "activo", "precio_venta_crc", "costo_estandar_crc"]
    data = {k: payload.get(k) for k in fields}
    if not (data.get("nombre") or "").strip():
        raise HTTPException(400, "nombre requerido")
    if data.get("tipo") not in ("MP","PT"):
        raise HTTPException(400, "tipo debe ser MP o PT")
    if not data.get("uom_base_id"):
        raise HTTPException(400, "uom_base_id requerido")
    data["activo"] = 1 if str(data.get("activo","1")) in ("1","true","True") else 0
    res = db.execute(text("""
        INSERT INTO producto (sku, nombre, tipo, uom_base_id, activo, precio_venta_crc, costo_estandar_crc)
        VALUES (:sku, :nombre, :tipo, :uom_base_id, :activo, :precio_venta_crc, :costo_estandar_crc)
    """), data)
    db.commit()
    pid = res.lastrowid
    return db.execute(text("SELECT * FROM producto WHERE id=:id"), {"id": pid}).mappings().first()

@router.put("/{producto_id}")
def update_producto(producto_id: int, payload: dict, db = Depends(db_dep)):
    data = {
        "id": producto_id,
        "sku": payload.get("sku"),
        "nombre": payload.get("nombre"),
        "tipo": payload.get("tipo"),
        "uom_base_id": payload.get("uom_base_id"),
        "activo": (1 if str(payload.get("activo")) in ("1","true","True") else 0) if payload.get("activo") is not None else None,
        "precio_venta_crc": payload.get("precio_venta_crc"),
        "costo_estandar_crc": payload.get("costo_estandar_crc"),
    }
    db.execute(text("""
        UPDATE producto SET
          sku = COALESCE(:sku, sku),
          nombre = COALESCE(:nombre, nombre),
          tipo = COALESCE(:tipo, tipo),
          uom_base_id = COALESCE(:uom_base_id, uom_base_id),
          activo = COALESCE(:activo, activo),
          precio_venta_crc = COALESCE(:precio_venta_crc, precio_venta_crc),
          costo_estandar_crc = COALESCE(:costo_estandar_crc, costo_estandar_crc)
        WHERE id = :id
    """), data)
    db.commit()
    row = db.execute(text("SELECT * FROM producto WHERE id=:id"), {"id": producto_id}).mappings().first()
    if not row:
        raise HTTPException(404, "producto no encontrado")
    return row

@router.delete("/{producto_id}")
def delete_producto(producto_id: int, db = Depends(db_dep)):
    try:
        res = db.execute(text("DELETE FROM producto WHERE id = :id"), {"id": producto_id})
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "No se puede eliminar el producto porque esta referenciado en otros registros")
    if res.rowcount == 0:
        raise HTTPException(404, "producto no encontrado")
    return {"ok": True}

