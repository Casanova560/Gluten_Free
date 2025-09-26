# app/routers/costeo.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter()

def _normalize_pct(p):
    if p is None: return None
    # 0.18 o 18 -> 0.18
    return p/100.0 if p > 1 else p

@router.get("/recetas/{receta_id}")
def costeo_receta(
    receta_id: int,
    rendimiento: float | None = Query(None, description="Si se pasa, divide costo_total por este rendimiento"),
    porcentaje_indirecto: float | None = Query(None, description="Override: porcentaje sobre costo directo (0.18 = 18% ó 18)")
    , db: Session = Depends(db_dep)
):
    row = db.execute(text("""
        SELECT r.receta_id, r.receta_nombre, r.costo_directo_crc,
               r.costo_indirecto_asignado_crc, r.costo_total_crc
        FROM v_costo_receta_total r
        WHERE r.receta_id = :rid
    """), {"rid": receta_id}).mappings().first()

    if not row:
        return {
            "receta_id": receta_id,
            "receta_nombre": None,
            "rendimiento_total": 0,
            "costo_directo_crc": 0,
            "costo_indirecto_asignado_crc": 0,
            "costo_total_crc": 0,
            "unitario_crc": None,
            "ingredientes": []
        }

    # rendimiento
    rend_row = db.execute(text("""
        SELECT rendimiento_total FROM v_receta_rendimiento WHERE receta_id = :rid
    """), {"rid": receta_id}).first()
    rend = rendimiento if rendimiento is not None else (rend_row[0] if rend_row else 0)

    # override porcentaje indirecto
    p = _normalize_pct(porcentaje_indirecto) if porcentaje_indirecto is not None else None
    costo_dir = float(row["costo_directo_crc"] or 0)
    if p is not None:
        costo_ind = costo_dir * p
        costo_tot = costo_dir + costo_ind
    else:
        costo_ind = float(row["costo_indirecto_asignado_crc"] or 0)
        costo_tot = float(row["costo_total_crc"] or (costo_dir + costo_ind))

    unitario = (costo_tot / rend) if rend and rend > 0 else None

    det = db.execute(text("""
        SELECT rd.producto_id, p.nombre, rd.uom_id, rd.cantidad,
               COALESCE(mp.costo_prom_crc,0) AS costo_unitario_crc,
               (rd.cantidad * COALESCE(mp.costo_prom_crc,0)) AS costo_total_crc
        FROM receta_det rd
        JOIN producto p ON p.id = rd.producto_id
        LEFT JOIN v_mp_costo_promedio mp ON mp.producto_id = rd.producto_id
        WHERE rd.receta_id = :rid
        ORDER BY rd.id
    """), {"rid": receta_id}).mappings().all()

    return {
        "receta_id": row["receta_id"],
        "receta_nombre": row["receta_nombre"],
        "rendimiento_total": float(rend or 0),
        "costo_directo_crc": float(costo_dir),
        "costo_indirecto_asignado_crc": float(costo_ind),
        "costo_total_crc": float(costo_tot),
        "unitario_crc": (float(unitario) if unitario is not None else None),
        "ingredientes": [dict(x) for x in det]
    }

@router.get("/tandas/{tanda_id}")
def costeo_tanda(
    tanda_id: int,
    porcentaje_indirecto: float | None = Query(None, description="Override: porcentaje sobre costo directo (0.18 = 18% ó 18)"),
    db: Session = Depends(db_dep)
):
    row = db.execute(text("""
        SELECT tanda_id, fecha, costo_directo_crc, costo_indirecto_crc, costo_total_crc
        FROM v_costo_tanda
        WHERE tanda_id = :tid
    """), {"tid": tanda_id}).mappings().first()

    if not row:
        return {
            "tanda_id": tanda_id,
            "fecha": None,
            "costo_directo_crc": 0,
            "costo_indirecto_crc": 0,
            "costo_total_crc": 0,
            "unitario_crc": None,
            "consumos": [],
            "unidades_producidas": 0
        }

    units = db.execute(text("""
        SELECT COALESCE(SUM(ts.cantidad),0) FROM tanda_salida ts WHERE ts.tanda_id = :tid
    """), {"tid": tanda_id}).scalar() or 0

    costo_dir = float(row["costo_directo_crc"] or 0)
    p = _normalize_pct(porcentaje_indirecto) if porcentaje_indirecto is not None else None
    if p is not None:
        costo_ind = costo_dir * p
        costo_tot = costo_dir + costo_ind
    else:
        costo_ind = float(row["costo_indirecto_crc"] or 0)
        costo_tot = float(row["costo_total_crc"] or (costo_dir + costo_ind))

    unit = (costo_tot / units) if units > 0 else None

    det = db.execute(text("""
        SELECT tc.producto_id, p.nombre, tc.uom_id, tc.cantidad,
               COALESCE(mp.costo_prom_crc,0) AS costo_unitario_crc,
               (tc.cantidad * COALESCE(mp.costo_prom_crc,0)) AS costo_total_crc
        FROM tanda_consumo tc
        JOIN producto p ON p.id = tc.producto_id
        LEFT JOIN v_mp_costo_promedio mp ON mp.producto_id = tc.producto_id
        WHERE tc.tanda_id = :tid
        ORDER BY tc.id
    """), {"tid": tanda_id}).mappings().all()

    return {
        "tanda_id": tanda_id,
        "fecha": row["fecha"],
        "costo_directo_crc": float(costo_dir),
        "costo_indirecto_crc": float(costo_ind),
        "costo_total_crc": float(costo_tot),
        "unitario_crc": (float(unit) if unit is not None else None),
        "consumos": [dict(x) for x in det],
        "unidades_producidas": float(units)
    }
