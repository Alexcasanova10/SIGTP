const express = require("express");
const router = express.Router();
const AsyncHandler = require("express-async-handler");
const crypto = require("crypto");

const Usuario = require("../../models/Usuario");

// Equivalente JS de loginMovil.php
// POST /api/movil/login-movil
router.post("/login-movil", AsyncHandler(async (req, res) => {
    const user = typeof req.body.user === "string" ? req.body.user.trim() : "";
    const pass = typeof req.body.pass === "string" ? req.body.pass.trim() : "";

    if (!user || !pass) {
        return res.json({ status: "error", message: "Campos vacios" });
    }

    // Replicar lógica PHP: password MD5
    const passEncriptada = crypto.createHash("md5").update(pass).digest("hex");

    try {
        const registro = await Usuario.findOne({
            where: {
                numero_empleado: user,
                password: passEncriptada,
                activo: true
            },
            attributes: ["nombre", "rol_id"]
        });

        if (!registro) {
            return res.json({ status: "error", message: "Usuario o clave incorrectos" });
        }

        return res.json({
            status: "success",
            nombre: registro.nombre,
            rol_id: Number(registro.rol_id)
        });
    } catch (error) {
        console.error("Error en loginMovil:", error);
        return res.status(500).json({
            status: "error",
            message: "Error interno del servidor"
        });
    }
}));

module.exports = router;
