const express = require("express");
const usuarioRoute = express.Router();

const AsyncHandler = require("express-async-handler");
const User = require("");

// const generateToken = require("../tokenGenerate");
// const protect = require("../middleware/Auth");
const nodemailer = require('nodemailer')
const crypto = require('crypto')
const bcrypt = require('bcryptjs');


require('dotenv').config();


//login
usuarioRoute.post("/login",
  AsyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {

      req.session.user = {
        _id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      };

      
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
        createdAt: user.createdAt,
        redirectTo: '/api/users/profile'
      });
    } else {
      res.status(401);
      throw new Error("Invalid Email or Password");
    }
  })
);


//logout
usuarioRoute.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: "No se pudo cerrar la sesión" });
    }
    res.clearCookie('connect.sid');
    res.status(200).json({ message: "Logout exitoso" });
  });
});


//register route
usuarioRoute.post("/register",
  AsyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const existUser = await User.findOne({ email });
    if (existUser) {
      res.status(400);  
      throw new Error("User Already exist");
    } else {
      const user = await User.create({
        name,
        email,
        password,
      });

      //se agfega la sesion
      req.session.user = {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      };
      


      if (user) {
        res.status(201).json({
          _id: user._id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,

          token: generateToken(user._id), //se agrega token al register 

          createdAt: user.createdAt,
        });
      } else {
        res.status(400);
        throw new Error("Invalid User Data");
      }
    }
  })
);

//get auth profile data
usuarioRoute.get("/profile",protect,AsyncHandler(async (req, res) => {
   const user = await User.findById(req.user._id);
    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        password: user.password,
        isAdmin: user.isAdmin,
        last_name: user.last_name,
        createdAt: user.createdAt,
      });
    } else {
      res.status(404);
      throw new Error("USER NOT FOUND");
    }
  })
);

