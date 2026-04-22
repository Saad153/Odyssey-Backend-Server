
// // app.js
// const express = require('express');
// const app = express();
// const morgan = require('morgan');
// const cors = require('cors');
// const db = require('./models');

// // Increase undici timeouts to tolerate slow, CPU-only model responses
// const { Agent, setGlobalDispatcher } = require('undici');
// setGlobalDispatcher(new Agent({
//   headersTimeout: 900_000, // 15 minutes
//   bodyTimeout: 0,          // disable body timeout (or set a large value)
// }));

// // ----- Middlewares -----
// app.use(morgan('tiny'));
// app.use(cors());

// // Choose ONE set of parsers: use built-in express body parsers
// app.use(express.json({ limit: '100mb' }));
// app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// // If your clients use custom headers/methods, uncomment for robust preflight handling:
// // app.options('*', cors());

// // ----- Routes -----
// const miscProfitLossRoutes = require('./routes/misc/profitLoss');
// const misctrialBalanceRoutes = require('./routes/misc/trialBalance');
// const homeOperationsRoutes = require('./routes/home/operations');
// const homeDashboardRoutes = require('./routes/home/dashboard');
// const notificationRoutes = require('./routes/notifications');
// const homeAccountRoutes = require('./routes/home/accounts');
// const miscPartiesRoutes = require('./routes/misc/parties');
// const commodityRoutes = require('./routes/commodity/');
// const seaJobRoutes = require('./routes/jobRoutes/sea');
// const employeeRoutes = require('./routes/employees/');
// const nonGlParties = require('./routes/nonGlParties');
// const assignedTasks = require('./routes/assignTasks');
// const companyRoutes = require('./routes/companies/');
// const accountRoutes = require('./routes/accounts/');
// const historyRoutes = require('./routes/history/');
// const clientRoutes = require('./routes/clients/');
// const chargesRoutes = require('./routes/charges');
// const voucherRoutes = require('./routes/voucher');
// const ollamaRoutes = require('./routes/ollama');
// const invoiceRoutes = require('./routes/invoice');
// // const vendorRoutes = require('./routes/vendors');
// const vesselRoutes = require('./routes/vessel');
// const manifest = require('./routes/manifest');
// const authRoutes = require('./routes/auth/');
// const ports = require('./routes/ports');
// const verify = require('./functions/tokenVerification');

// // Side-effect imports / association initializers
// const {
//   SE_Equipments, SE_Job, Container_Info, Bl, Stamps, Job_notes,
//   Delivery_Order, Item_Details, Manifest: ManifestModel, Manifest_Jobs
// } = require('./functions/Associations/jobAssociations/seaExport');
// // const { Vendors, Vendor_Associations } = require('./functions/Associations/vendorAssociations');
// const { Clients, Client_Associations } = require('./functions/Associations/clientAssociation');
// const { Vouchers, Voucher_Heads } = require('./functions/Associations/voucherAssociations');
// const { Invoice_Transactions } = require('./functions/Associations/incoiceAssociations');
// const { Notifications } = require('./functions/Associations/NotificationAssociation');
// const { AssignTask, Tasks, Sub_Tasks, Task_Logs } = require('./functions/Associations/taskAssociation');
// const { Voyage } = require('./functions/Associations/vesselAssociations');

// // ----- Basic routes -----
// app.get('/getUser', verify, (req, res) => {
//   res.json({ isLoggedIn: true, username: req.body.username });
// });

// app.get('/', (req, res) => {
//   res.json('Welcome To Odyssey Server in Hail Dot Tech on Koyeb');
// });

// // ----- Mount routers -----
// app.use('/home', homeAccountRoutes, homeOperationsRoutes, homeDashboardRoutes);
// app.use('/misc', miscPartiesRoutes, miscProfitLossRoutes, misctrialBalanceRoutes);
// app.use('/notifications', notificationRoutes);
// app.use('/employeeRoutes', employeeRoutes);
// app.use('/nonGlParties', nonGlParties);
// app.use('/clientRoutes', clientRoutes);
// app.use('/commodity', commodityRoutes);
// app.use('/companies', companyRoutes);
// app.use('/accounts', accountRoutes);
// app.use('/authRoutes', authRoutes);
// app.use('/history', historyRoutes);
// app.use('/charges', chargesRoutes);
// app.use('/invoice', invoiceRoutes);
// app.use('/voucher', voucherRoutes);
// app.use('/ollama', ollamaRoutes);
// app.use('/vessel', vesselRoutes);
// // app.use('/vendor', vendorRoutes);
// app.use('/seaJob', seaJobRoutes);
// app.use('/tasks', assignedTasks);
// app.use('/manifest', manifest);
// app.use('/ports', ports);

// // ----- Global error handler (optional but recommended) -----
// /* eslint-disable no-unused-vars */
// app.use((err, req, res, next) => {
//   console.error('Unhandled error:', err);
//   const status = err.status || 500;
//   res.status(status).json({
//     status: 'error',
//     error: err.message || 'Internal Server Error',
//   });
// });
// /* eslint-enable no-unused-vars */

// // ----- Start server after DB sync -----
// const PORT = process.env.PORT || 8084;

// (async () => {
//   try {
//     await db.sequelize.sync(); // optionally: { alter: false, force: false }
//     app.listen(PORT, () => {
//       console.log(`App listening on port ${PORT}`);
//     });
//   } catch (err) {
//     console.error('Failed to start server (DB sync error):', err);
//     process.exit(1);
//   }
// })();


// app.js
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const db = require('./models');
const http = require('http');

const app = express();

/* -------------------- UNDICI GLOBAL DISPATCHER -------------------- */
const { Agent, setGlobalDispatcher } = require('undici');

setGlobalDispatcher(new Agent({
  connections: 200,        // VERY important for load
  pipelining: 1,
  headersTimeout: 900_000,
  bodyTimeout: 0,
}));

/* -------------------- MIDDLEWARES -------------------- */
app.use(morgan('tiny'));
app.use(cors());

// ⚠️ Reduced limits to avoid event loop death
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* -------------------- ROUTES -------------------- */
const miscProfitLossRoutes = require('./routes/misc/profitLoss');
const misctrialBalanceRoutes = require('./routes/misc/trialBalance');
const homeOperationsRoutes = require('./routes/home/operations');
const homeDashboardRoutes = require('./routes/home/dashboard');
const notificationRoutes = require('./routes/notifications');
const homeAccountRoutes = require('./routes/home/accounts');
const miscPartiesRoutes = require('./routes/misc/parties');
const commodityRoutes = require('./routes/commodity/');
const seaJobRoutes = require('./routes/jobRoutes/sea');
const employeeRoutes = require('./routes/employees/');
const nonGlParties = require('./routes/nonGlParties');
const assignedTasks = require('./routes/assignTasks');
const companyRoutes = require('./routes/companies/');
const accountRoutes = require('./routes/accounts/');
const historyRoutes = require('./routes/history/');
const clientRoutes = require('./routes/clients/');
const chargesRoutes = require('./routes/charges');
const voucherRoutes = require('./routes/voucher');
const ollamaRoutes = require('./routes/ollama');
const invoiceRoutes = require('./routes/invoice');
const vesselRoutes = require('./routes/vessel');
const manifest = require('./routes/manifest');
const authRoutes = require('./routes/auth/');
const ports = require('./routes/ports');
const verify = require('./functions/tokenVerification');

/* -------------------- ASSOCIATIONS (SIDE EFFECTS) -------------------- */
require('./functions/Associations/jobAssociations/seaExport');
require('./functions/Associations/clientAssociation');
require('./functions/Associations/voucherAssociations');
require('./functions/Associations/incoiceAssociations');
require('./functions/Associations/NotificationAssociation');
require('./functions/Associations/taskAssociation');
require('./functions/Associations/vesselAssociations');

/* -------------------- BASIC ROUTES -------------------- */
app.get('/getUser', verify, (req, res) => {
  res.json({ isLoggedIn: true, username: req.body.username });
});

app.get('/', (req, res) => {
  res.json('Welcome To Odyssey Server');
});

/* -------------------- MOUNT ROUTERS -------------------- */
app.use('/home', homeAccountRoutes, homeOperationsRoutes, homeDashboardRoutes);
app.use('/misc', miscPartiesRoutes, miscProfitLossRoutes, misctrialBalanceRoutes);
app.use('/notifications', notificationRoutes);
app.use('/employeeRoutes', employeeRoutes);
app.use('/nonGlParties', nonGlParties);
app.use('/clientRoutes', clientRoutes);
app.use('/commodity', commodityRoutes);
app.use('/companies', companyRoutes);
app.use('/accounts', accountRoutes);
app.use('/authRoutes', authRoutes);
app.use('/history', historyRoutes);
app.use('/charges', chargesRoutes);
app.use('/invoice', invoiceRoutes);
app.use('/voucher', voucherRoutes);
app.use('/ollama', ollamaRoutes);
app.use('/vessel', vesselRoutes);
app.use('/seaJob', seaJobRoutes);
app.use('/tasks', assignedTasks);
app.use('/manifest', manifest);
app.use('/ports', ports);

/* -------------------- ERROR HANDLER -------------------- */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    error: err.message || 'Internal Server Error',
  });
});

/* -------------------- SERVER CREATION -------------------- */
const PORT = process.env.PORT || 8084;

async function start() {
  try {
    // ✅ DO NOT sync schemas under load
    await db.sequelize.authenticate();

    const server = http.createServer(app);

    // ✅ Critical socket tuning
    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 70_000;
    server.maxConnections = 1000;

    server.listen(PORT, () => {
      console.log(`Worker ${process.pid} listening on ${PORT}`);
    });
  } catch (err) {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
}

start();

module.exports = app;