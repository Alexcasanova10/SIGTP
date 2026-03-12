const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const path = require("path");
const userAgent = require("express-useragent");
// const csrf = require('csurf'); // Descomenta si lo vas a usar

dotenv.config();

const app = express();
// IMPORTANTE: Asignar un valor por defecto si process.env.PORT no existe
const PORT = process.env.PORT || 3000; 

// Conexión a BD (la tienes pendiente)

// Middlewares
app.use(express.json()); // Descomenta esto para poder recibir JSON
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configuración CORS - si FRONTEND_URL no está definida, usa *
app.use(cors({
    origin: process.env.FRONTEND_URL || "*", 
    credentials: true
}));

app.use(userAgent.express());

// Configuración de sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-key-default',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000 //30 días
    }
}));

// Rutas
app.get('/', (req, res) => {
    res.send("Hola mundo SIGTP - Servidor Express funcionando");
});

// Middleware para rutas no encontradas (404)
app.use((req, res, next) => {
    res.status(404).json({ "message": "Página no encontrada" });
});

app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`Para probar, abre: http://localhost:${PORT}/`);
    console.log(`=================================`);
});