// // app.js
// const express = require('express');
// const morgan = require('morgan');
// const cors = require('cors');
// const db = require('./models');
// const http = require('http');

// const app = express();

// /* -------------------- UNDICI GLOBAL DISPATCHER -------------------- */
// const { Agent, setGlobalDispatcher } = require('undici');

// setGlobalDispatcher(new Agent({
//   connections: 200,        // VERY important for load
//   pipelining: 1,
//   headersTimeout: 900_000,
//   bodyTimeout: 0,
// }));

// /* -------------------- MIDDLEWARES -------------------- */
// app.use(morgan('tiny'));
// app.use(cors());

// // ⚠️ Reduced limits to avoid event loop death
// app.use(express.json({ limit: '100mb' }));
// app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// /* -------------------- ROUTES -------------------- */
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
// const vesselRoutes = require('./routes/vessel');
// const manifest = require('./routes/manifest');
// const authRoutes = require('./routes/auth/');
// const ports = require('./routes/ports');
// const verify = require('./functions/tokenVerification');

// /* -------------------- ASSOCIATIONS (SIDE EFFECTS) -------------------- */
// require('./functions/Associations/jobAssociations/seaExport');
// require('./functions/Associations/clientAssociation');
// require('./functions/Associations/voucherAssociations');
// require('./functions/Associations/incoiceAssociations');
// require('./functions/Associations/NotificationAssociation');
// require('./functions/Associations/taskAssociation');
// require('./functions/Associations/vesselAssociations');

// /* -------------------- BASIC ROUTES -------------------- */
// app.get('/getUser', verify, (req, res) => {
//   res.json({ isLoggedIn: true, username: req.body.username });
// });

// app.get('/', (req, res) => {
//   res.json('Welcome To Odyssey Server');
// });

// /* -------------------- MOUNT ROUTERS -------------------- */
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
// app.use('/seaJob', seaJobRoutes);
// app.use('/tasks', assignedTasks);
// app.use('/manifest', manifest);
// app.use('/ports', ports);

// /* -------------------- ERROR HANDLER -------------------- */
// app.use((err, req, res, next) => {
//   console.error('Unhandled error:', err);
//   res.status(err.status || 500).json({
//     status: 'error',
//     error: err.message || 'Internal Server Error',
//   });
// });

// /* -------------------- SERVER CREATION -------------------- */
// const args = process.argv.slice(2);
// const portArgIndex = args.findIndex(arg => arg === '-p' || arg === '--port');
// const argPort = portArgIndex !== -1 ? Number(args[portArgIndex + 1]) : NaN;
// const PORT = Number.isInteger(argPort) ? argPort : Number(process.env.PORT) || 8084;

// async function start() {
//   try {
//     // ✅ DO NOT sync schemas under load
//     await db.sequelize.authenticate();

//     const server = http.createServer(app);

//     // ✅ Critical socket tuning
//     server.keepAliveTimeout = 65_000;
//     server.headersTimeout = 70_000;
//     server.maxConnections = 1000;

//     server.listen(PORT, () => {
//       console.log(`Worker ${process.pid} listening on ${PORT}`);
//     });
//   } catch (err) {
//     console.error('Server startup failed:', err);
//     process.exit(1);
//   }
// }

// start();

// module.exports = app;

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
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

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
const destinations = require('./routes/destinations');
const airports = require('./routes/airports');
const verify = require('./functions/tokenVerification');

/* -------------------- ASSOCIATIONS (SIDE EFFECTS) -------------------- */
require('./functions/Associations/jobAssociations/seaExport');
require('./functions/Associations/clientAssociation');
require('./functions/Associations/voucherAssociations');
require('./functions/Associations/incoiceAssociations');
require('./functions/Associations/NotificationAssociation');
require('./functions/Associations/taskAssociation');
require('./functions/Associations/vesselAssociations');

/* -------------------- BASIC PUBLIC ROUTES -------------------- */
app.get('/', (req, res) => {
  res.json('Welcome To Odyssey Server');
});

/* -------------------- GLOBAL AUTH MIDDLEWARE -------------------- */
// Update this list to match your actual public auth endpoints
// (e.g. login, register, forgot-password, health checks).
// Everything else mounted below will require a valid session.
const PUBLIC_PATHS = [
  '/authRoutes/login',
  '/authRoutes/register',
  '/authRoutes/verifyLogin',
  '/companies/getAllCompanies',
];

app.use((req, res, next) => {
  // console.log('Checking path:', req.path, 'public?', PUBLIC_PATHS.includes(req.path));
  if (PUBLIC_PATHS.includes(req.path)) {
    return next();
  }
  return verify(req, res, next);
});

/* -------------------- AUTHENTICATED ROUTES -------------------- */
app.get('/getUser', (req, res) => {
  res.json({ isLoggedIn: true, username: req.body.username });
});

/* -------------------- MOUNT ROUTERS -------------------- */
app.use('/home', homeAccountRoutes, homeOperationsRoutes, homeDashboardRoutes);
app.use('/misc', miscPartiesRoutes, miscProfitLossRoutes, misctrialBalanceRoutes);
app.use('/notifications', notificationRoutes);
app.use('/employeeRoutes', employeeRoutes);
app.use('/nonGlParties', nonGlParties);
app.use('/accounts', accountRoutes);
app.use('/clientRoutes', clientRoutes);
app.use('/commodity', commodityRoutes);
app.use('/companies', companyRoutes);
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
app.use('/destinations', destinations);
app.use('/airports', airports);

/* -------------------- ERROR HANDLER -------------------- */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    error: err.message || 'Internal Server Error',
  });
});

/* -------------------- SERVER CREATION -------------------- */
const args = process.argv.slice(2);
const portArgIndex = args.findIndex(arg => arg === '-p' || arg === '--port');
const argPort = portArgIndex !== -1 ? Number(args[portArgIndex + 1]) : NaN;
const PORT = Number.isInteger(argPort) ? argPort : Number(process.env.PORT) || 8084;

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