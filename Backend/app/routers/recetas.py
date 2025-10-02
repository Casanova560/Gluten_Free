from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from ..utils.deps import db_dep

router = APIRouter(prefix="/recetas", tags=["recetas"])


def _normalize_bool(value, default=1):
    if value is None:
        return default
    return 1 if str(value).strip().lower() in ("1", "true", "t", "y", "yes", "si") else 0


def _normalize_decimal(value, default=0.0):
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _get_receta(db, receta_id: int):
    receta = db.execute(text("""
        SELECT id, nombre, producto_salida_id, uom_salida_id, nota, activo,
               mano_obra_crc, merma_crc, indirectos_pct
        FROM receta
        WHERE id = :id
    """), {"id": receta_id}).mappings().first()
    if not receta:
        return None
    ingredientes = db.execute(text("""
        SELECT id, receta_id, producto_id, uom_id, cantidad,
               costo_unitario_crc, otros_costos_crc
        FROM receta_det
        WHERE receta_id = :id
        ORDER BY id
    """), {"id": receta_id}).mappings().all()
    salidas = db.execute(text("""
        SELECT id, receta_id, producto_id, uom_id, rendimiento
        FROM receta_salida
        WHERE receta_id = :id
        ORDER BY id
    """), {"id": receta_id}).mappings().all()
    receta["ingredientes"] = ingredientes
    receta["salidas"] = salidas
    return receta


@router.get("")
def listar(db = Depends(db_dep)):
    return db.execute(text("""
        SELECT id, nombre, producto_salida_id, uom_salida_id, nota, activo,
               mano_obra_crc, merma_crc, indirectos_pct
        FROM receta
        ORDER BY id DESC
    """)).mappings().all()


@router.get("/{receta_id}")
def obtener(receta_id: int, db = Depends(db_dep)):
    receta = _get_receta(db, receta_id)
    if not receta:
        raise HTTPException(404, "receta no encontrada")
    return receta


@router.post("")
def crear(payload: dict, db = Depends(db_dep)):
    data = {
        "nombre": payload.get("nombre"),
        "producto_salida_id": payload.get("producto_salida_id"),
        "uom_salida_id": payload.get("uom_salida_id"),
        "nota": payload.get("nota"),
        "activo": _normalize_bool(payload.get("activo"), 1),
        "mano_obra_crc": _normalize_decimal(payload.get("mano_obra_crc"), 0),
        "merma_crc": _normalize_decimal(payload.get("merma_crc"), 0),
        "indirectos_pct": payload.get("indirectos_pct"),
    }
    if not (data["nombre"] or "").strip():
        raise HTTPException(400, "nombre requerido")
    res = db.execute(text("""
        INSERT INTO receta (nombre, producto_salida_id, uom_salida_id, nota, activo, mano_obra_crc, merma_crc, indirectos_pct)
        VALUES (:nombre, :producto_salida_id, :uom_salida_id, :nota, :activo, :mano_obra_crc, :merma_crc, :indirectos_pct)
    """), data)
    receta_id = res.lastrowid
    ingredientes = payload.get("ingredientes") or []
    for item in ingredientes:
        body = {
            "receta_id": receta_id,
            "producto_id": item.get("producto_id"),
            "uom_id": item.get("uom_id"),
            "cantidad": _normalize_decimal(item.get("cantidad"), 0),
            "costo_unitario_crc": _normalize_decimal(item.get("costo_unitario_crc"), 0),
            "otros_costos_crc": _normalize_decimal(item.get("otros_costos_crc"), 0),
        }
        if not body["producto_id"]:
            raise HTTPException(400, "producto_id requerido en ingrediente")
        if not body["uom_id"]:
            raise HTTPException(400, "uom_id requerido en ingrediente")
        if body["cantidad"] <= 0:
            raise HTTPException(400, "cantidad debe ser mayor a cero")
        db.execute(text("""
            INSERT INTO receta_det (receta_id, producto_id, uom_id, cantidad, costo_unitario_crc, otros_costos_crc)
            VALUES (:receta_id, :producto_id, :uom_id, :cantidad, :costo_unitario_crc, :otros_costos_crc)
        """), body)
    salidas = payload.get("salidas") or []
    for item in salidas:
        body = {
            "receta_id": receta_id,
            "producto_id": item.get("producto_id"),
            "uom_id": item.get("uom_id"),
            "rendimiento": _normalize_decimal(item.get("rendimiento"), 0),
        }
        if not body["producto_id"]:
            raise HTTPException(400, "producto_id requerido en salida")
        if not body["uom_id"]:
            raise HTTPException(400, "uom_id requerido en salida")
        if body["rendimiento"] <= 0:
            raise HTTPException(400, "rendimiento debe ser mayor a cero")
        db.execute(text("""
            INSERT INTO receta_salida (receta_id, producto_id, uom_id, rendimiento)
            VALUES (:receta_id, :producto_id, :uom_id, :rendimiento)
        """), body)
    db.commit()
    return _get_receta(db, receta_id)


@router.put("/{receta_id}")
def actualizar(receta_id: int, payload: dict, db = Depends(db_dep)):
    receta = _get_receta(db, receta_id)
    if not receta:
        raise HTTPException(404, "receta no encontrada")
    data = {
        "id": receta_id,
        "nombre": payload.get("nombre"),
        "producto_salida_id": payload.get("producto_salida_id"),
        "uom_salida_id": payload.get("uom_salida_id"),
        "nota": payload.get("nota"),
        "activo": _normalize_bool(payload.get("activo"), None),
        "mano_obra_crc": payload.get("mano_obra_crc"),
        "merma_crc": payload.get("merma_crc"),
        "indirectos_pct": payload.get("indirectos_pct"),
    }
    db.execute(text("""
        UPDATE receta SET
          nombre = COALESCE(:nombre, nombre),
          producto_salida_id = COALESCE(:producto_salida_id, producto_salida_id),
          uom_salida_id = COALESCE(:uom_salida_id, uom_salida_id),
          nota = COALESCE(:nota, nota),
          activo = COALESCE(:activo, activo),
          mano_obra_crc = COALESCE(:mano_obra_crc, mano_obra_crc),
          merma_crc = COALESCE(:merma_crc, merma_crc),
          indirectos_pct = COALESCE(:indirectos_pct, indirectos_pct)
        WHERE id = :id
    """), data)
    if "ingredientes" in payload:
        db.execute(text("DELETE FROM receta_det WHERE receta_id = :id"), {"id": receta_id})
        for item in payload.get("ingredientes") or []:
            body = {
                "receta_id": receta_id,
                "producto_id": item.get("producto_id"),
                "uom_id": item.get("uom_id"),
                "cantidad": _normalize_decimal(item.get("cantidad"), 0),
                "costo_unitario_crc": _normalize_decimal(item.get("costo_unitario_crc"), 0),
                "otros_costos_crc": _normalize_decimal(item.get("otros_costos_crc"), 0),
            }
            if not body["producto_id"] or not body["uom_id"] or body["cantidad"] <= 0:
                raise HTTPException(400, "Ingrediente invalido")
            db.execute(text("""
                INSERT INTO receta_det (receta_id, producto_id, uom_id, cantidad, costo_unitario_crc, otros_costos_crc)
                VALUES (:receta_id, :producto_id, :uom_id, :cantidad, :costo_unitario_crc, :otros_costos_crc)
            """), body)
    if "salidas" in payload:
        db.execute(text("DELETE FROM receta_salida WHERE receta_id = :id"), {"id": receta_id})
        for item in payload.get("salidas") or []:
            body = {
                "receta_id": receta_id,
                "producto_id": item.get("producto_id"),
                "uom_id": item.get("uom_id"),
                "rendimiento": _normalize_decimal(item.get("rendimiento"), 0),
            }
            if not body["producto_id"] or not body["uom_id"] or body["rendimiento"] <= 0:
                raise HTTPException(400, "Salida invalida")
            db.execute(text("""
                INSERT INTO receta_salida (receta_id, producto_id, uom_id, rendimiento)
                VALUES (:receta_id, :producto_id, :uom_id, :rendimiento)
            """), body)
    db.commit()
    return _get_receta(db, receta_id)


@router.delete("/{receta_id}")
def eliminar(receta_id: int, db = Depends(db_dep)):
    try:
        res = db.execute(text("DELETE FROM receta WHERE id = :id"), {"id": receta_id})
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "No se puede eliminar la receta porque esta referenciada en otros registros")
    if res.rowcount == 0:
        raise HTTPException(404, "receta no encontrada")
    return {"ok": True}


@router.get("/{receta_id}/ingredientes")
def listar_ingredientes(receta_id: int, db = Depends(db_dep)):
    return db.execute(text("""
        SELECT id, receta_id, producto_id, uom_id, cantidad, costo_unitario_crc, otros_costos_crc
        FROM receta_det
        WHERE receta_id = :id
        ORDER BY id
    """), {"id": receta_id}).mappings().all()


@router.post("/{receta_id}/ingredientes")
def agregar_ingrediente(receta_id: int, payload: dict, db = Depends(db_dep)):
    data = {
        "receta_id": receta_id,
        "producto_id": payload.get("producto_id"),
        "uom_id": payload.get("uom_id"),
        "cantidad": _normalize_decimal(payload.get("cantidad"), 0),
        "costo_unitario_crc": _normalize_decimal(payload.get("costo_unitario_crc"), 0),
        "otros_costos_crc": _normalize_decimal(payload.get("otros_costos_crc"), 0),
    }
    if not data["producto_id"]:
        raise HTTPException(400, "producto_id requerido")
    if not data["uom_id"]:
        raise HTTPException(400, "uom_id requerido")
    if data["cantidad"] <= 0:
        raise HTTPException(400, "cantidad debe ser mayor a cero")
    db.execute(text("""
        INSERT INTO receta_det (receta_id, producto_id, uom_id, cantidad, costo_unitario_crc, otros_costos_crc)
        VALUES (:receta_id, :producto_id, :uom_id, :cantidad, :costo_unitario_crc, :otros_costos_crc)
    """), data)
    db.commit()
    return {"ok": True}


@router.get("/{receta_id}/salidas")
def listar_salidas(receta_id: int, db = Depends(db_dep)):
    return db.execute(text("""
        SELECT id, receta_id, producto_id, uom_id, rendimiento
        FROM receta_salida
        WHERE receta_id = :id
        ORDER BY id
    """), {"id": receta_id}).mappings().all()


@router.post("/{receta_id}/salidas")
def agregar_salida(receta_id: int, payload: dict, db = Depends(db_dep)):
    data = {
        "receta_id": receta_id,
        "producto_id": payload.get("producto_id"),
        "uom_id": payload.get("uom_id"),
        "rendimiento": _normalize_decimal(payload.get("rendimiento"), 0),
    }
    if not data["producto_id"]:
        raise HTTPException(400, "producto_id requerido")
    if not data["uom_id"]:
        raise HTTPException(400, "uom_id requerido")
    if data["rendimiento"] <= 0:
        raise HTTPException(400, "rendimiento debe ser mayor a cero")
    db.execute(text("""
        INSERT INTO receta_salida (receta_id, producto_id, uom_id, rendimiento)
        VALUES (:receta_id, :producto_id, :uom_id, :rendimiento)
    """), data)
    db.commit()
    return {"ok": True}
