const express = require("express");
const router = express.Router();
const AsyncHandler = require("express-async-handler");
const { QueryTypes } = require("sequelize");

const { sequelize } = require("../../models");

// Equivalente JS de getOpcionesReporte.php
// GET /api/movil/get-opciones-reporte
router.get("/get-opciones-reporte", AsyncHandler(async (req, res) => {
    const respuesta = {
        ordenes: ["Seleccione Orden..."],
        lineas: ["Seleccione Línea..."]
    };

    try {
        // Ordenes
        const ordenes = await sequelize.query(
            "SELECT numero_orden FROM ordenes_trabajo",
            { type: QueryTypes.SELECT }
        );

        ordenes.forEach(row => {
            if (row.numero_orden) {
                respuesta.ordenes.push(row.numero_orden);
            }
        });

        // Líneas (estaciones)
        const lineas = await sequelize.query(
            "SELECT nombre FROM estaciones",
            { type: QueryTypes.SELECT }
        );

        lineas.forEach(row => {
            if (row.nombre) {
                respuesta.lineas.push(row.nombre);
            }
        });

        return res.json(respuesta);
    } catch (error) {
        console.error("Error getOpcionesReporte:", error);
        return res.status(500).json({ error: true, mensaje: error.message });
    }
}));

module.exports = router;
