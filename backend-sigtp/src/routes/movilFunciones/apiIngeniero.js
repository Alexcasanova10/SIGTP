const express = require("express");
const router = express.Router();
const AsyncHandler = require("express-async-handler");
const { QueryTypes } = require("sequelize");

const { sequelize } = require("../../models");
const Pieza = require("../../models/Pieza");
const Movimiento = require("../../models/Movimiento");

// Equivalente JS de apiIngeniero.php
// Endpoint único: POST /api/movil/api-ingeniero  con body { accion: "...", ... }
router.post("/api-ingeniero", AsyncHandler(async (req, res) => {
    const accion = req.body.accion || "";

    switch (accion) {
        case "obtener_fallas": {
            // Consulta directa para replicar el SQL original (incluye DATE_FORMAT)
            const sql = `
                SELECT 
                    f.id, 
                    f.descripcion, 
                    f.prioridad, 
                    f.estatus_falla, 
                    DATE_FORMAT(f.fecha, '%d/%m %H:%i') AS hora,
                    e.url_imagen AS imagen
                FROM fallas_tecnicas f
                LEFT JOIN evidencias e ON f.id = e.falla_id
                WHERE f.estatus_falla != 'Cerrada'
                ORDER BY f.fecha DESC
            `;

            try {
                const datos = await sequelize.query(sql, { type: QueryTypes.SELECT });
                return res.json({ exito: true, datos });
            } catch (error) {
                console.error("Error obtener_fallas:", error);
                return res.json({ exito: false, error: error.message });
            }
        }

        case "obtener_retrabajos": {
            const sql = `
                SELECT 
                    p.id,
                    o.proyecto AS linea,
                    IFNULL(i.descripcion_falla, CONCAT('Pieza: ', p.serial)) AS retrabajo,
                    '' AS imagen
                FROM piezas p
                INNER JOIN ordenes_trabajo o ON p.orden_id = o.id
                LEFT JOIN inspecciones_calidad i ON p.id = i.pieza_id
                WHERE p.estatus = 'Retrabajo'
                ORDER BY p.fecha_registro DESC
            `;

            try {
                const datos = await sequelize.query(sql, { type: QueryTypes.SELECT });
                return res.json({ exito: true, datos });
            } catch (error) {
                console.error("Error obtener_retrabajos:", error);
                return res.json({ exito: false, error: error.message });
            }
        }

        case "validar_retrabajo": {
            const id = req.body.id_retrabajo || "";
            const estado = req.body.estado || ""; // 'Aceptado', 'Autorizado', etc.

            if (!id || !estado) {
                return res.json({ exito: false, error: "Faltan parámetros" });
            }

            const nuevoEstatus = (estado === "Aceptado" || estado === "Autorizado") ? "OK" : "Scrap";

            const transaction = await sequelize.transaction();
            try {
                // 1) Actualizar pieza
                const pieza = await Pieza.findByPk(id, { transaction });
                if (!pieza) {
                    await transaction.rollback();
                    return res.json({ exito: false, error: "Pieza no encontrada" });
                }

                const estatusAnterior = pieza.estatus;

                await pieza.update({ estatus: nuevoEstatus }, { transaction });

                // 2) Registrar movimiento
                await Movimiento.create({
                    pieza_id: id,
                    estatus_anterior: "Retrabajo", // según el PHP original
                    estatus_nuevo: nuevoEstatus,
                    fecha: new Date()
                }, { transaction });

                await transaction.commit();
                return res.json({ exito: true });
            } catch (error) {
                if (transaction && !transaction.finished) {
                    await transaction.rollback();
                }
                console.error("Error validar_retrabajo:", error);
                return res.json({ exito: false, error: error.message });
            }
        }

        case "actualizar_falla": {
            const id = req.body.id_falla || "";
            const estado = req.body.estado || "";

            if (!id || !estado) {
                return res.json({ exito: false, error: "Faltan parámetros" });
            }

            try {
                const [filasAfectadas] = await sequelize.query(
                    "UPDATE fallas_tecnicas SET estatus_falla = :estado WHERE id = :id",
                    {
                        replacements: { estado, id },
                        type: QueryTypes.UPDATE
                    }
                );

                if (filasAfectadas === 0) {
                    return res.json({ exito: false, error: "Falla técnica no encontrada" });
                }

                return res.json({ exito: true });
            } catch (error) {
                console.error("Error actualizar_falla:", error);
                return res.json({ exito: false, error: error.message });
            }
        }

        default:
            return res.json({ exito: false, error: "Accion no reconocida" });
    }
}));

module.exports = router;
