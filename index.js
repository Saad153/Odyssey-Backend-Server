const express = require("express");
const app = express();
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const db = require("./models");

// All Routes throughout the project

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
// const historyRoutes = require('./routes/history/');
const clientRoutes = require('./routes/clients/');
const chargesRoutes = require('./routes/charges');
const voucherRoutes = require('./routes/voucher');
const ollamaRoutes = require('./routes/ollama');
const invoiceRoutes = require('./routes/invoice');
// const vendorRoutes = require('./routes/vendors');
const vesselRoutes = require('./routes/vessel');
const manifest = require('./routes/manifest');
const authRoutes = require('./routes/auth/');
const ports = require("./routes/ports");
const verify = require("./functions/tokenVerification");

const { SE_Equipments, SE_Job, Container_Info, Bl, Stamps, Job_notes, Delivery_Order, Item_Details, Manifest, Manifest_Jobs } = require('./functions/Associations/jobAssociations/seaExport');
// const { Vendors, Vendor_Associations } = require('./functions/Associations/vendorAssociations');
const { Clients, Client_Associations } = require('./functions/Associations/clientAssociation');
const { Vouchers, Voucher_Heads } = require('./functions/Associations/voucherAssociations');
const { Invoice_Transactions } = require('./functions/Associations/incoiceAssociations');
const { Notifications } = require('./functions/Associations/NotificationAssociation');
const { AssignTask, Tasks, Sub_Tasks, Task_Logs } = require('./functions/Associations/taskAssociation');
const { Voyage } = require('./functions/Associations/vesselAssociations');

app.use(morgan('tiny'));
app.use(cors()); 

app.use(bodyParser.urlencoded({limit: '100mb', extended: true}));
app.use(bodyParser.json({limit: '100mb', extended: true}));
app.use(express.json());
db.sequelize.sync();

app.get("/getUser", verify, (req, res) => {res.json({isLoggedIn:true,username:req.body.username})});
app.get("/", (req, res) => { res.json('Welcome To Odyssey Server in Hail Dot Tech on Koyeb') });
app.use("/home", homeAccountRoutes, homeOperationsRoutes, homeDashboardRoutes);
app.use("/misc", miscPartiesRoutes, miscProfitLossRoutes, misctrialBalanceRoutes);
app.use("/notifications", notificationRoutes);
app.use("/employeeRoutes", employeeRoutes);
app.use("/nonGlParties", nonGlParties);
app.use("/clientRoutes", clientRoutes);
app.use("/commodity", commodityRoutes);
app.use("/companies", companyRoutes);
app.use("/accounts", accountRoutes);
app.use("/authRoutes", authRoutes);
// app.use("/history", historyRoutes);
app.use("/charges", chargesRoutes);
app.use("/invoice", invoiceRoutes);
app.use("/voucher", voucherRoutes);
app.use("/ollama", ollamaRoutes);
app.use("/vessel", vesselRoutes);
// app.use("/vendor", vendorRoutes);
app.use("/seaJob", seaJobRoutes);
app.use("/tasks", assignedTasks);
app.use("/manifest", manifest );
app.use("/ports", ports );

const PORT = process.env.PORT || 8082; 

app.listen(PORT, () => { console.log(`App listenings on port of Koyeb ${PORT}`) });