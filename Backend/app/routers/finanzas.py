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
    # Compatibilidad: tabla config_costeo con columnas (metodo, parametro_json) {pct}
    row = db.execute(text("SELECT metodo, parametro_json FROM config_costeo WHERE id=1")).mappings().first()
    if not row:
        return {"method":"PORCENTAJE_GLOBAL", "pct": 0.0}
    metodo = row.get("metodo") or "PORCENTAJE_GLOBAL"
    pj = row.get("parametro_json") or {}
    try:
        pct = float((pj or {}).get("pct", 0))
    except Exception:
        pct = 0.0
    return {"method": metodo, "pct": pct}

@router.put("/config/indirectos")
def set_cfg(payload: dict, db = Depends(db_dep)):
    metodo = payload.get("method") or "PORCENTAJE_GLOBAL"
    pct = float(payload.get("pct") or 0)
    db.execute(text("""
        INSERT INTO config_costeo (id, metodo, parametro_json)
        VALUES (1, :metodo, JSON_OBJECT('pct', :pct))
        ON DUPLICATE KEY UPDATE metodo=VALUES(metodo), parametro_json=VALUES(parametro_json)
    """), {"metodo": metodo, "pct": pct})
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

# ---------------------------
# Gastos operativos
# ---------------------------
@router.get("/gastos")
def list_gastos(mes: str | None = None, db = Depends(db_dep)):
    base = """
      SELECT g.id, g.fecha, g.monto_crc, g.metodo_pago AS metodo, g.nota,
             g.proveedor_id, pr.nombre AS proveedor_nombre,
             g.categoria_id, cg.nombre AS categoria
      FROM gasto g
      LEFT JOIN proveedor pr ON pr.id = g.proveedor_id
      LEFT JOIN categoria_gasto cg ON cg.id = g.categoria_id
    """
    params = {}
    if mes:
        base += " WHERE DATE_FORMAT(g.fecha,'%Y-%m') = :mes"
        params["mes"] = mes
    base += " ORDER BY g.fecha DESC, g.id DESC"
    return db.execute(text(base), params).mappings().all()

@router.post("/gastos")
def add_gasto(payload: dict, db = Depends(db_dep)):
    fecha = payload.get("fecha")
    categoria = (payload.get("categoria") or "").strip()
    categoria_id = payload.get("categoria_id")
    proveedor_id = payload.get("proveedor_id")
    metodo = payload.get("metodo") or payload.get("metodo_pago") or 'EFECTIVO'
    nota = payload.get("nota")
    try:
        monto = float(payload.get("monto_crc") or 0)
    except Exception:
        monto = 0
    if not fecha or monto <= 0:
        return {"ok": False, "error": "fecha y monto > 0 requeridos"}
    # Resolver categoria_id por nombre si hace falta
    if not categoria_id and categoria:
        row = db.execute(text("SELECT id FROM categoria_gasto WHERE nombre=:n"), {"n": categoria}).scalar()
        if not row:
            res = db.execute(text("INSERT INTO categoria_gasto (nombre) VALUES (:n)"), {"n": categoria})
            db.commit()
            categoria_id = res.lastrowid
        else:
            categoria_id = row
    if not categoria_id:
        # fallback: crear 'General'
        row = db.execute(text("SELECT id FROM categoria_gasto WHERE nombre='General'" )).scalar()
        if not row:
            res = db.execute(text("INSERT INTO categoria_gasto (nombre) VALUES ('General')"))
            db.commit(); categoria_id = res.lastrowid
        else:
            categoria_id = row
    db.execute(text("""
        INSERT INTO gasto (fecha, categoria_id, monto_crc, proveedor_id, metodo_pago, nota)
        VALUES (:fecha, :categoria_id, :monto, :proveedor_id, :metodo, :nota)
    """), {"fecha": fecha, "categoria_id": categoria_id, "monto": monto, "proveedor_id": proveedor_id, "metodo": metodo, "nota": nota})
    db.commit()
    return {"ok": True}
