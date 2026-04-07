const express = require("express");
const router = express.Router();
const AsyncHandler = require("express-async-handler");
const fs = require("fs");
const path = require("path");

const { sequelize, FallaTecnica, Evidencia } = require("../../models");

// Equivalente JS de insertarReportes.php
// POST /api/movil/insertar-reportes
router.post("/insertar-reportes", AsyncHandler(async (req, res) => {
    const desc       = typeof req.body.descripcion === "string" ? req.body.descripcion : "Sin descripción";
    const prioridad  = typeof req.body.prioridad === "string" ? req.body.prioridad : "Media";
    const orden_txt  = typeof req.body.orden === "string" ? req.body.orden : "N/A";
    const linea_txt  = typeof req.body.linea === "string" ? req.body.linea : "N/A";
    const tipo_falla = typeof req.body.tipo_falla === "string" ? req.body.tipo_falla : "General";
    const imagen64   = typeof req.body.imagen === "string" ? req.body.imagen : "";

    const descripcion_final = `[${tipo_falla}] [Línea: ${linea_txt}] [Orden: ${orden_txt}] - ${desc}`;

    const transaction = await sequelize.transaction();

    try {
        // 1) Insertar en fallas_tecnicas (pieza_id y orden_id en NULL, registrado_por = 1 como en PHP)
        const falla = await FallaTecnica.create({
            pieza_id: null,
            orden_id: null,
            descripcion: descripcion_final,
            prioridad,
            registrado_por: 1
        }, { transaction });

        const idFalla = falla.id;

        // 2) Manejo de imagen base64, si viene
        if (imagen64 && imagen64.trim() !== "") {
            // Quitar posible prefijo data:image/...;base64,
            const base64Data = imagen64.includes(",") ? imagen64.split(",").pop() : imagen64;

            const imgData = Buffer.from(base64Data, "base64");
            const nombre_archivo = `evidencia_${Date.now()}_falla${idFalla}.jpg`;

            // Ruta física donde se guardará la imagen
            const uploadsDir = path.join(__dirname, "../../../uploads");
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const rutaFisica = path.join(uploadsDir, nombre_archivo);
            const rutaRelativa = path.posix.join("uploads", nombre_archivo); // lo que se guarda en BD

            // Guardar archivo en disco
            fs.writeFileSync(rutaFisica, imgData);

            // Insertar evidencia asociada
            await Evidencia.create({
                falla_id: idFalla,
                url_imagen: rutaRelativa
            }, { transaction });
        }

        await transaction.commit();

        return res.json({
            status: "success",
            message: "Reporte guardado correctamente"
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        console.error("Error insertarReportes:", error);
        return res.status(500).json({
            status: "error",
            message: error.message
        });
    }
}));

module.exports = router;
