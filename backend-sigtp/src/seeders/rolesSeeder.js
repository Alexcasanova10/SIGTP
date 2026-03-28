const { Rol } = require('../models');

const rolesData = [
    {
        id: 1,
        nombre: 'Operador',
        descripcion: 'Acceso producción. Responsable del registro inicial de cada tarjeta y su ingreso al proceso automatizado. Su interacción es operativa y en tiempo real'
    },
    {
        id: 2,
        nombre: 'Calidad',
        descripcion: 'Control defectos. Se encarga de la inspección final y clasificación de piezas. Tiene autoridad para registrar fallas y generar eventos de paro de línea'
    },
    {
        id: 3,
        nombre: 'Supervisor',
        descripcion: 'Control órdenes. Gestiona órdenes de producción y monitorea indicadores operativos. No autoriza paros, pero puede consultarlos y analizarlos'
    },
    {
        id: 4,
        nombre: 'Técnico',
        descripcion: 'Registro fallas y documenta evidencia visual desde la aplicación móvil'
    },
    {
        id: 5,
        nombre: 'Ingeniero',
        descripcion: 'Análisis proceso, datos históricos y valida decisiones técnicas complejas'
    },
    {
        id: 6,
        nombre: 'Gerente',
        descripcion: 'Vista ejecutiva y visualiza información estratégica para la toma de decisiones ejecutivas'
    }
];

const seedRoles = async () => {
    try {
        console.log('🌱 Iniciando seeder de roles...');
        
        // Verificar cuántos roles existen actualmente
        const count = await Rol.count();
        console.log(`📊 Roles existentes: ${count}`);
        
        if (count === 0) {
            // Si no hay roles, insertar todos
            await Rol.bulkCreate(rolesData);
            console.log('✅ Roles insertados correctamente');
        } else {
            // Si ya hay roles, actualizar o insertar los que faltan
            for (const rolData of rolesData) {
                const [rol, created] = await Rol.findOrCreate({
                    where: { id: rolData.id },
                    defaults: rolData
                });
                
                if (!created) {
                    // Si el rol ya existe, actualizar sus datos
                    await rol.update(rolData);
                    console.log(`🔄 Rol "${rolData.nombre}" actualizado`);
                } else {
                    console.log(`✅ Rol "${rolData.nombre}" creado`);
                }
            }
        }
        
        console.log('🎉 Seeder de roles completado exitosamente');
        
        // Mostrar los roles actuales
        const roles = await Rol.findAll({
            order: [['id', 'ASC']]
        });
        console.log('\n📋 Roles actuales en la base de datos:');
        roles.forEach(rol => {
            console.log(`   ${rol.id}. ${rol.nombre}`);
        });
        
    } catch (error) {
        console.error('❌ Error en el seeder de roles:', error);
    }
};

// Ejecutar el seeder si se llama directamente
if (require.main === module) {
    const { sequelize } = require('../models');
    
    const runSeeder = async () => {
        try {
            await sequelize.authenticate();
            console.log('✅ Conexión a BD establecida');
            await seedRoles();
        } catch (error) {
            console.error('❌ Error de conexión:', error);
        } finally {
            await sequelize.close();
            process.exit();
        }
    };
    
    runSeeder();
}

module.exports = seedRoles;