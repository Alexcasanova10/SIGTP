// module.exports = protect;
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const  Usuario = require("../models/Usuario");
const  Rol = require("../models/Rol");

const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Prioridad 1: Token de los headers de autorización
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } 
  // Prioridad 2: Token de la sesión de Google
  else if (req.session.token) {
    token = req.session.token;
  }

  if (token) {
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decodedToken.id).select("-password");
      return next();
    } catch (err) {
      console.error("Error de token:", err);
      res.status(401).json({ message: "No estás autorizado" });
    }
  } else {
    res.status(401).json({ message: "No estás autorizado, falta token" });
  }
});

module.exports = protect;
