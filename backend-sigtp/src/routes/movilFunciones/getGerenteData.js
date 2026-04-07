const express = require("express");
const router = express.Router();
const AsyncHandler = require("express-async-handler");
const { QueryTypes } = require("sequelize");

const { sequelize } = require("../../models");

// Equivalente JS de getGerenteData.php
// GET /api/movil/get-gerente-data
router.get("/get-gerente-data", AsyncHandler(async (req, res) => {
    try {
        const response = {};

        // META DEL DÍA
        const sqlMeta = `
            SELECT SUM(cantidad_planeada) AS meta_total
            FROM ordenes_trabajo
            WHERE DATE(fecha_inicio) = CURDATE()
              AND estatus != 'Finalizada'
        `;

        const [metaRow] = await sequelize.query(sqlMeta, { type: QueryTypes.SELECT });
        response.meta_del_dia = metaRow && metaRow.meta_total != null
            ? Number(metaRow.meta_total)
            : 0;

        // SCRAP TOTAL DEL DÍA
        const sqlScrap = `
            SELECT COUNT(DISTINCT m.pieza_id) AS total_scrap
            FROM movimientos m
            INNER JOIN piezas p ON m.pieza_id = p.id
            INNER JOIN ordenes_trabajo o ON p.orden_id = o.id
            WHERE m.estatus_nuevo = 'Scrap'
              AND DATE(m.fecha) = CURDATE()
        `;

        const [scrapRow] = await sequelize.query(sqlScrap, { type: QueryTypes.SELECT });
        response.scrap_total = scrapRow && scrapRow.total_scrap != null
            ? Number(scrapRow.total_scrap)
            : 0;

        // PRODUCCIÓN HORARIA
        const sqlHora = `
            SELECT 
                DATE_FORMAT(m.fecha, '%H:00') AS hora,
                SUM(CASE WHEN UPPER(p.serial) LIKE 'TYT%' THEN 1 ELSE 0 END) AS piezas_toyota,
                SUM(CASE WHEN UPPER(p.serial) LIKE 'KIA%' THEN 1 ELSE 0 END) AS piezas_kia,
                COUNT(DISTINCT m.pieza_id) AS total_piezas
            FROM movimientos m
            JOIN piezas p ON m.pieza_id = p.id
            JOIN ordenes_trabajo o ON p.orden_id = o.id
            WHERE m.estatus_nuevo = 'OK'
              AND m.fecha >= CURDATE()
            GROUP BY hora
            ORDER BY hora ASC
        `;

        const filasProduccion = await sequelize.query(sqlHora, { type: QueryTypes.SELECT });

        response.produccion_horaria = filasProduccion.map(row => ({
            hora: row.hora,
            toyota: Number(row.piezas_toyota || 0),
            kia: Number(row.piezas_kia || 0),
            total: Number(row.total_piezas || 0)
        }));

        return res.json(response);
    } catch (error) {
        console.error("Error getGerenteData:", error);
        return res.status(500).json({ error: true, mensaje: error.message });
    }
}));

module.exports = router;
