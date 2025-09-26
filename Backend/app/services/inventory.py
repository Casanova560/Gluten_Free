from sqlalchemy import text
from sqlalchemy.orm import Session

def insert_inv_mov(
    db: Session, *, fecha, producto_id, uom_id, tipo, cantidad,
    motivo, ref_tabla=None, ref_id=None, ubicacion_id=None, nota=None
):
    q = text("""
        INSERT INTO inv_mov (fecha,producto_id,uom_id,tipo,cantidad,motivo,ref_tabla,ref_id,ubicacion_id,nota)
        VALUES (:fecha,:producto_id,:uom_id,:tipo,:cantidad,:motivo,:ref_tabla,:ref_id,:ubicacion_id,:nota)
    """)
    db.execute(q, dict(
        fecha=fecha, producto_id=producto_id, uom_id=uom_id, tipo=tipo, cantidad=cantidad,
        motivo=motivo, ref_tabla=ref_tabla, ref_id=ref_id, ubicacion_id=ubicacion_id, nota=nota
    ))
