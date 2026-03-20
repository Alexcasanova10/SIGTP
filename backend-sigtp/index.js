const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const path = require("path");
const userAgent = require("express-useragent");
const { sequelize } = require('./src/models'); // Importar modelos

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
    origin: process.env.FRONTEND_URL || "*", 
    credentials: true
}));

app.use(userAgent.express());

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-key-default',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

// Middleware para poner los modelos en el objeto req
app.use((req, res, next) => {
    req.models = require('./src/models');
    next();
});

// Rutas (aquí importarás tus rutas después)
app.get('/', (req, res) => {
    res.send("Hola mundo SIGTP - Servidor Express funcionando");
});

// Ruta para probar la conexión a la BD
app.get('/api/test-db', async (req, res) => {
    try {
        await sequelize.authenticate();
        res.json({ 
            success: true, 
            message: 'Conexión a la base de datos establecida correctamente' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error al conectar con la base de datos',
            error: error.message 
        });
    }
});



//Importar rutas
const sesionUsuarioRoute = require("./src/routes/SesionUsuario/apis-sesion")

// RUTAS DE EJEMPLO
const protectedRoute = require("./src/routes/SesionUsuario/protegidasRoutes")

// const calidadRoute = require("./routes/Usuarios/apis-calidad.js")
// const operadorRoute = require("./routes/Usuarios/apis-operador.js")
// const supervisorRoute = require("./routes/Usuarios/apis-supervisor.js")


//Route SesionesUsuario
app.use("/api/sesiones",sesionUsuarioRoute)

//Route protegidas EJEMPLO
app.use("/api/protegidas",protectedRoute)

/*
//Route calidad
app.use("/api/calidad",calidadRoute)

//Route operador
app.use("/api/operador",operadorRoute)

//Route supervisor
app.use("/api/supervisor",supervisorRoute)


const gerenteRoute = require("./routes/Usuarios/gerente-apis-.js")
const ingRoute = require("./routes/Usuarios/apis-ing-procesos.js")
const tecnicoRoute = require("./routes/Usuarios/apis-tecnico.js")


//Route gerente
app.use("/api/usuarios",gerenteRoute)

//Route ing
app.use("/api/ing",ingRoute)


//Route tecnico
app.use("/api/tecnico",tecnicoRoute)
*/

// Middleware para rutas no encontradas
app.use((req, res, next) => {
    res.status(404).json({ "message": "Página no encontrada" });
});

// Iniciar servidor y probar conexión a BD
app.listen(PORT, async () => {
    console.log(`=================================`);
    console.log(`Servidor corriendo en: http://localhost:${PORT}`);
    
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a MySQL establecida correctamente');
        console.log('📦 Modelos cargados y listos para usar');
    } catch (error) {
        console.error('❌ Error al conectar a MySQL:', error.message);
    }
    
    console.log(`=================================`);
});