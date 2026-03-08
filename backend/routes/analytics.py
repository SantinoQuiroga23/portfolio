from fastapi import APIRouter, HTTPException
import sqlite3
import os
import httpx

router = APIRouter()

# Configuración de rutas
DB_PATH = "data/surtidores.db"
DB_REMOTE_URL = "https://raw.githubusercontent.com/SantinoQuiroga23/portfolio/backend/data/surtidores.db"

async def descargar_db_si_no_existe():
    """Descarga la DB desde GitHub si no está presente en el servidor"""
    if not os.path.exists(DB_PATH):
        print("📥 DB no encontrada localmente. Descargando desde GitHub...")
        os.makedirs("data", exist_ok=True)
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(DB_REMOTE_URL)
                if response.status_code == 200:
                    with open(DB_PATH, "wb") as f:
                        f.write(response.content)
                    print("✅ DB descargada exitosamente.")
                else:
                    print(f"❌ Error al descargar: {response.status_code}")
            except Exception as e:
                print(f"❌ Falló la conexión con GitHub: {e}")

@router.get("/comparativa-norte-pampeano")
async def comparativa_ciudades(producto: str = "NAFTA SUPER"):
    if not os.path.exists(DB_PATH):
        await descargar_db_si_no_existe()
    
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=503, detail="Base de datos no disponible momentáneamente")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = """
    WITH DatosLimpios AS (
        SELECT 
            fecha,
            TRIM(UPPER(localidad)) as localidad_norm,
            AVG(precio) as precio_diario
        FROM precios_historicos
        WHERE localidad_norm IN ('REALICO', 'GENERAL PICO') 
        AND UPPER(producto) LIKE UPPER(?)
        GROUP BY fecha, localidad_norm
    ),
    Calculos AS (
        SELECT 
            fecha,
            localidad_norm as localidad,
            ROUND(precio_diario, 2) as precio,
            LAG(precio_diario) OVER (
                PARTITION BY localidad_norm 
                ORDER BY fecha ASC
            ) as precio_anterior
        FROM DatosLimpios
    )
    SELECT 
        fecha,
        localidad,
        precio,
        COALESCE(ROUND(precio - precio_anterior, 2), 0) as aumento_nominal,
        COALESCE(ROUND(((precio - precio_anterior) / precio_anterior) * 100, 2), 0) as aumento_porcentual
    FROM Calculos
    ORDER BY fecha DESC, localidad ASC
    """
    
    try:
        cursor.execute(query, (f"%{producto}%",))
        rows = cursor.fetchall()
        metricas = [dict(row) for row in rows]
        
        return {
            "query_info": {
                "producto_buscado": producto,
                "total_registros": len(metricas),
                "localidades_incluidas": ["REALICO", "GENERAL PICO"]
            },
            "metricas": metricas
        }
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")
    finally:
        conn.close()