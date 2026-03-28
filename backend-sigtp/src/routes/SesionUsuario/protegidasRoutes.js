const express = require('express');
const protectedRoute = express.Router();
const { verificarAutenticacion, verificarRol, verificarRolId } = require('../../middlewares/authMiddleware');

// Ruta para perfil de usuario (cualquier usuario autenticado)
protectedRoute.get('/perfil', 
    verificarAutenticacion,
    (req, res) => {
        res.json({
            success: true,
            data: req.usuario
        });
    }
);

// Ruta solo para técnicos (por nombre de rol)
protectedRoute.get('/ruta-tecnico',
    verificarAutenticacion,
    verificarRol(['Técnico']),
    (req, res) => {
        res.json({
            success: true,
            message: "Bienvenido Técnico",
            data: req.usuario
        });
    }
);

// Ruta solo para calidad y supervisor (por ID de rol)
protectedRoute.get('/ruta-calidad-supervisor',
    verificarAutenticacion,
    verificarRolId([2, 3]), // 2: Calidad, 3: Supervisor
    (req, res) => {
        res.json({
            success: true,
            message: "Bienvenido Calidad o Supervisor",
            data: req.usuario
        });
    }
);

// Ruta solo para gerente
protectedRoute.get('/ruta-gerente',
    verificarAutenticacion,
    verificarRolId([6]), // 6: Gerente
    (req, res) => {
        res.json({
            success: true,
            message: "Bienvenido Gerente",
            data: req.usuario
        });
    }
);

module.exports = protectedRoute;