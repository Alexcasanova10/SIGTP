const express = require("express");
const supervisorRoute = express.Router();
const AsyncHandler = require("express-async-handler");
const Usuario = require("../../models/Usuario");
const Rol = require("../../models/Rol");
const Estacion = require("../../models/Estacion");
const OrdenTrabajo = require("../../models/OrdenTrabajo");
const Pieza = require("../../models/Pieza"); 
const Movimiento = require("../../models/Movimiento");
const protect = require("../../middlewares/Auth");
const { sequelize } = require('../../models');
require('dotenv').config();




