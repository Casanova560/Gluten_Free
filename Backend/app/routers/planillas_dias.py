import logging
from threading import Lock
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from ..db import engine
from ..utils.deps import db_dep

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/planillas/dias", tags=["planillas-dia"])

_TABLES_READY = False
_TABLES_LOCK = Lock()
_TABLE_DDL = [
    """
    CREATE TABLE IF NOT EXISTS planilla_dias (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      fecha DATE NOT NULL,
      nota VARCHAR(240),
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
    """,
    """
    CREATE TABLE IF NOT EXISTS planilla_lineas (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      planilla_dia_id BIGINT NOT NULL,
      empleado_id BIGINT NOT NULL,
      tarifa_base_crc DECIMAL(18,6) NOT NULL DEFAULT 0,
      horas DECIMAL(10,2) NOT NULL DEFAULT 0,
      horas_extra DECIMAL(10,2) NOT NULL DEFAULT 0,
      horas_doble DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_crc DECIMAL(18,6) NOT NULL DEFAULT 0,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_plin_dia FOREIGN KEY (planilla_dia_id) REFERENCES planilla_dias(id) ON DELETE CASCADE,
      CONSTRAINT fk_plin_emp FOREIGN KEY (empleado_id) REFERENCES empleado(id)
    ) ENGINE=InnoDB;
    """,
]
_INDEX_DDL = [
    "CREATE INDEX ix_plin_dia ON planilla_lineas(planilla_dia_id);",
    "CREATE INDEX ix_plin_emp ON planilla_lineas(empleado_id);",
]


def _ensure_tables_ready() -> None:
    global _TABLES_READY
    if _TABLES_READY:
        return
    with _TABLES_LOCK:
        if _TABLES_READY:
            return
        with engine.begin() as conn:
            for ddl in _TABLE_DDL:
                conn.execute(text(ddl))
            for ddl in _INDEX_DDL:
                try:
                    conn.execute(text(ddl))
                except Exception:
                    logger.debug("Skipping index creation for planilla_lineas", exc_info=True)
        _TABLES_READY = True


def _ensure_or_fail() -> None:
    try:
        _ensure_tables_ready()
    except Exception as exc:
        logger.exception("Planilla tables are not ready")
        raise HTTPException(
            status_code=500,
            detail="No se pudieron preparar las tablas de planilla. Revisa la configuracion de la base de datos.",
        ) from exc


def calc_total(tarifa: float, horas: float, he: float, hd: float) -> float:
    t = float(tarifa or 0)
    return t * float(horas or 0) + t * 1.5 * float(he or 0) + t * 1.5 * 2 * float(hd or 0)


@router.post("")
def crear_dia(payload: dict, db = Depends(db_dep)) -> Any:
    _ensure_or_fail()
    fecha = payload.get("fecha")
    if not fecha:
        raise HTTPException(status_code=400, detail="fecha requerida (YYYY-MM-DD)")
    nota = payload.get("nota")
    res = db.execute(
        text("INSERT INTO planilla_dias (fecha, nota) VALUES (:f, :n)"),
        {"f": fecha, "n": nota},
    )
    db.commit()
    return {"id": res.lastrowid, "fecha": fecha, "nota": nota}


@router.get("")
def listar_dias(db = Depends(db_dep)) -> List[dict]:
    _ensure_or_fail()
    q = text(
        """
        SELECT d.id, d.fecha, d.nota,
               COALESCE(SUM(l.total_crc), 0) AS total_crc,
               COUNT(l.id) AS lineas
        FROM planilla_dias d
        LEFT JOIN planilla_lineas l ON l.planilla_dia_id = d.id
        GROUP BY d.id
        ORDER BY d.fecha DESC, d.id DESC
        """
    )
    return [dict(row) for row in db.execute(q).mappings().all()]


@router.get("/{dia_id}")
def obtener_dia(dia_id: int, db = Depends(db_dep)) -> dict:
    _ensure_or_fail()
    d = db.execute(
        text("SELECT id, fecha, nota FROM planilla_dias WHERE id=:id"),
        {"id": dia_id},
    ).mappings().first()
    if not d:
        raise HTTPException(status_code=404, detail="Dia no encontrado")
    lineas = db.execute(
        text(
            """
            SELECT l.id, l.empleado_id, e.nombre AS empleado_nombre, l.tarifa_base_crc,
                   l.horas, l.horas_extra, l.horas_doble, l.total_crc
            FROM planilla_lineas l
            LEFT JOIN empleado e ON e.id = l.empleado_id
            WHERE l.planilla_dia_id = :id
            ORDER BY e.nombre
            """
        ),
        {"id": dia_id},
    ).mappings().all()
    return {**d, "lineas": list(lineas)}


@router.delete("/{dia_id}")
def eliminar_dia(dia_id: int, db = Depends(db_dep)) -> dict:
    _ensure_or_fail()
    res = db.execute(text("DELETE FROM planilla_dias WHERE id=:id"), {"id": dia_id})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Dia no encontrado")
    return {"ok": True}


@router.post("/{dia_id}/lineas")
def crear_linea(dia_id: int, payload: dict, db = Depends(db_dep)) -> dict:
    _ensure_or_fail()
    exists = db.execute(text("SELECT id FROM planilla_dias WHERE id=:id"), {"id": dia_id}).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Dia no encontrado")
    emp_id = payload.get("empleado_id")
    if not emp_id:
        raise HTTPException(status_code=400, detail="empleado_id requerido")
    tarifa = float(payload.get("tarifa_base_crc") or 0)
    h = float(payload.get("horas") or 0)
    he = float(payload.get("horas_extra") or 0)
    hd = float(payload.get("horas_doble") or 0)
    total = calc_total(tarifa, h, he, hd)
    res = db.execute(
        text(
            """
            INSERT INTO planilla_lineas (
                planilla_dia_id, empleado_id, tarifa_base_crc, horas, horas_extra, horas_doble, total_crc
            )
            VALUES (:d, :e, :t, :h, :he, :hd, :tot)
            """
        ),
        {"d": dia_id, "e": emp_id, "t": tarifa, "h": h, "he": he, "hd": hd, "tot": total},
    )
    db.commit()
    return {"id": res.lastrowid, "total_crc": total}


@router.put("/lineas/{linea_id}")
def actualizar_linea(linea_id: int, payload: dict, db = Depends(db_dep)) -> dict:
    _ensure_or_fail()
    row = db.execute(text("SELECT * FROM planilla_lineas WHERE id=:id"), {"id": linea_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Linea no encontrada")
    tarifa = float(payload.get("tarifa_base_crc") if payload.get("tarifa_base_crc") is not None else row["tarifa_base_crc"])
    h = float(payload.get("horas") if payload.get("horas") is not None else row["horas"])
    he = float(payload.get("horas_extra") if payload.get("horas_extra") is not None else row["horas_extra"])
    hd = float(payload.get("horas_doble") if payload.get("horas_doble") is not None else row["horas_doble"])
    total = calc_total(tarifa, h, he, hd)
    db.execute(
        text(
            """
            UPDATE planilla_lineas
            SET tarifa_base_crc=:t, horas=:h, horas_extra=:he, horas_doble=:hd, total_crc=:tot,
                empleado_id = COALESCE(:emp, empleado_id)
            WHERE id=:id
            """
        ),
        {
            "id": linea_id,
            "t": tarifa,
            "h": h,
            "he": he,
            "hd": hd,
            "tot": total,
            "emp": payload.get("empleado_id"),
        },
    )
    db.commit()
    return {"ok": True, "total_crc": total}


@router.delete("/lineas/{linea_id}")
def eliminar_linea(linea_id: int, db = Depends(db_dep)) -> dict:
    _ensure_or_fail()
    res = db.execute(text("DELETE FROM planilla_lineas WHERE id=:id"), {"id": linea_id})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Linea no encontrada")
    return {"ok": True}
