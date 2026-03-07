# 🚀 Industrial Data Pipeline & Analytics - La Pampa

Este proyecto es un ecosistema de backend robusto diseñado para la gestión, simulación y análisis de datos industriales (precios de combustibles) utilizando **FastAPI**, **Polars** e **IA Generativa**.

## 🏗️ Arquitectura de Software

El sistema está construido bajo una arquitectura **Stateless** (sin estado persistente en disco para archivos temporales), lo que permite una escalabilidad horizontal óptima.

### Características Principales:
- **ETL Industrial**: Procesamiento de grandes volúmenes de datos con `Polars` (más rápido que Pandas) manejando buffers en RAM (`io.BytesIO`).
- **IA Integrada**: Resúmenes ejecutivos automáticos generados mediante el modelo **Mistral-7B** (Hugging Face API).
- **Reportes Duales**: Generación simultánea de un CSV "sucio" (simulación de entrada) y un Excel profesional formateado con `XlsxWriter`.
- **Seguridad y Control**: 
  - Validación estricta de entorno con `Pydantic Settings`.
  - Rate Limiting por IP para proteger la cuota de la API de IA.
  - Middleware de monitoreo de performance (latencia en ms).



## 🛠️ Stack Tecnológico

- **Lenguaje:** Python 3.14 (Bleeding Edge)
- **Framework:** FastAPI
- **Base de Datos:** SQLite (Optimizado con Window Functions para Analytics)
- **IA:** Hugging Face Serverless Inference (Mistral)
- **Validación:** Pydantic v2
- **Testing:** Pytest + HTTPX (Async testing)

## 🚀 Instalación y Uso

1. **Clonar el repositorio:**
   ```bash
   git clone [https://github.com/tu-usuario/portfolio-industrial.git](https://github.com/tu-usuario/portfolio-industrial.git)
   cd portfolio-industrial/backend