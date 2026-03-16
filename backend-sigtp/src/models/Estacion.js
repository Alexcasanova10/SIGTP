const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Estacion = sequelize.define('estaciones', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'estaciones',
    timestamps: false
});

module.exports = Estacion;