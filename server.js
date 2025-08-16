const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN ---
// 1. Base de Datos SQLite (creará un archivo 'tienda.db' en esta carpeta)
const dbPath = path.resolve(__dirname, 'tienda.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al abrir la base de datos", err.message);
    } else {
        console.log("Conectado a la base de datos SQLite.");
        db.exec(`
            CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, email TEXT UNIQUE NOT NULL, rut TEXT, telefono TEXT, direccion TEXT, fecha_nacimiento TEXT);
            CREATE TABLE IF NOT EXISTS pedidos (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL, numero_pedido TEXT UNIQUE NOT NULL, fecha_pedido TEXT DEFAULT CURRENT_TIMESTAMP, total INTEGER NOT NULL, metodo_entrega TEXT, metodo_pago TEXT, FOREIGN KEY (cliente_id) REFERENCES clientes(id));
            CREATE TABLE IF NOT EXISTS detalles_pedido (id INTEGER PRIMARY KEY AUTOINCREMENT, pedido_id INTEGER NOT NULL, producto_nombre TEXT NOT NULL, producto_id TEXT, cantidad INTEGER NOT NULL, precio_unitario INTEGER NOT NULL, detalles TEXT, FOREIGN KEY (pedido_id) REFERENCES pedidos(id));
        `);
    }
});

// 2. Configuración del Correo (Nodemailer)
// IMPORTANTE: Si usas Gmail con verificación en 2 pasos, debes crear una "Contraseña de aplicación" en la configuración de seguridad de tu cuenta de Google.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'contrerasaldo423@gmail.com',      // REEMPLAZA con tu correo
        pass: 'tu_contraseña_de_aplicacion' // REEMPLAZA con tu contraseña de aplicación
    }
});
// --- FIN CONFIGURACIÓN ---

app.post('/api/crear-pedido', (req, res) => {
    const { cliente, carrito, total, entrega, pago } = req.body;

    db.serialize(() => {
        const stmtCliente = `INSERT INTO clientes (nombre, email, rut, telefono, direccion, fecha_nacimiento) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET nombre=excluded.nombre, rut=excluded.rut RETURNING id`;
        db.get(stmtCliente, [cliente.nombre, cliente.email, cliente.rut, cliente.telefono, cliente.direccion, cliente.dob], function(err, row) {
            if (err) { return res.status(500).json({ success: false, message: 'Error en DB (cliente)' }); }
            
            const clienteId = row.id;
            const numeroPedido = `EA-${Date.now().toString().slice(-6)}`;

            const stmtPedido = `INSERT INTO pedidos (cliente_id, numero_pedido, total, metodo_entrega, metodo_pago) VALUES (?, ?, ?, ?, ?)`;
            db.run(stmtPedido, [clienteId, numeroPedido, total, entrega, pago], function(err) {
                if (err) { return res.status(500).json({ success: false, message: 'Error en DB (pedido)' }); }
                
                const pedidoId = this.lastID;
                const stmtDetalles = db.prepare(`INSERT INTO detalles_pedido (pedido_id, producto_nombre, producto_id, cantidad, precio_unitario, detalles) VALUES (?, ?, ?, ?, ?, ?)`);
                carrito.forEach(item => {
                    const detalles = `Color: ${item.color}, Talla: ${item.size}, Archivo: ${item.image}`;
                    stmtDetalles.run(pedidoId, item.name, item.id, item.quantity, item.price, detalles);
                });

                stmtDetalles.finalize(async (err) => {
                    if (err) { return res.status(500).json({ success: false, message: 'Error en DB (detalles)' }); }

                    const mailOptions = {
                        from: 'tu_correo@gmail.com',
                        to: 'contrerasaldo423@gmail.com',
                        subject: `¡Nuevo Pedido! - N° ${numeroPedido}`,
                        html: `<h1>Nuevo Pedido Recibido</h1><p><strong>N° Pedido:</strong> ${numeroPedido}</p><h2>Datos Cliente:</h2><ul><li><strong>Nombre:</strong> ${cliente.nombre}</li><li><strong>Email:</strong> ${cliente.email}</li><li><strong>RUT:</strong> ${cliente.rut}</li><li><strong>Teléfono:</strong> ${cliente.telefono}</li><li><strong>Dirección:</strong> ${cliente.direccion || 'No especificada'}</li></ul><h2>Detalles del Pedido:</h2><p>Total: $${total.toLocaleString('es-CL')}</p>`
                    };

                    try {
                        await transporter.sendMail(mailOptions);
                        res.status(201).json({ success: true, numeroPedido: numeroPedido });
                    } catch (emailError) {
                        res.status(500).json({ success: false, message: 'Pedido guardado, pero falló el envío de correo.' });
                    }
                });
            });
        });
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});