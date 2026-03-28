const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME || 'sistema_smt',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false, // Cambia a true si quieres ver las consultas SQL
        define: {
            timestamps: false, // Desactivamos timestamps automáticos
            underscored: true, // Usar snake_case para campos
            freezeTableName: true // No pluralizar nombres de tablas
        }
    }
);

module.exports = sequelize;