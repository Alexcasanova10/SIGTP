const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Rol = sequelize.define('roles', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.STRING(150),
        allowNull: true
    }
}, {
    tableName: 'roles'
});

module.exports = Rol;