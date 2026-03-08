from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from email.message import EmailMessage
from config import settings
import random
import smtplib
import io

from scripts.data_generator import generar_datasets_en_memoria
from scripts.ia_analyst import analizar_datos_con_ia

router = APIRouter()

def enviar_reporte_email(destinatario: str, excel_bytes: bytes, csv_bytes: bytes, nombre_archivo: str, analisis_ia: str) -> None:
    """Envía el paquete de reportes con manejo de errores robusto."""
    try:
        msg = EmailMessage()
        msg['Subject'] = f"📊 Reporte de Simulación: {nombre_archivo}"
        msg['From'] = settings.email_user
        msg['To'] = destinatario
        
        cuerpo = (f"Hola {nombre_archivo},\n\n"
                  f"Se han procesado los datos industriales solicitados.\n\n"
                  f"--- RESUMEN DEL ANALISTA ---\n"
                  f"{analisis_ia}\n"
                  f"-----------------------------\n\n"
                  f"Adjunto encontrarás:\n"
                  f"1. Excel (.xlsx): Reporte limpio y formateado.\n"
                  f"2. CSV (.csv): Datos crudos con errores de simulación.\n\n"
                  f"Sistema de Monitoreo Industrial - La Pampa.")
        msg.set_content(cuerpo)

        msg.add_attachment(
            excel_bytes,
            maintype='application',
            subtype='vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename=f"{nombre_archivo}_REPORTE_LIMPIO.xlsx"
        )

        msg.add_attachment(
            csv_bytes,
            maintype='text',
            subtype='csv',
            filename=f"{nombre_archivo}_DATOS_CRUDOS.csv"
        )

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(settings.email_user, settings.email_pass)
            smtp.send_message(msg)
            print(f"✅ Email enviado a {destinatario}")
            
    except Exception as e:
        print(f"❌ Error en despacho de email: {str(e)}")


SENSORES_CONFIG = [
    {"id": "TEMP_TANQUE_1", "label": "Temperatura Tanque Nafta", "unit": "°C", "base": 18.0, "var": 2.0, "limit": 25.0},
    {"id": "PRESION_SURT_A", "label": "Presión Surtidor A", "unit": "bar", "base": 4.2, "var": 0.5, "limit": 5.5},
    {"id": "NIVEL_SUBT_1", "label": "Stock Tanque Gasoil", "unit": "%", "base": 65.0, "var": 0.2, "limit": 15.0}, # Alerta si baja
    {"id": "VOLTAJE_SIST", "label": "Tensión UPS Control", "unit": "V", "base": 224.0, "var": 5.0, "limit": 210.0},
]

@router.get("/telemetria")
async def get_telemetria():
    """
    Simula la lectura de sensores industriales en tiempo real.
    Genera variaciones aleatorias sobre valores base.
    """
    try:
        lecturas = []
        for s in SENSORES_CONFIG:
            # Simulamos una pequeña variación (ruido)
            valor_actual = round(s["base"] + (random.uniform(-1, 1) * s["var"]), 2)
            
            # Lógica de estado simple
            estado = "NOMINAL"
            if s["id"] == "NIVEL_SUBT_1": # Para el stock, alertamos si es BAJO
                if valor_actual < s["limit"]: estado = "ALERT"
                elif valor_actual < s["limit"] + 10: estado = "WARNING"
            else: # Para el resto, alertamos si es ALTO (sobrepresión/calor)
                if valor_actual > s["limit"]: estado = "ALERT"
                elif valor_actual > s["limit"] - (s["var"] * 0.5): estado = "WARNING"

            lecturas.append({
                "sensor": s["label"], # Usamos el label amigable que definimos
                "valor": valor_actual,
                "unidad": s["unit"],
                "estado": estado
            })
        
        return lecturas
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo sensores: {str(e)}")

@router.post("/generar-y-despachar")
async def generar_y_despachar(
    email: str, 
    nombre: str, 
    filas: int = Query(default=500, ge=100, le=1000),
    background_tasks: BackgroundTasks = None
):
    try:
        csv_buffer, excel_buffer, muestra = generar_datasets_en_memoria(filas)
        
        csv_data = csv_buffer.getvalue()
        excel_data = excel_buffer.getvalue()

        analisis = analizar_datos_con_ia(muestra)

        if background_tasks:
            background_tasks.add_task(
                enviar_reporte_email, 
                email, 
                excel_data, 
                csv_data, 
                nombre, 
                analisis
            )

        return StreamingResponse(
            io.BytesIO(csv_data),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={nombre}_sucio.csv"}
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo en pipeline industrial: {str(e)}")