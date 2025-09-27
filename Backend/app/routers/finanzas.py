from fastapi import APIRouter, Depends
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/finanzas", tags=["finanzas"])

@router.get("/cxc")
def cxc(db = Depends(db_dep)):
    return db.execute(text("""
        SELECT v.id AS venta_id, v.fecha,
               DATE_ADD(v.fecha, INTERVAL COALESCE(v.dias_credito,0) DAY) AS fecha_limite,
               SUM(d.cantidad*d.precio_unitario_crc - COALESCE(d.descuento_crc,0)) AS total_crc,
               0 AS cobrado_crc,
               SUM(d.cantidad*d.precio_unitario_crc - COALESCE(d.descuento_crc,0)) AS saldo_crc,
               DATEDIFF(CURDATE(), DATE_ADD(v.fecha, INTERVAL COALESCE(v.dias_credito,0) DAY)) AS dias_vencido
        FROM venta v
        LEFT JOIN venta_det d ON d.venta_id = v.id
        GROUP BY v.id
        ORDER BY v.fecha DESC
    """)).mappings().all()

@router.get("/cxp")
def cxp(db = Depends(db_dep)):
    return db.execute(text("""
        SELECT c.id AS compra_id, c.fecha,
               DATE_ADD(c.fecha, INTERVAL COALESCE(c.dias_credito,0) DAY) AS fecha_limite,
               SUM(d.cantidad*d.costo_unitario_crc - COALESCE(d.descuento_crc,0)) AS total_crc,
               0 AS pagado_crc,
               SUM(d.cantidad*d.costo_unitario_crc - COALESCE(d.descuento_crc,0)) AS saldo_crc,
               DATEDIFF(CURDATE(), DATE_ADD(c.fecha, INTERVAL COALESCE(c.dias_credito,0) DAY)) AS dias_vencido
        FROM compra c
        LEFT JOIN compra_det d ON d.compra_id = c.id
        GROUP BY c.id
        ORDER BY c.fecha DESC
    """)).mappings().all()

@router.get("/config/indirectos")
def get_cfg(db = Depends(db_dep)):
    row = db.execute(text("SELECT method, pct FROM config_costeo LIMIT 1")).mappings().first()
    return row or {"method":"PORCENTAJE_GLOBAL", "pct": 0.0}

@router.put("/config/indirectos")
def set_cfg(payload: dict, db = Depends(db_dep)):
    method = payload.get("method") or "PORCENTAJE_GLOBAL"
    pct = float(payload.get("pct") or 0)
    db.execute(text("""
        INSERT INTO config_costeo (id, method, pct)
        VALUES (1, :method, :pct)
        ON DUPLICATE KEY UPDATE method=VALUES(method), pct=VALUES(pct)
    """), {"method": method, "pct": pct})
    db.commit()
    return {"ok": True}

@router.get("/indirectos")
def list_ind(db = Depends(db_dep)):
    return db.execute(text("SELECT id, nombre, monto_mensual_crc, activo FROM costo_indirecto ORDER BY id DESC")).mappings().all()

@router.post("/indirectos")
def add_ind(payload: dict, db = Depends(db_dep)):
    data = {
        "nombre": payload.get("nombre"),
        "monto_mensual_crc": payload.get("monto_mensual_crc"),
        "activo": 1 if str(payload.get("activo","1")) in ("1","true","True") else 0,
    }
    db.execute(text("""
        INSERT INTO costo_indirecto (nombre, monto_mensual_crc, activo)
        VALUES (:nombre, :monto_mensual_crc, :activo)
    """), data)
    db.commit()
    return {"ok": True}
