const { Vouchers, Voucher_Heads, Office_Vouchers } = require("../../functions/Associations/voucherAssociations");
const { Child_Account, Parent_Account } = require("../../functions/Associations/accountAssociations");
const { SE_Job, SE_Equipments, Bl, Container_Info ,Commodity} = require("../../functions/Associations/jobAssociations/seaExport");
const routes = require("express").Router();
const Sequelize = require("sequelize");
const moment = require("moment");
const { Employees } = require("../../functions/Associations/employeeAssociations");
const { Clients, Client_Associations } = require("../../functions/Associations/clientAssociation");
const { Vendors, Vendor_Associations } = require("../../functions/Associations/vendorAssociations");
const { Charge_Head, Invoice, Invoice_Transactions } = require("../../functions/Associations/incoiceAssociations");
const { Accounts, sequelize } = require('../../models/');
const { Op, literal } = Sequelize;

//Voucher Types
// (For Jobs)
// Job Reciept 
// Job Recievable
// Job Payment 
// Job Payble
// 0 Unpaid
// 1 Fully-paid
// 2 Half-paid

// (For Expense)
// Expenses Payment
// Office_Vouchers

const setVoucherHeads = (id, heads, curr) => {
  let result = [];
  heads.forEach((x) => {
    console.log("X>",x)
    result.push({
      ...x,
      VoucherId: id,
      amount: `${x.amount}`,
      defaultAmount: curr=="PKR"?`${x.amount}`:'0',
    });
  });
  console.log("Result>",result)
  return result;
};

routes.post("/ApproveOfficeVoucher", async (req, res) => {
  try {
    const result = await Office_Vouchers.update(
      { approved: req.body.approved, VoucherId: req.body.VoucherId },
      { where: { id: req.body.id } }
    );

    res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.post("/recordReverse", async (req, res) => {
  try {
    const result = await Vouchers.findOne({
      where: { id: req.body.VoucherId },
      include: [{ model: Voucher_Heads }]
    })
    await Office_Vouchers.update(
      { reverseAmount: req.body.reverseAmount, paid: req.body.paid },
      { where: { id: req.body.id } }
    );
    res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.post("/OfficeVoucherUpsert", async (req, res) => {
  try {
    const result = await Office_Vouchers.upsert(req.body);
    res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/OfficeVoucherById", async (req, res) => {
  try {
    const result = await Office_Vouchers.findOne({
      where: { id: req.headers.id },
      include: [{ model: Employees, attributes: ['name'] },
      { model: Vouchers, attributes: ['voucher_Id'] }],
    })
    res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/OfficeAllVouchers", async (req, res) => {
  try {
    const result = await Office_Vouchers.findAll({
      attributes: ['id', 'EmployeeId', 'amount', 'requestedBy', 'preparedBy', 'approved', 'paid'],
      where: { CompanyId: req.headers.companyid },
      include: [
        { model: Employees, attributes: ['name'] },
        { model: Vouchers, attributes: ['voucher_Id'] },
      ]
    })
    res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/getAllVoucehrHeads", async (req, res) => {
  try {
    console.log("Running API")
    const invoices = await Invoices.findAll();

    // Update each invoice with the modified invoice_No
    for (const invoice of invoices) {
      const modifiedInvoiceNo = invoice.invoice_No?.endsWith('-O') 
        ? invoice.invoice_No.slice(0, -2) 
        : invoice.invoice_No;
      await invoice.update({ invoice_No: modifiedInvoiceNo });
    }

    res.json({ status: "success", message: "Invoice numbers updated successfully" });
  } catch (error) {
    console.error("Error updating invoice numbers:", error);
    res.status(500).json({ status: "error", result: error.message });
  }
});


routes.post("/voucherCreation", async (req, res) => {
  try {
    console.log("Request Body:",req.body)
    const check = await Vouchers.findOne({
      order: [["voucher_No", "DESC"]],
      attributes: ["voucher_No"],
      where: { vType: req.body.vType, CompanyId: req.body.CompanyId }
    });
      const result = await Vouchers.create({
        ...req.body,
        voucher_No: check == null ? 1 : parseInt(check.voucher_No) + 1,
        voucher_Id: !req.body.voucher_Id?`${req.body.CompanyId == 1 ? "SNS" : req.body.CompanyId == 2 ? "CLS" : "ACS"
        }-${req.body.vType
        }-${check == null ? 1 : parseInt(check.voucher_No) + 1
        }/${moment().month() >= 6 ? moment().add(1, 'year').format('YY') : moment().format('YY')}`:req.body.voucher_Id,
      }).catch();
      let dataz = await setVoucherHeads(result.id, req.body.Voucher_Heads, req.body.currency);
      const VH = await Voucher_Heads.bulkCreate(dataz);
      res.json({ status: "success", result: result });
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

routes.post("/cheaqueReturned", async (req, res) => {
  try {
    const data = req.body
    const {VoucherId, InvoiceId} = data;

   const found = await Vouchers.findOne({
      order: [["voucher_No", "DESC"]],
      where: { id:VoucherId  }
    });
    const { CompanyId, costCenter, currency, exRate, voucher_No, voucher_Id,
      vType, type, subType, partyType, partyName, partyId, onAccount,
      invoices, tranDate
    } = found.dataValues;

    const vId = voucher_Id.replace(/-[^-]+(?=-\d+\/\d+)/, "-CR");
    const vtype = vType.replace(/.*/, "CR");

    const voucher_Data = {
      CompanyId, costCenter, currency, exRate, voucher_No, voucher_Id: vId,
      vType: vtype, type, subType, partyType, partyName, partyId, onAccount,
      invoices, tranDate
    };
    const voucher_created = await Vouchers.create(voucher_Data);
    const vData = {...data, VoucherId: voucher_created.id }
 
    const VHresult = await Voucher_Heads.create(vData);


    const getInvoiceTransaction = await Invoice_Transactions.destroy({
       where:
      { InvoiceId: InvoiceId}
    
      
    })

   const updateInvoice = await Invoice.update(
     {
       recieved: "0",
       status: "1",
     },
     {where:{ id:InvoiceId}}
   )


   res.json({ status: "success", result:updateInvoice });
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

routes.post("/voucherEdit", async (req, res) => {
  try {
    await Vouchers.update({ ...req.body }, { where: { id: req.body.id } })
    await Voucher_Heads.destroy({ where: { VoucherId: req.body.id } })
    req.body.Voucher_Heads.forEach(async (x) => {
      const result = await Voucher_Heads.upsert({ ...x, VoucherId: req.body.id, createdAt: req.body.createdAt });
    });
    await res.json({ status: "success" });
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

routes.post("/deleteVoucher", async (req, res) => {
  try {
    let obj = {};
    if (req.body.type == "VoucherId Exists") {
      obj = { id: req.body.id }
    } else {
      obj = {
        invoice_Voucher: "1",
        invoice_Id: req.body.id.toString(),
      }
    }
    const findAll = await Vouchers.findAll({
      where: obj,
    });
    for(let x of findAll){

      const resultOne = await Voucher_Heads.destroy({
        where: { VoucherId: x.dataValues.id },
      });
      const resultTwo = await Vouchers.destroy({
        where: { id: x.dataValues.id },
      });
    }
    await res.json({ status: "success", result: { findAll } });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/getAccountActivity", async (req, res) => {
  try {
    const { debitaccount, creditaccount } = req.headers;
    let obj = {};
    if (debitaccount != "" && creditaccount == "") {
      obj = { ChildAccountId: debitaccount, type: "debit" };
    } else if (debitaccount == "" && creditaccount != "") {
      obj = { ChildAccountId: creditaccount, type: "credit" };
    } else if (debitaccount != "" && creditaccount != "") {
      obj = {
        [Op.or]: [
          { ChildAccountId: debitaccount, type: "debit" },
          { ChildAccountId: creditaccount, type: "credit" },
        ],
      };
    } else if (debitaccount == "" && creditaccount == "") {
      obj = {};
    }
    const resultOne = await Voucher_Heads.findAll({
      where: obj,
      include: [{ model: Vouchers }],
    });
    let items = [];
    resultOne.forEach((x) => {
      items.push(x.dataValues.Voucher.voucher_Id)
    });

    let voucherIds = [...new Set(items)];
    const result = await Vouchers.findAll({
      attributes: ["voucher_Id", "currency", "exRate", "createdAt"],
      where: {
        voucher_Id: voucherIds,
        createdAt: {
          [Op.gte]: moment(req.headers.from).toDate(),
          [Op.lte]: moment(req.headers.to).add(1, "days").toDate(),
        },
      },
      include: [
        {
          model: Voucher_Heads,
          attributes: ["amount", "type", "defaultAmount"],
          include: [
            {
              model: Child_Account,
              attributes: ["id", "title"],
            },
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });
    await res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/getAllVouchers", async (req, res) => {
  try {
    const result = await Vouchers.findAll({
      where: {
        CompanyId: req.headers.id,
        [Op.and]: [
          { type: { [Op.ne]: "Job Payment" } },
          { type: { [Op.ne]: "Job Reciept" } },
        ]
      },
      include: [{
        model: Voucher_Heads,
        attributes: ['type', 'amount'],
        where: { type: "debit" }
      }],
      order: [["createdAt", "DESC"]],
    });
    await res.json({ status: "success", result: result, count:1 });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/testgetAll", async (req, res) => {
  try {
    const result = await Vouchers.findAll({
      where: {
        CompanyId: req.headers.id,
      },
      attributes: ['createdAt', 'voucher_Id'],
      order: [["createdAt", "DESC"]],
    });
    await res.json({ status: "success", result: result, count:1 });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/getAllJobPayRecVouchers", async (req, res) => {
  try {
    const page = parseInt(req.headers.page) || 1;
    const limit = parseInt(req.headers.limit) || 50;
    const offset = (page - 1) * limit;

    // Get total count for pagination
    const total = await Vouchers.count({
      where: {
        CompanyId: req.headers.companyid,
        vType: { [Op.notIn]: ["OP", "SI", "PI", "OI", "OB"] },
        type: { [Op.in]: ["Job Payment", "Job Reciept"] },
      },
    });

    // Fetch only the records for the current page
    const result = await Vouchers.findAll({
      order: [["createdAt", "DESC"]],
      where: {
        CompanyId: req.headers.companyid,
        vType: { [Op.notIn]: ["OP", "SI", "PI", "OI", "OB"] },
        type: { [Op.in]: ["Job Payment", "Job Reciept"] },
      },
      include: [
        { model: Invoice_Transactions },
        {
          model: Voucher_Heads,
          attributes: ["type", "amount", "accountType", "ChildAccountId"],
        },
      ],
      limit,
      offset,
    });

    let invoice = [];
    result.forEach((x) => {
      x.dataValues.invoices?.split(",").forEach((y) => {
        if (y) invoice.push(y);
      });
    });

    const invoices = await Invoice.findAll({
      where: { id: { [Op.in]: invoice } },
      include: [
        {
          model: SE_Job,
          include: [
            { model: SE_Equipments, attributes: ["qty", "size"] },
            { model: Bl, required: false, attributes: ["mbl", "hbl"] },
          ],
        },
        { model: Invoice_Transactions },
      ],
    });

    result.forEach((x) => {
      const inv = invoices
        .filter((y) => x.dataValues.invoices?.includes(y.dataValues.id))
        .map((y) => ({ ...y.dataValues }));
      x.dataValues.invoice = inv;
    });

    res.json({
      status: "success",
      result: result,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.log(error);
    res.json({ status: "error", result: error });
  }
});


routes.get("/getVoucherById", async (req, res) => {
  try {
    console.log(">>>",req.headers.id)
    const result = await Vouchers.findOne({
      where: { id: req.headers.id },
      include: [
        { 
          model: Voucher_Heads,
          include:[{
            model:Child_Account,
            attributes:['title']
          }]
        }
      ],
    });
    await res.json({ status: "success", result: result });
  } catch (error) {
    console.error(error)
    res.json({ status: "error", result: error });
  }
});

routes.get("/getVoucherByIdAdvanced", async (req, res) => {
  try {
    const result = await Vouchers.findOne({
      where: { id: req.headers.id },
      include: [{
        model: Voucher_Heads,
        include: [{
          model: Child_Account,
          include: [{
            model: Child_Account,
            as: 'parent',
            include: [{
              model: Child_Account,
              as: 'parent'
            }]
          }]
        }]
      }],
    });
    await res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/getVouchersByEmployeeId", async (req, res) => {
  try {
    const result = await Office_Vouchers.findAll({
      where: { EmployeeId: req.headers.id },
    });
    await res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.post("/deleteBaseVoucher", async (req, res) => {
  try {
    await Voucher_Heads.destroy({ where: { VoucherId: req.body.id } })
    await Vouchers.destroy({ where: { id: req.body.id } })
    await res.json({ status: "success" });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.post("/testDeleteVouchers", async (req, res) => {
  try {

    await Vouchers.destroy({ where: {} })
    await Voucher_Heads.destroy({ where: {} })
    await res.json({ status: "success" });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.post("/getChildAccountIds", async (req, res) => {
  let accountsList = req.body.list;
  let newList = [];
  try {
    const childTwoTest = await Child_Account.findOne({
      where: { title: "CONTRA ACCOUNT OPENINIG" },
      attributes: ['id', 'title'],
      include: [{
        model: Parent_Account,
        where: { CompanyId: 3 },
        attributes: ['CompanyId', 'title']
      }]
    });
    await accountsList.forEach(async (x, i) => {
      await Child_Account.findOne({
        where: { title: x.title },
        attributes: ['id'],
        include: [{
          model: Parent_Account,
          where: { CompanyId: req.body.company }
        }]
      }).then(async (y) => {
        newList.push({
          "type": "Opening Balance",
          "vType": "OP",
          "currency": req.body.currency,
          "exRate": "1",
          "costCenter": "KHI",
          "CompanyId": req.body.company,
          Voucher_Heads: [
            {
              title: "CONTRA ACCOUNT OPENINIG",
              ChildAccountId: childTwoTest.id,
              amount: x.amount,
              type: x.type == "debit" ? "debit" : "credit",
              defaultAmount: x.amount,
            },
            {
              title: x.title,
              ChildAccountId: y?.id,
              amount: x.amount,
              type: x.type == "debit" ? "credit" : "debit",
              defaultAmount: x.amount,
            },
          ]
        })
      })
    });
    const childTwo = await Child_Account.findOne({
      where: { title: "CONTRA ACCOUNT OPENINIG" },
      attributes: ['id', 'title'],
      include: [{
        model: Parent_Account,
        where: { CompanyId: 3 },
        attributes: ['CompanyId', 'title']
      }]
    });
    res.json({ status: "success", result: { newList, childTwo } });
  } catch (error) {
    res.json({ status: "error" });
  }
});

routes.post("/deletePaymentReceipt", async(req, res) => {
  try {
    const trans = await Invoice_Transactions.findAll({where:{VoucherId:req.body.id}})
    for (let x of trans) {
      const invoice = await Invoice.findOne({ where: { id: x.dataValues.InvoiceId } });
      console.log(x.dataValues)
      if (invoice) {
        let updateData = { status: "1" };
        console.log("Invoice to be deleted>>>",invoice.dataValues)
        if (invoice.dataValues.payType === "Recievable") {
          updateData.recieved = (parseFloat(invoice.dataValues.recieved) - parseFloat(x.dataValues.amount)).toString();
        } else if (invoice.dataValues.payType === "Payble") {
          updateData.paid = (parseFloat(invoice.dataValues.paid) - parseFloat(x.dataValues.amount)).toString();
        }
        console.log("Update Data>>>", updateData)
        const updateInvoice = await Invoice.update(updateData, {
          where: { id: x.dataValues.InvoiceId }
        });
      }
    }
    await Voucher_Heads.destroy({where:{VoucherId:req.body.id}})
    await Invoice_Transactions.destroy({where:{VoucherId:req.body.id}})
    await Vouchers.destroy({where:{id:req.body.id}})

    res.json({status:'success',});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.post("/makeTransaction", async(req, res) => {
  const t = await sequelize.transaction()
  try {
    let invoices = req.body.invoices;
    let invoicesList = ""
    let narration  = ""
    if(req.body.totalReceiving>0){
      narration = `Received ${req.body.subType}`
    }else{
      narration = `Paid ${req.body.subType}`
    }
    if(req.body.advance){
      if(req.body.payType == 'Recievable'){
        narration = `Received ${req.body.subType}`
      }else{
        narration = `Paid ${req.body.subType}`
      }
    }
    narration = req.body.checkNo?narration+" "+req.body.checkNo:narration
    narration = req.body.checkDate?narration+", Date: "+moment(req.body.checkDate).format('YYYY-MM-DD'):narration
    let i = 0
    for(let x of invoices){
      if(x.receiving!=0){
        if(!req.body.edit){
          if(x.payType=="Recievable"){
            const updateInvoice = await Invoice.update(
              {
                recieved: literal(`CAST("recieved" AS numeric) + ${x.receiving}`), // Cast `recieved` to numeric, then add
                status: "1",
              },
              { where: { id: x.id }, transaction: t }
            );
            
          }else{
            const updateInvoice = await Invoice.update(
              {
                paid: literal(`CAST("paid" AS numeric) + ${x.receiving}`), // Cast `recieved` to numeric, then add
                status: "1",
              },
              { where: { id: x.id }, transaction: t }
            );

          }
        }else{
          if(x.payType=="Recievable"){
            const updateInvoice = await Invoice.update(
              {
                recieved: x.receiving, // Cast `recieved` to numeric, then add
                status: "1",
              },
              { where: { id: x.id }, transaction: t }
            );
            
          }else{

            const updateInvoice = await Invoice.update(
              {
                paid: x.receiving, // Cast `recieved` to numeric, then add
                status: "1",
              },
              { where: { id: x.id }, transaction: t }
            );
          }
        }
        invoicesList += `${x.id},`
        if(i == 0){
          narration = `${narration}, Against`
          x.SE_Job?.Bl?.hbl?narration = `${narration}, HBL# ${x.SE_Job?.Bl?.hbl}`:null
          x.SE_Job?.Bl?.mbl?narration = `${narration}, MBL# ${x.SE_Job?.Bl?.mbl}`:null
        }
        narration = `${narration}, Invoice# ${x.invoice_No}`
        if(i == invoices.length-1){
          narration = `${narration}, Job# ${x.SE_Job?.jobNo}`
          narration = `${narration}, For ${x.party_Name}`
        }
      }
      i++
    }
    let vID = req.body.voucherId
    let vouchers
    if(!req.body.edit){
      console.log(req.body.transactionMode, req.body.payType)
      let temp
      if(req.body.transactionMode=="Cash"){
        if(req.body.payType=="Recievable"){
          temp = "CRV"
        }else{
          temp = "CPV"
        }
      }else if(req.body.transactionMode=="Bank"){
        if(req.body.payType=="Recievable"){
          temp = "BRV"
        }else{
          temp = "BPV"
        }
      }else if(req.body.transactionMode=="Adjust"){
        if(req.body.payType=="Recievable"){
          temp = "ADJ-R"
        }else{
          temp = "ADJ-P"
        }
      }
      let v = {
        type: `Job ${req.body.payType=="Recievable"?"Reciept":"Payment"}`,
        vType: temp,
        currency: req.body.currency,
        exRate: req.body.exRate,
        chequeNo: req.body.checkNo,
        chequeDate: req.body.checkDate,
        costCenter: 'KHI',
        invoices: invoicesList,
        onAccount: req.body.type,
        partyId: req.body.partyId,
        partyName: req.body.partyName,
        partyType: req.body.partyType,
        tranDate: req.body.tranDate,
        subType: req.body.subType,
        CompanyId: req.body.companyId,
        voucherNarration: req.body.narration==""?narration:req.body.narration,
        createdAt: req.body.tranDate
      }
      console.log(v.vType)
      const lastVoucher = await Vouchers.findOne({
        where: {
          vType: v.vType,
          CompanyId: v.CompanyId,
        },
        order: [["voucher_No", "DESC"]],
      })
      if(lastVoucher==null){
        v.voucher_No = 1
        v.voucher_Id = `${v.CompanyId == 1 ? "SNS" : v.CompanyId == 2 ? "CLS" : "ACS"}-${v.vType}-${v.voucher_No}/${moment().month() >= 6 ? moment().add(1, 'year').format('YY') : moment().format('YY')}`
      }else{
        v.voucher_No = lastVoucher.voucher_No + 1
        v.voucher_Id = `${v.CompanyId == 1 ? "SNS" : v.CompanyId == 2 ? "CLS" : "ACS"}-${v.vType}-${v.voucher_No}/${moment().month() >= 6 ? moment().add(1, 'year').format('YY') : moment().format('YY')}`
      }
      vouchers = await Vouchers.create(
        v,
        {
          transaction: t
        }
      )
      vID = vouchers.id
    }else{
      console.log(narration)
      const vouchers = await Vouchers.update(
        { invoices: invoicesList,
          voucherNarration: narration
         }, // Data to update
        { where: { id: vID }, transaction: t }      // Query options
      );
      await Voucher_Heads.destroy({
        where:{
          VoucherId: vID
        },
        transaction: t
      })
    }
    let account
    account = await Client_Associations.findOne({
      where: { ClientId: req.body.partyId }
    })
    
    for(let x of req.body.transactions){
      let amount = 0.0
      if(x.type=='credit'){
        amount = x.credit
      }else {
        amount = x.debit
      }
      if(x.accountName!="Total"){
        if(x.accountType=='partyAccount'){
          await Voucher_Heads.create(
            {
              amount: amount,
              defaultAmount: x.currency=="PKR"?amount:amount*req.body.exRate,
              type: x.type,
              accountType: x.accountType,
              VoucherId: vID,
              ChildAccountId: account.ChildAccountId,
              narration: narration,
              createdAt: req.body.tranDate
            }, {
              transaction: t
            }
          )
        }else{
          if(x.partyId == req.body.partyId){
            await Voucher_Heads.create(
              {
                amount: amount,
                defaultAmount: x.currency=="PKR"?amount:amount*req.body.exRate,
                type: x.type,
                accountType: x.accountType,
                VoucherId: vID,
                ChildAccountId: account.ChildAccountId,
                narration: req.body.narration==""?narration:req.body.narration,
                createdAt: req.body.tranDate
              },
              {
                transaction: t
              }
            )
          }else{
            await Voucher_Heads.create(
              {
                amount: amount,
                defaultAmount: x.currency=="PKR"?amount:amount*req.body.exRate,
                type: x.type,
                accountType: x.accountType,
                VoucherId: vID,
                ChildAccountId: x.partyId,
                narration: req.body.narration==""?narration:req.body.narration,
                createdAt: req.body.tranDate
              },
              {
                transaction: t
              }
            )
          }
        }
    }
    }
    for(let x of invoices){
      if(!req.body.edit){
        if(x.receiving!=0){
          let a = await Invoice_Transactions.create(
            {
              gainLoss: req.body.gainLoss,
              amount: x.receiving,
              InvoiceId: x.id,
              VoucherId: vID
              
            },
            {
              transaction: t
            }
          )
        }
      }else{
        let a = await Invoice_Transactions.destroy({
          where: {
            InvoiceId: x.id,
            VoucherId: vID
          },
          transaction: t
        })
        if(x.receiving!=0){
          let b = await Invoice_Transactions.create(
            {
              gainLoss: req.body.gainLoss,
              amount: x.receiving,
              InvoiceId: x.id,
              VoucherId: vID
              
            },
            {
              transaction: t
            }
          )
        }
      }
    }
    await t.commit();
    res.json({status:'success', result: vouchers});
  }
  catch (error) {
    await t.rollback();
    console.log(error)
    res.json({status:'error', result:error});
  }
});

routes.post("/createVoucher", async(req, res) => {
  try{
    console.log("Create Voucher>>", req.body)
    let voucher_Heads = req.body.Voucher_Heads
    const lastVoucher = await Vouchers.findOne({
      where: {
        vType: req.body.vType,
        CompanyId: req.body.CompanyId,
      },
      order: [["voucher_No", "DESC"]],
    })
    if(lastVoucher==null){
      req.body.voucher_No = 1
      req.body.voucher_Id = `${req.body.CompanyId == 1 ? "SNS" : req.body.CompanyId == 2 ? "CLS" : "ACS"}-${req.body.vType}-${req.body.voucher_No}/${moment().month() >= 6 ? moment().add(1, 'year').format('YY') : moment().format('YY')}`
    }else{
      req.body.voucher_No = lastVoucher.voucher_No + 1
      req.body.voucher_Id = `${req.body.CompanyId == 1 ? "SNS" : req.body.CompanyId == 2 ? "CLS" : "ACS"}-${req.body.vType}-${req.body.voucher_No}/${moment().month() >= 6 ? moment().add(1, 'year').format('YY') : moment().format('YY')}`
    }
    const result = await Vouchers.create(req.body)
    for(let x of voucher_Heads){
      x.VoucherId = result.id
      await Voucher_Heads.create(x)
    }
    res.json({status:'success', result: result});
  }catch(e){
    console.log(e)
    res.json({status:'error', result:e});
  }
})

routes.post("/updateVoucher", async (req, res) => {
  try {
    const { id: voucherId } = req.body;

    const result = await Vouchers.upsert(req.body);

    const incomingHeads = req.body.Voucher_Heads.map(head => ({
      ...head,
      VoucherId: voucherId,
    }));

    const incomingIds = [];

    for (let head of incomingHeads) {
      const upserted = await Voucher_Heads.upsert(head);
      if (head.id) {
        incomingIds.push(head.id);
      } else if (upserted[0]?.id) {
        incomingIds.push(upserted[0].id);
      }
    }

    await Voucher_Heads.destroy({
      where: {
        VoucherId: voucherId,
        ...(incomingIds.length > 0 && {
          id: { [Op.notIn]: incomingIds }
        }),
      },
    });

    res.json({ status: 'success', result });
  } catch (e) {
    console.error("Error in updateVoucher:", e);
    res.json({ status: 'error', result: e });
  }
});


routes.get("/getExRateVouchers", async(req, res) => {
  try{
    const Charges = await Voucher_Heads.update(
      {
        accountType: "Charges Account",
      },
      {
        where: {
          ChildAccountId: { [Op.or]: ['55690', '57542'] }
        }
      }
    );
    const CV = await Voucher_Heads.update(
      {
        accountType: "partyAccount",
      },
      {
        where: {
          accountType: { [Op.or]: ['client', 'vendor', 'agent'] }
        }
      }
    );
    const BC = await Voucher_Heads.update(
      {
        accountType: "payAccount",
      },
      {
        where: {
          accountType: { [Op.or]: ['Bank'] }
        }
      }
    );
    res.json({status:'success'});
  }catch(e){
    console.log(e)
    res.json({status:'error', result:e});
  }
})

routes.post("/importVouchers", async (req, res) => {
  try {
    console.log("Length: ", req.body.records.length);

    const accounts = await Child_Account.findAll({ include: Parent_Account });
    const accountMap = new Map();
    accounts.forEach((a) => {
      const companyId = a.Parent_Account?.CompanyId;
      if (companyId) {
        accountMap.set(`${a.title}-${companyId}`, { id: a.id, subCategory: a.subCategory });
      }
    });

    const success = [];
    const failed = [];

    for (let voucher of req.body.records) {
      const t = await sequelize.transaction(); // 👈 transaction per voucher
      try {
        const companyId = voucher.VoucherNo.includes("SNS") ? 1 : 3;
        let CAID = 0;
        const accountKey = `${voucher.GL_Voucher_Detail[0].GL_COA?.AccountName}-${companyId}`;
        if (accountMap.has(accountKey)) {
          CAID = accountMap.get(accountKey).id;
        } else {
          console.warn(`⚠️ No matching account for: ${voucher.GL_Voucher_Detail[0].GL_COA?.AccountName}`);
        }

        let party;
        const isPayable = voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE")
          || voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LIABILITIES")
          || voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LAIBILITY");

        if (isPayable) {
          let temp = await Vendor_Associations.findOne({ where: { CompanyId: companyId, ChildAccountId: CAID } });
          party = temp ? await Vendors.findOne({ where: { id: temp.VendorId } }) : null;
        } else {
          let temp = await Client_Associations.findOne({ where: { CompanyId: companyId, ChildAccountId: CAID } });
          party = temp ? await Clients.findOne({ where: { id: temp.ClientId } }) : null;
        }

        if (!party) {
          // console.warn(`⚠️ No matching party for: ${voucher.GL_Voucher_Detail[0].GL_COA.AccountName}`);
          const isPayable = voucher.GL_Voucher_Detail[1].GL_COA.GL_COA.AccountName.includes("PAYABLE")
            || voucher.GL_Voucher_Detail[1].GL_COA.GL_COA.AccountName.includes("LIABILITIES")
            || voucher.GL_Voucher_Detail[1].GL_COA.GL_COA.AccountName.includes("LAIBILITY");

          if (isPayable) {
            let temp = await Vendor_Associations.findOne({ where: { CompanyId: companyId, ChildAccountId: CAID } });
            party = temp ? await Vendors.findOne({ where: { id: temp.VendorId } }) : null;
          } else {
            let temp = await Client_Associations.findOne({ where: { CompanyId: companyId, ChildAccountId: CAID } });
            party = temp ? await Clients.findOne({ where: { id: temp.ClientId } }) : null;
          }
        }

        if(!party){
          console.warn(`⚠️ No matching party for: ${voucher.GL_Voucher_Detail[1].GL_COA.AccountName}`);
        }

        let voucherType = "";
        let vouchervType = "";

        switch (true) {
          case voucher.GL_VoucherType.VoucherType.includes("PAYMENT"):
            voucherType = "Job Payment";
            vouchervType = voucher.GL_VoucherType.TypeCode;
            break;
          case voucher.GL_VoucherType.VoucherType.includes("RECEIPT"):
            voucherType = "Job Reciept";
            vouchervType = voucher.GL_VoucherType.TypeCode;
            break;
          case voucher.GL_VoucherType.VoucherType.includes("DEBIT NOTE"):
            voucherType = voucher.GL_VoucherType.VoucherType;
            vouchervType = "ADJ-R";
            break;
          case voucher.GL_VoucherType.VoucherType.includes("CREDIT NOTE"):
            voucherType = voucher.GL_VoucherType.VoucherType;
            vouchervType = "ADJ-P";
            break;
          default:
            voucherType = voucher.GL_VoucherType.VoucherType;
            vouchervType = voucher.GL_VoucherType.TypeCode;
            break;
        }

        const Voucher = await Vouchers.create(
          {
            voucher_No: voucher.VoucherNo.split("-")[2].split("/")[0].replace(/^0+/, ""),
            voucher_Id: voucher.VoucherNo,
            type: voucherType,
            vType: vouchervType,
            currency: voucher.GL_Currencies?.CurrencyCode ?? "PKR",
            exRate: voucher.ExchangeRate,
            chequeNo: voucher.GL_Voucher_Detail[0].ChequeNumber,
            chequeDate: voucher.GL_Voucher_Detail[0].ChequeDate,
            voucherNarration: voucher.Narration,
            costCenter: "KHI",
            onAccount: isPayable ? "vendor" : "client",
            partyId: party?.id,
            partyName: party?.name,
            partyType: isPayable ? "vendor" : "client",
            tranDate: voucher.VoucherDate,
            createdBy: voucher.AddLog,
            createdAt: moment(voucher.AddOn),
            updatedAt: voucher.EditOn?moment(voucher.EditOn):moment(voucher.AddOn),
            CompanyId: companyId,
          },
          { transaction: t, silent: true }
        );

        // ========================
        //  Voucher Heads Creation
        // ========================
        for (let vh of voucher.GL_Voucher_Detail) {
          let accountType = "";
          switch (true) {
            case vh.GL_COA.GL_COASubCategory.SubCategory.includes("Customer"):
            case vh.GL_COA.GL_COASubCategory.SubCategory.includes("Vendor"):
              accountType = "partyAccount";
              break;
            case vh.GL_COA.GL_COASubCategory.SubCategory.includes("Bank"):
            case vh.GL_COA.GL_COASubCategory.SubCategory.includes("Cash"):
              accountType = "payAccount";
              break;
            case vh.GL_COA.AccountName.includes("EX-CHANGE RATE GAIN / LOSS"):
              accountType = "Gain/Loss Account";
              break;
            case vh.GL_COA.AccountName.includes("TAX"):
              accountType = "Tax Account";
              break;
            default:
              accountType = "Adjust Charges Account";
              break;
          }

          await Voucher_Heads.create(
            {
              defaultAmount: vh.DebitLC == 0 ? vh.CreditLC : vh.DebitLC,
              amount: vh.DebitVC == 0 ? vh.CreditVC : vh.DebitVC,
              type: vh.DebitLC == 0 ? "credit" : "debit",
              narration: vh.NarrationVD,
              accountType: accountType,
              createdAt: Voucher.createdAt,
              updatedAt: Voucher.updatedAt,
              VoucherId: Voucher.id,
              ChildAccountId: accountMap.get(`${vh.GL_COA.AccountName}-${companyId}`)?.id,
            },
            { transaction: t, silent: true }
          );
        }

        // ========================
        //  Invoice Adjustments
        // ========================
        let invoiceList = [];
        for (let it of voucher.GL_InvAdjustments) {
          let Inv = await Invoice.findOne({
            where: { climaxId: it.GL_Invoices.Id.toString() },
            transaction: t,
          });

          if (Inv) {
            Inv = await Inv.update(
              {
                paid: literal(`CAST("paid" AS numeric) + ${it.Amount}`),
                recieved: literal(`CAST("recieved" AS numeric) + ${it.Amount}`),
              },
              { transaction: t }
            );
          }

          if (Inv) {
            await Invoice_Transactions.create(
              {
                gainLoss: 1,
                amount: it.Amount,
                createdAt: it.AddOn || moment().format("YYYY-MM-DD"),
                updatedAt: it.EditOn || moment().format("YYYY-MM-DD"),
                InvoiceId: Inv.id,
                VoucherId: Voucher.id,
              },
              { transaction: t, silent: true }
            );

            invoiceList.push(Inv.id);
          }
        }

        await Vouchers.update(
          { invoices: invoiceList.join(", ") + "," },
          { where: { id: Voucher.id }, transaction: t }
        );

        await t.commit(); // ✅ commit successful voucher
        success.push(voucher.VoucherNo);
      } catch (err) {
        console.error(`❌ Failed to import voucher ${voucher.VoucherNo}`, err);
        await t.rollback(); // ❌ rollback only this voucher
        failed.push({ voucherNo: voucher.VoucherNo, error: err.message });
      }
    }

    res.json({
      status: "completed",
      successCount: success.length,
      failedCount: failed.length,
      failed,
    });
  } catch (e) {
    console.error("❌ Fatal error:", e);
    res.status(500).json({ status: "error", error: e.message });
  }
});


routes.post("/importV", async (req, res) => {
  try{
    const accounts = await Child_Account.findAll({ include: Parent_Account });
    const accountMap = new Map();
    accounts.forEach((a) => {
      const companyId = a.Parent_Account?.CompanyId;
      if (companyId) {
        accountMap.set(`${a.title}-${companyId}`, { id: a.id, subCategory: a.subCategory });
      }
    });
    for (let voucher of req.body.records) {
      let party_Id = 0;
      let party_Name = "";
    
      const companyId = voucher.VoucherNo.includes("SNS") ? 1 : 3;
      const headCOA = voucher.GL_Voucher_Detail[0].GL_COA;
      
      accounts.forEach((account) => {
        if (headCOA?.AccountName === account.title && account.Parent_Account?.CompanyId === companyId) {
          party_Id = account.id;
          party_Name = account.title;
        }
      });
    
      try {
        // console.log(voucher.VoucherNo);
        let v = {
          voucher_No: voucher.VoucherNo.split("-")[2].split("/")[0].replace(/^0+/, ""),
          voucher_Id: voucher.VoucherNo,
          type: voucher.GL_VoucherType.VoucherType,
          vType: voucher.GL_VoucherType.TypeCode,
          currency: voucher.GL_Currencies?.CurrencyCode ?? "PKR",
          exRate: voucher.ExchangeRate,
          costCenter: "KHI",
          partyId: party_Id,
          partyName: party_Name,
          partyType: headCOA?.GL_COASubCategory?.SubCategory || "client",
          CompanyId: companyId,
          voucherNarration: voucher.Narration,
          createdAt: moment(voucher.AddOn),
          updatedAt: voucher.EditOn?moment(voucher.EditOn):moment(voucher.AddOn)
        };

        const temp = await Vouchers.findOne({
          where: {
            voucher_Id: v.voucher_Id
          }
        })

        if(!temp){
          const result3 = await Vouchers.create(v, { silent: true });
      
          for (let vh of voucher.GL_Voucher_Detail) {
            let CAID = 0;
            const type = vh.CreditLC !== 0 ? "credit" : "debit";
      
            const accountKey = `${vh.GL_COA?.AccountName}-${companyId}`;
            if (accountMap.has(accountKey)) {
              CAID = accountMap.get(accountKey).id;
            } else {
              console.warn(`⚠️ No matching account for: ${vh.GL_COA?.AccountName}`);
            }
            let accountType = ""
            switch(true){
            case vh.GL_COA.GL_COASubCategory.SubCategory.includes("Customer"):
              accountType = "partyAccount"
              break;
              
            case vh.GL_COA.GL_COASubCategory.SubCategory.includes("Vendor"):
              accountType = "partyAccount"
              break;
  
            case vh.GL_COA.GL_COASubCategory.SubCategory.includes("Bank"):
              accountType = "payAccount"
              break;
  
            case vh.GL_COA.GL_COASubCategory.SubCategory.includes("Cash"):
              accountType = "payAccount"
              break;
  
            case vh.GL_COA.AccountName.includes("EX-CHANGE RATE GAIN / LOSS"):
              accountType = "Gain/Loss Account"
              break;
  
            case vh.GL_COA.AccountName.includes("TAX"):
              accountType = "Tax Account"
              break;
  
            default:
              accountType = "Adjust Charges Account"
              break;
          }
      
            const voucher_head = {
              defaultAmount: type === "debit" ? vh.DebitLC : vh.CreditLC,
              amount: type === "debit" ? vh.DebitVC : vh.CreditVC,
              type,
              narration: voucher.Narration,
              accountType: accountType,
              VoucherId: result3.dataValues.id,
              ChildAccountId: CAID,
              createdAt: result3.createdAt,
              updatedAt: result3.updatedAt
            };
      
            await Voucher_Heads.create(voucher_head, { silent: true });
          }
        }else{
          console.log("Exists: ", v.voucher_Id)
        }
    
      } catch (e) {
        console.error("❌ Failed to import voucher:", voucher.VoucherNo, e);
      }
    }
    
    res.status(200).json({ status: "success", message: "All vouchers imported." });
    
  }catch(e){
    console.error("Error", e)
    res.status(500).json({ status: "error", result: e})
  }
});

routes.post("/importI", async (req, res) => {
  try{
    const data = req.body.records

    console.log(data.length)

    const accounts = await Child_Account.findAll({ include: Parent_Account });
    const accountMap = new Map();
    accounts.forEach((a) => {
      const cID = a.Parent_Account?.CompanyId;
      if (cID) {
        accountMap.set(`${a.title}-${cID}`, { id: a.id, subCategory: a.subCategory });
      }
    });

    for(let I of data){
      // console.log(I.InvoiceNumber)

      let CAID = 0;
      let companyId = I.InvoiceNumber.includes("SNS") ? 1 : 3;
      
      const accountKey = `${I.GL_Voucher.GL_Voucher_Detail[0].GL_COA?.AccountName}-${companyId}`;

      if (accountMap.has(accountKey)) {
        CAID = accountMap.get(accountKey).id;
      } else {
        console.warn(`⚠️ No matching account for: ${vh.GL_COA?.AccountName}`);
      }

      let savedInvoice = await Invoice.findOne({where:{climaxId:I.Id.toString()}})
      
      if(!savedInvoice){
        console.log(I.InvoiceNumber)
        let i = I
        let invoiceiType = ""
        let invoicePayType = ""
        let invoiceOperation = ""
        let partyCode = 0
        if(I.InvoiceNumber.includes("JI")){
          invoiceiType = "Job Invoice"
          invoicePayType = "Recievable"
          invoiceOperation = "JI"
        }
        if(I.InvoiceNumber.includes("JB")){
          invoiceiType = "Job Bill"
          invoicePayType = "Payble"
          invoiceOperation = "JB"
        }
        if(I.InvoiceNumber.includes("AI")){
          invoiceiType = "Agent Invoice"
          if(I.GL_InvMode.ModeType == "Receivable"){
            invoicePayType = "Recievable"
          }else{
            invoicePayType = "Payble"
          }
          invoiceOperation = "AI"
        }


        if(i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("RECEIVABLE") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("ASSETS") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LIABILITIES") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LAIBILITY")){
          partyCode = i.GL_Voucher.GL_Voucher_Detail[0].COAAccountId
          // partyName = i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.AccountName
        }else{
          partyCode = i.GL_Voucher.GL_Voucher_Detail[1].COAAccountId
          // partyName = i.GL_Voucher.GL_Voucher_Detail[1].GL_COA.AccountName
        }

        const account = await Child_Account.findOne({
          where: { code: partyCode.toString() },
        })

        let ipartyType = ''

        // if(CP.VendorId == job.ClientId){
        //   ipartyType = "client"
        // }else if(CP.VendorId == job.ConsigneeId){
        //   ipartyType = "client" 
        // }else if(CP.VendorId == job.ShipperId){
        //   ipartyType = "client"
        // }else if(CP.VendorId == job.OverseasAgentId){
        //   ipartyType = "agent"
        // }else{
        //   ipartyType = "vendor"
        // }

        let CA = null

        if(account){
          if(ipartyType == "client"){
            CA = await Client_Associations.findOne({
              where: {
                ChildAccountId: account.id
              }
            })
          }else{
            CA = await Vendor_Associations.findOne({
              where: {
                ChildAccountId: account.id
              }
            })
          }
          
          if(!CA){
            CA = await Client_Associations.findOne({
              where: {
                ChildAccountId: account.id
              }
            })
            if(!CA){
              CA = await Vendor_Associations.findOne({
              where: {
                ChildAccountId: account.id
              }
            })
            }
          }
        }


        let inv = {
          invoice_No: i.InvoiceNumber,
          invoice_Id: i.InvoiceNumber.split("-")[2].split("/")[0].replace(/^0+/, ""),
          type: invoiceiType,
          payType: invoicePayType,
          status: '1',
          operation: invoiceOperation,
          currency: i.GL_Currencies.CurrencyCode,
          ex_rate: i.ExchangeRate,
          party_Id: ipartyType == "client" ? CA.ClientId : CA.VendorId,
          party_Name: account.title,
          paid: 0,
          recieved: 0,
          roundOff: '0',
          total: i.InvoiceAmount,
          approved: '1',
          companyId: companyId,
          partyType: ipartyType,
          note: i.Remarks,
          createdAt: moment(i.invoiceDate) || moment().format("YYYY-MM-DD"),
          updatedAt: i.invoiceDate?moment(i.invoiceDate):moment(i.invoiceDate) || moment().format("YYYY-MM-DD"),
          // SEJobId: savedJob.id,
          climaxId: i.Id
        }
        savedInvoice = await Invoice.create(inv, {silent: true});

        // if(!invoice){
        //   savedCP.update({InvoiceId:savedInvoice.id})
        // }

        let p
        if(i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LIABILITIES") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LAIBILITY")){
          // console.log("------Vendor------")
          let temp = await Vendor_Associations.findOne({
            where: {
              CompanyId: companyId,
              ChildAccountId: CAID
            }
          })
          if(temp){
            p = await Vendors.findOne({
              where: {
                id: temp.VendorId
              }
            })
          }
          if(!p){
            let temp = await Client_Associations.findOne({
              where: {
                CompanyId: companyId,
                ChildAccountId: CAID
              }
            })
            if(temp){
              p = await Clients.findOne({
                where: {
                  id: temp.ClientId
                }
              })
            }
          }
        }else{
          // console.log("------Client------")
          let temp = await Client_Associations.findOne({
            where: {
              CompanyId: companyId,
              ChildAccountId: CAID
            }
          })
          if(temp){
            p = await Clients.findOne({
              where: {
                id: temp.ClientId
              }
            })
          }
          if(!p){
            let temp = await Vendor_Associations.findOne({
              where: {
                CompanyId: companyId,
                ChildAccountId: CAID
              }
            })
            if(temp){
              p = await Vendors.findOne({
                where: {
                  id: temp.VendorId
                }
              })
            }
          }
        }
        if(!p){
          // console.log(party)
          console.warn(`⚠️ No matching party for: ${i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.AccountName} CAID: ${CAID} CompanyId: ${companyId} Parent: ${i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName}`);
        }

        let vch = await Vouchers.create({
          voucher_No: i.GL_Voucher.VoucherNo.split("-")[2].split("/")[0].replace(/^0+/, ""),
          voucher_Id: i.GL_Voucher.VoucherNo,
          type: i.GL_Voucher.GL_VoucherType.VoucherType,
          vType: i.GL_Voucher.GL_VoucherType.TypeCode,
          currency: i.GL_Voucher.GL_Currencies?.CurrencyCode ?? "PKR",
          exRate: i.GL_Voucher.ExchangeRate,
          chequeNo: i.GL_Voucher.GL_Voucher_Detail[0].ChequeNumber,
          chequeDate: i.GL_Voucher.GL_Voucher_Detail[0].ChequeDate,
          voucherNarration: i.GL_Voucher.Narration,
          costCenter: "KHI",
          onAccount: i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") ? 'vendor' : 'client',
          partyId: p.id,
          partyName: p.name,
          partyType: i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") ? 'vendor' : 'client',
          tranDate: i.GL_Voucher.VoucherDate,
          createdBy: i.GL_Voucher.AddLog,
          createdAt: moment(i.GL_Voucher.AddOn),
          updatedAt: i.GL_Voucher.EditOn?moment(i.GL_Voucher.EditOn):moment(i.GL_Voucher.AddOn) || moment().format("YYYY-MM-DD"),
          CompanyId: companyId,
          invoice_Id: savedInvoice.id
        }, {silent: true});

        for(let vh of i.GL_Voucher.GL_Voucher_Detail){
          let Voucher_Head = {
            defaultAmount: vh.DebitLC == 0 ? vh.CreditLC : vh.DebitLC,
            amount: vh.DebitVC == 0 ? vh.CreditVC : vh.DebitVC,
            type: vh.DebitLC == 0 ? "credit" : "debit",
            narration: vh.NarrationVD,
            accountType: vh.GL_COA.GL_COASubCategory.SubCategory,
            createdAt: vch.createdAt,
            updatedAt: vch.updatedAt || moment().format("YYYY-MM-DD"),
            VoucherId: vch.id,
            ChildAccountId: accountMap.get(`${vh.GL_COA.AccountName}-${companyId}`).id,
          }
          await Voucher_Heads.create(Voucher_Head, {silent: true});
        }
      }
    }
    res.json({status:'success', result: req.body});
  }catch(e){
    console.error("Error", e)
    res.status(500).json({ status: "error", result: e})
  }
})

module.exports = routes;