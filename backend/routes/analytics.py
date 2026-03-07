from fastapi import APIRouter, HTTPException
import sqlite3
import os

router = APIRouter()
DB_PATH = "data/surtidores.db"

@router.get("/comparativa-norte-pampeano")
async def comparativa_ciudades(producto: str = "NAFTA SUPER"):
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=404, detail="DB no encontrada")

    conn: Connection = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor: Cursor = conn.cursor()
    query = """
    WITH PreciosPromedio AS (
        SELECT 
            fecha,
            localidad,
            AVG(precio) as precio_promedio
        FROM precios_historicos
        WHERE localidad IN ('REALICO', 'GENERAL PICO') 
          AND producto LIKE ?
        GROUP BY fecha, localidad
    )
    SELECT 
        fecha,
        localidad,
        ROUND(precio_promedio, 2) as precio,
        ROUND(
            precio_promedio - LAG(precio_promedio) OVER (PARTITION BY localidad ORDER BY fecha), 
            2
        ) as aumento_nominal,
        ROUND(
            ((precio_promedio - LAG(precio_promedio) OVER (PARTITION BY localidad ORDER BY fecha)) / 
            LAG(precio_promedio) OVER (PARTITION BY localidad ORDER BY fecha)) * 100, 
            2
        ) as aumento_porcentual
    FROM PreciosPromedio
    ORDER BY fecha DESC, localidad ASC
    """
    
    try:
        cursor.execute(query, (f"%{producto.upper()}%",))
        rows: list[Any] = cursor.fetchall()
        
        resultado = [dict(row) for row in rows]
        return {
            "producto": producto.upper(),
            "metricas": resultado,
            "count": len(resultado)
        }
    finally:
        conn.close()