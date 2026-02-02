const { Charge_Head, Invoice, Invoice_Losses, Invoice_Transactions } = require("../../functions/Associations/incoiceAssociations");
const { SE_Job, SE_Equipments, Bl, Container_Info ,Commodity} = require("../../functions/Associations/jobAssociations/seaExport");
const { Child_Account, Parent_Account } = require("../../functions/Associations/accountAssociations");
const { Access_Levels, Employees } = require("../../functions/Associations/employeeAssociations");
const { Vouchers, Voucher_Heads } = require("../../functions/Associations/voucherAssociations");
// const { Vendor_Associations } = require("../../functions/Associations/vendorAssociations");
const { Client_Associations } = require("../../functions/Associations/clientAssociation");
// const { Vendors } = require("../../functions/Associations/vendorAssociations");
const { Voyage } = require('../../functions/Associations/vesselAssociations');
const { Clients } = require("../../functions/Associations/clientAssociation");
const { Accounts, Vessel, Transaction } = require("../../models");
const routes = require('express').Router();
const Sequelize = require('sequelize');
const moment = require("moment");
const { Client } = require("pg");
const Op = Sequelize.Op;

const numCPUs = require('os').cpus().length;
// Invoice statuses
// 1 = unpaid
// 2 = paid
// 3 = not fully paid

const chardHeadLogic = (currency) => {
  let result = { };
  if(currency!=undefined){
    result = { currency:currency }
  }
  return result;
};

routes.post("/approveCharges", async(req, res) => {
  try {
    let tempIds = [];
    req.body.forEach((x) => { tempIds.push(x.InvoiceId) });

    const lastJB = await Invoice.findOne({ where:{type:'Job Bill'}, order: [[ 'invoice_Id', 'DESC' ]], attributes:["invoice_Id"]});
    const lastJI = await Invoice.findOne({ where:{type:'Job Invoice'}, order: [[ 'invoice_Id', 'DESC' ]], attributes:["invoice_Id"]});
    const lastAI = await Invoice.findOne({ where:{type:'Agent Invoice'}, order: [[ 'invoice_Id', 'DESC' ]], attributes:["invoice_Id"]});
    const lastAB = await Invoice.findOne({ where:{type:'Agent Bill'}, order: [[ 'invoice_Id', 'DESC' ]], attributes:["invoice_Id"]});

    let result = await Invoice.findAll({where:{id:tempIds}});
    let vouchers = [];
    result.forEach(async(x, i) => {
      if(x.status=='0' && x.type=='Job Bill'){
        result[i].status="1"
        result[i].invoice_Id= lastJB.invoice_Id==null?1: parseInt(lastJB.invoice_Id)+1;
        result[i].invoice_No=lastJB.invoice_Id==null?
        `SNS-JB-${1}/${moment().format("YY")}`:
        `SNS-JB-${ parseInt(lastJB.invoice_Id)+1}/${moment().format("YY")}`
      }
      if(x.status=='0' && x.type=='Job Invoice'){
        result[i].status="1"
        result[i].invoice_Id= lastJI.invoice_Id==null?1: parseInt(lastJI.invoice_Id)+1;
        result[i].invoice_No=lastJI.invoice_Id==null?
        `SNS-JI-${1}/${moment().format("YY")}`:
        `SNS-JI-${ parseInt(lastJI.invoice_Id)+1}/${moment().format("YY")}`
      }
      if(x.status=='0' && x.type=='Agent Invoice'){
        result[i].status="1"
        result[i].invoice_Id= lastAI.invoice_Id==null?1: parseInt(lastAI.invoice_Id)+1;
        result[i].invoice_No=lastAI.invoice_Id==null?
        `SNS-AI-${1}/${moment().format("YY")}`:
        `SNS-AI-${ parseInt(lastAI.invoice_Id)+1}/${moment().format("YY")}`
      }
      if(x.status=='0' && x.type=='Agent Bill'){
        result[i].status="1"
        result[i].invoice_Id= lastAB.invoice_Id==null?1: parseInt(lastAB.invoice_Id)+1;
        result[i].invoice_No=lastAB.invoice_Id==null?
        `SNS-AB-${1}/${moment().format("YY")}`:
        `SNS-AB-${ parseInt(lastAB.invoice_Id)+1}/${moment().format("YY")}`
      }
    })

    await res.json({status: 'success', result: result});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

routes.post("/updateCharges", async(req, res) => {
  try {
    req.body.invoice.forEach(async(x)=>{
      await Invoice.update(x,{where:{id:x.id}})
      req.body.charges.forEach(async(y)=>{
        if(x.type==y.invoiceType && y.InvoiceId==x.id){
          await Charge_Head.update({...y, invoice_id:x.invoice_No, status:"1"},{where:{id:y.id}})
        }
      })
    });
    await res.json({status: 'success', result: 'result'});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
}); 

routes.post("/saveHeades", async(req, res) => {

  const makeHeads = (data, id) => {
    let result = [];
    data.forEach((x, i)=>{
      result.push({...x, InvoiceId:id})
    });
    return result
  }
  try {
    await Charge_Head.destroy({where:{id:req.body.deleteList}})
    let tempData = [...req.body.invoices];
    const prevInv = await Invoice.findAll({where:{SEJobId:req.body.invoices[0].SEJobId}});
    let tempPrevVal = [];
    prevInv.forEach((z)=>{
      tempPrevVal.push(z.dataValues)
    })
    tempData.forEach((x, i)=>{
      tempData[i].partyType=x.charges[0].partyType;  //<-- Defines The PartyType From Charge Head to Invoice
      tempPrevVal.forEach((y, j)=>{
        if(x.party_Id==y.party_Id && x.type==y.type){
          tempData[i].id=y.id;
          tempPrevVal.splice(j, 1);
        }
      })
    })
    req.body.invoices = tempData;
    for(let i = 0; i<req.body.invoices.length;i++){
      if(req.body.invoices[i].id==null){
        const result = await Invoice.create(req.body.invoices[i]);
        await Charge_Head.bulkCreate(makeHeads(req.body.invoices[i].charges, result.id))
      }

      if(req.body.invoices[i].id!=null){
        for(let j = 0; j<req.body.invoices[i].charges.length;j++){
          //await Invoice.update({req.body.invoices[i], where:{ id:invoices[i].id }});
          await Invoice.update({currency:req.body.invoices[i].currency},{where:{id:req.body.invoices[i].id}});

          if(req.body.invoices[i].charges[j].id!=null){
            await Charge_Head.update(req.body.invoices[i].charges[j], {where:{id:req.body.invoices[i].charges[j].id}})
          }else{
            let val = {...req.body.invoices[i].charges[j], InvoiceId:req.body.invoices[i].id}
            await Charge_Head.create(val);
          }
        }
      }
    }
    res.json({status:'success'});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.get("/getJobInvoices", async(req, res) => {
  try {
    const result = await Invoice.findAll({
      where:{SEJobId:req.headers.id},
      include:[{
        model:Charge_Head,
      }]
    })
    res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getFilteredInvoices", async(req, res) => {
  try {
    console.log("Invoice Type: ", req.headers.type)
    const result = await Invoice.findAll({
      where:{type:req.headers.type},
      attributes:['id', 'invoice_No', 'status', 'operation', 'currency', 'ex_rate', 'party_Name', 'total', 'partyType', 'approved'],
      include:[
      { model:SE_Job, required: false, attributes:['jobNo'] },
      {
        model:Charge_Head,
        required: false,
        attributes:['charge'],
        where:{charge:{ [Op.ne]: null }}
      }]
    })
    res.json({status:'success', result:result});
  } catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.get("/getInvoiceByNo", async(req, res) => {
  try {
      const attr = [
        'name', 'address1', 'address1', 'person1', 'mobile1',
        'person2', 'mobile2', 'telephone1', 'telephone2', 'infoMail'
      ];
      console.log("Invoice Id: ", req.headers.invoiceno)
      const resultOne = await Invoice.findOne({
        where:{invoice_No:req.headers.invoiceno.toUpperCase()},
        include:[
          { model:Charge_Head },
          {
            model:SE_Job,
            attributes:[
              'jobNo', 'jobDate', 'shipDate', 'pol', 'pod', 'fd', 'vol', 
              'weight', 'pcs', 'flightNo', 'cwtClient', 'cwtLine', 'eta',
              'etd', 'arrivalDate', 'departureDate', 'customerRef'
            ],
            //attributes:['id'],
            include:[
              { model:SE_Equipments , attributes:['qty', 'size'] },
              { 
                model:Bl , attributes:['mbl', 'hbl'],
                include:[{model:Container_Info, attributes:['no']}]
              },
              { model:Voyage , attributes:['voyage', 'importArrivalDate', 'exportSailDate'] },
              { model:Clients, attributes:attr },
              { model:Clients, as:'consignee', attributes:attr },
              { model:Clients, as:'shipper', attributes:attr },
              { model:Clients, as:'shipping_line', attributes:attr },
              { model:Employees, as:'sales_representator', attributes:['name'] },
              { model:Vessel, as:'vessel', attributes:['carrier', 'name'] },
              { model:Clients, as:'air_line', attributes:['name'] },
              { model:Commodity, as:'commodity', attributes:['name'] },
              //{ model:Voyage },
            ]
          },
        ],
        order: [
          [{ model: Charge_Head }, 'id', 'ASC'],
        ]
      })
      // console.log(resultOne)
      res.json({status:'success', result:{ resultOne }});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getInvoiceById", async(req, res) => {
  try {
      const attr = [
        'name', 'address1', 'address1', 'person1', 'mobile1',
        'person2', 'mobile2', 'telephone1', 'telephone2', 'infoMail'
      ];
      console.log("Invoice Id: ", req.headers.invoiceid)
      const resultOne = await Invoice.findOne({
        where:{id:{ [Op.eq]: req.headers.invoiceid }},
        include:[
          { model:Charge_Head },
          {
            model:SE_Job,
            attributes:[
              'jobNo', 'jobDate', 'shipDate', 'pol', 'pod', 'fd', 'vol', 'weight', 'pcs', 'flightNo', 'cwtClient', 'cwtLine', 'departureDate', 'customerRef'
            ],
            //attributes:['id'],
            include:[
              { model:SE_Equipments , attributes:['qty', 'size'] },
              { 
                model:Bl , attributes:['mbl', 'hbl'],
                include:[{model:Container_Info, attributes:['no']}]
              },
              { model:Voyage , attributes:['voyage', 'importArrivalDate', 'exportSailDate'] },
              { model:Clients, attributes:attr },
              { model:Clients, as:'consignee', attributes:attr },
              { model:Clients, as:'shipper', attributes:attr },
              { model:Clients, as:'shipping_line', attributes:attr },
              { model:Employees, as:'sales_representator', attributes:['name'] },
              { model:Vessel, as:'vessel', attributes:['carrier', 'name'] },
              { model:Clients, as:'air_line', attributes:['name'] },
              //{ model:Voyage },
            ]
          },
        ],
        order: [
          [{ model: Charge_Head }, 'id', 'ASC'],
        ]
      })
      console.log(resultOne)
      res.json({status:'success', result:{ resultOne }});
    }
    catch (error) {
      res.json({status:'error', result:error});
      console.log(error)
    }
});

routes.get("/testResetSomeInvoices", async(req, res) => {
  try {

    const result = await Invoice.findAll({
      where:{
        id:[
          '965107244473122817', '965107244473253889', '965107244473286657', '965107244473319425', '965107244473450497', '965107244473483265', '965107244473516033', '965107244473548801', '965107244473581569', '965107244473614337', 965107244473909249,
          '965107244471975937', '965107244472008705', '965107244472172545', '965107244472500225', '965107244472532993', '965107244472565761', '965107244472598529', '965107244472631297', '965107244472827905', '965107244472991745',
          '965107244471353345', '965107244471418881', '965107244471451649', '965107244471484417', '965107244471615489', '965107244471648257', '965107244471713793', '965107244471844865', '965107244471877633', '965107244472041473'
        ]
      }
    });

    res.json({ status:'success', result:result });
  } catch (error) {

    res.json({status:'error', result:error});
  }
});

routes.get("/getAllInvoicesByPartyId", async(req, res) => {
  try {
    console.log("Header", req.headers)
    console.log("Body", req.body)
    // account = Client_Associations;
    // acc = await account.findOne({
    //   where: {
    //     ClientId: req.headers.id
    //   }
    // });
    // console.log(acc.dataValues.ChildAccountId)
    let obj = {}
    if(req.headers.type != "agent"){
      obj = {
        payType: req.headers.pay
      };

    }
    let account
    account = await Client_Associations.findOne({
      where:{
        ClientId: parseInt(req.headers.id)
      }
    })
    console.log("Account:", account)
    const result = await Invoice.findAll({
      where:{
        approved:"1",
        party_Id: account.ChildAccountId.toString(),
        currency: req.headers.invoicecurrency,
        companyId: req.headers.companyid,
        ...obj
      },
      include:[
        {
          model:Invoice_Transactions
        },
        {
          model:SE_Job,
          // attributes:['jobNo', 'subType', 'id', 'operation'],
          include:[
            { model:SE_Equipments, attributes:['qty', 'size'] },
            { model:Bl, required: false, attributes:['mbl', 'hbl'] },
          ]
        }
      ]
    })
    // console.log("Result",result)
    if(req.headers.edit==false){
    }
    res.json({status:'success', result:result});
  } catch (error) {
    console.log(error)
    res.json({status:'error', result:error});
  }
});

routes.get("/getAllOldInvoicesByPartyId", async(req, res) => {
  try {
    const result = await Invoice.findAll({
      where:{
        approved:"1",
        party_Id:req.headers.id,
        payType:req.headers.pay,
        status:"2",
        //...chardHeadLogic(req.headers.invoicecurrency)
      },
      attributes:['id','invoice_No', 'invoice_Id', 'recieved', 'paid', 'status', 'total', 'currency', 'roundOff', 'party_Id'],
      order:[['invoice_Id', 'ASC']],
      include:[
        {
          model:SE_Job,
          attributes:['jobNo', 'subType']
        },
        {
          model:Charge_Head,
          attributes:['net_amount', 'local_amount', 'currency', 'ex_rate']
        }
      ]
    });
    let partyAccount = null;
    if(result.length>0){
      if(req.headers.party=="vendor"||req.headers.party=="agent"){
        partyAccount = await Vendor_Associations.findAll({
          where:{
            VendorId:result[0].party_Id,
            CompanyId:req.headers.companyid  //<-- I'm Unsure About This 
          },
          include:[
            {
              model:Child_Account,
              include:[
                { 
                  model:Parent_Account,
                  where:{ 
                    title:req.headers.pay=="Recievable"?
                      "ACCOUNT RECEIVABLE":
                      "ACCOUNT PAYABLE" 
                  }
                }
              ]
            }
          ]
        })
      } else if(req.headers.party=="agent"){
        partyAccount = await Vendor_Associations.findAll({
          where:{
            VendorId:result[0].party_Id,
            CompanyId:req.headers.companyid  //<-- I'm Unsure About This 
          },
          include:[
            { model:Child_Account,
              include:[
                { model:Parent_Account, where:{ title:req.headers.pay=="Recievable"?"ACCOUNT RECEIVABLE":"ACCOUNT PAYABLE" } }
              ]
            }
          ]
        })
      } else {
        partyAccount = await Client_Associations.findAll({
          where:{ ClientId:result[0].party_Id, CompanyId:req.headers.companyid },
          include:[
            {
              model:Child_Account,
              include:[
                { model:Parent_Account, where:{ title:req.headers.pay=="Recievable"?"ACCOUNT RECEIVABLE":"ACCOUNT PAYABLE" } }
              ]
            }
          ]
        });
      }
    }
      res.json({ status:'success', result:result, account:partyAccount });
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/deleteInvoice", async(req, res) => {
  try{
    const invoice = await Invoice.findOne({where:{id:req.headers.id}})
    await Charge_Head.update(
      { invoice_id: null, status: 0 },
      { where: { invoice_id: invoice.dataValues.invoice_No } }
    );
    await Invoice.destroy({where:{id:req.headers.id}})
    res.json({status:'success'});
  }catch(error){
    console.error(error)
    res.json({status:'error', result:error});
  }
});

routes.get("/dateExperiment", async(req, res) => {
  try {
    const from = moment("2023-02-23");
    const to = moment("2023-02-25");
    const resultOne = await Invoice.findAll({
      where:{
        createdAt: {
          [Op.gte]: from.toDate(),
          [Op.lte]: to.toDate(),
          }
      },
      order: [[ 'createdAt', 'ASC' ]]
    });
    res.json({status:'success', result:{ resultOne }});
    }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.get("/getTransaction", async(req, res) => {
  try {
    let { history, offset, type } = req.headers;
    const count = await Vouchers.count({
      where:{ [Op.or]: [{type: 'Job Reciept'}, {type:'Job Payment'}] },
      });
    if (history=="false" & (type=="front" || type=="last")){
      offset = count - 1;
    } else if(history=="false" & (type=="first" || type=="back")){
      offset = 0
    }
    const result = await Vouchers.findAll({
      limit:1, offset:offset, where:{ [Op.or]: [{type: 'Job Reciept'}, {type:'Job Payment'}] },
    })
    // let ids = result[0].dataValues.invoices.split(", ")
    // const invoices = await Invoice.findAll({
    //   where:{id:ids},
    //   include:[{model:SE_Job, attributes:['jobNo', 'subType']}]
    // })
    await res.json({status: 'success', result:{result:result[0], count, offset}});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

routes.get("/getAllInvoices", async(req, res) => {
  try{
    const account = req.headers.type == "client" ? Client_Associations : Vendor_Associations;
    // const obj = req.headers.type == "Client" ? { ClientId: parseInt(req.headers.id) } : { VendorId: parseInt(req.headers.id) };
    const acc = await account.findOne({
      where: {
        CompanyId: req.headers.companyid,
        ChildAccountId: parseInt(req.headers.id),
      },
    });
    const ClientId = req.headers.type == "client" ?acc.dataValues.ClientId.toString() : acc.dataValues.VendorId.toString()
    const result = await Invoice.findAll({
      where: {
        party_Id: ClientId,
        payType: req.headers.paytype,
        id: { [Op.ne]: req.headers.invoiceid }
      },
      include: [
        {
          model: Invoice_Transactions, // Add any desired attributes for Invoice_Transactions
        },
        {
          model: SE_Job,
          attributes: ['id', 'jobNo', 'subType'],
          include: [
            {
              model: Bl,
              attributes: ['hbl', 'mbl'],
              include: [
                {
                  model: Container_Info,
                  attributes: ['no']
                }
              ]
            }
          ]
        }
      ]
    });
    res.json({status: 'success', result: result});
  }catch(error){
    console.log(error)
    res.json({status: 'error', result: error});
  }
})

routes.post("/createInvoiceTransaction", async(req, res) => {
  try {
    req.body.invoices.forEach(async(x) => {
      Invoice.update(x, {where:{id:x.id}});
    })
    req.body.invoiceLosses.forEach(async(y)=>{
      Invoice_Transactions.upsert(y)
    })
    res.json({status: 'success', result: 'result'});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// round off an invoice
routes.post("/roundOffInv", async(req, res) => {
  try {
    await Invoice.update({ roundOff:req.body.roundOff }, { where:{id:req.body.id} });
    await res.json({status: 'success', result: 'result'});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// Approve or disapprove an invoice
routes.post("/invApproveDisapp", async(req, res) => {
  try {
    await Invoice.update({ total:req.body.total, approved:req.body.approved, ex_rate:req.body.exRate, status:"1" }, { where:{id:req.body.id} });
    await res.json({status: 'success', result: 'result'});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// Adds a note to invoice and also the currency
routes.post("/addInvoiceNote", async(req, res) => {
  try {
    await Invoice.update({ note:req.body.note, currency:req.body.currency, total: req.body.total}, { where:{id:req.body.id} });
    await res.json({status: 'success', result: 'result'});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

routes.post("/saveChargeHeades", async(req, res) => {
  try {
    await Charge_Head.destroy({where:{id:req.body.deleteList}})
    await SE_Job.update({exRate:req.body.exRate}, {where:{id:req.body.id}})
    await Promise.all([
      req.body.charges.forEach((x) => {
        Charge_Head.upsert(x);
      })
    ]);
    res.json({status:'success'});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

// This api saves the heads added on the related Job
routes.post("/saveHeadesNew", async(req, res) => {
  try {
    req?.body?.deleteList != undefined? await Charge_Head.destroy({where:{id:req.body.deleteList}}) : null;
    req?.body?.id != undefined? await SE_Job.update({exRate:req.body.exRate}, {where:{id:req.body.id}}) : null;

    let data;
    await req.body.charges.forEach(async(x) => {
      data = await Charge_Head.upsert(x);
    });
    res.json({status:'success'});
  }
  catch (error) {
    console.log(error)
    res.json({status:'error', result:error});
  }
});

// This api shows the heads added on the related Job
routes.get("/getHeadesNew", async(req, res) => {
  try {
    const result = await Charge_Head.findAll({
      where: { SEJobId: req.headers.id },
      include: [
        {
          model: Invoice,
          attributes: ['id', 'status', 'approved'],
          include: {
            model: Invoice_Transactions,
            // include: {
            //   model: Vouchers,
            //   include: {
            //     model: Voucher_Heads
            //   }
            // }
          }
        }
      ],
      order: [['id', 'ASC']] // or 'DESC' if you want descending
    });
    // console.log(result[0].dataValues.Invoice.dataValues.Invoice_Transactions[0].dataValues)
    res.json({status:'success', result});
  }
  catch (error) {
    console.error(error)
    res.json({status:'error', result:error});
  }
});

// This function is used in the API below helps to set invoice number according to the last generated invoice with fiscal year
const createInvoices = async (lastJB, init, type, companyId, operation, x) => {
  try{
    // console.log("Make Transaction:",x)
    let company = '';
    let inVoiceDeleteList = []
    let account = await Client_Associations.findOne({
      where:{
        // CompanyId: companyId,
        ClientId: x.partyId
      }
    })
    if(account == null){
      account = await Vendor_Associations.findOne({
        where: {
          CompanyId: companyId,
          VendorId: x.partyId
        }
      })
    }
    console.log("Account:",account)
    if(lastJB?.Charge_Heads?.length==0){
      inVoiceDeleteList.push(lastJB.id)
    }
    let addition = lastJB?.Charge_Heads?.length==0?0:1;
    company = companyId=='1'?"SNS":companyId=='2'?"CLS":"ACS";
    let result = {
      invoice_No:(lastJB==null || lastJB.invoice_Id==null)?`${company}-${init}-${1}/${moment().add(1, 'years').format("YY")}`:`${company}-${init}-${parseInt(lastJB.invoice_Id)+parseInt(addition)}/${moment().add(1, 'years').format("YY")}`,
      invoice_Id: (lastJB==null || lastJB.invoice_Id==null)?1: parseInt(lastJB.invoice_Id)+parseInt(addition),
      type:type,
      status: "1",
      companyId:companyId,
      operation:operation,
      payType: x.type,
      party_Id: account.ChildAccountId,
      party_Name: x.name,
      SEJobId: x.SEJobId,
      currency:(init=="JB"||init=="JI")?'PKR':x.currency,
      ex_rate:x.ex_rate,
      partyType:x.partyType,
    }
    // console.log("Result:",result)
    Invoice.destroy({where:{id:inVoiceDeleteList}})
    return result;
  }catch(e){
    console.error(e)
  }
  
};

routes.get("/getAllInvoiceData", async(req, res) => {
  try{
    console.log("Invoice ID:",req.headers)
    const InvTran = await Invoice_Transactions.findAll({
      where:{InvoiceId:req.headers.id}
    })

    let vouchers = []
    for(let x of InvTran){
      const voucher = await Vouchers.findOne({
        where:{
          id:x.dataValues.VoucherId
        }
      });
      vouchers.push(voucher.dataValues)
    }

    // let heads = []
    // console.log("party_id:", req.headers.party_id)
    // for(let x of vouchers){
    //   let party = await Client_Associations.findOne({
    //     where:{ClientId:req.headers.party_id}
    //   })
    //   console.log("Client Id:", party.ChildAccountId)
    //   const head = await Voucher_Heads.findAll({
    //     where: {
    //       VoucherId: x.id,
    //       ChildAccountId: party.ChildAccountId,
    //       narration: {
    //         [Op.notLike]: '%Ex-Rate%'
    //       }
    //     }
    //   });
    //   head.forEach((y)=>{
    //     heads.push(y.dataValues)
    //   })
    // }
    
    // console.log("party_id:", req.headers.party_id);

    const heads = [];

    const rawPartyId = req.headers.party_id;
    // Coerce to number if numeric, else keep as-is (depends on your schema)
    const partyId = isNaN(Number(rawPartyId)) ? rawPartyId : Number(rawPartyId);

    for (const x of vouchers) {
      // Find association for this party (once per iteration; can be moved out if same for all vouchers)
      const partyAssoc = await Client_Associations.findOne({
        where: { ClientId: partyId },
        attributes: ['ChildAccountId']
      });

      // Build a unique list of candidate ChildAccountIds to check
      const candidateChildIds = Array.from(new Set(
        [partyId, partyAssoc?.ChildAccountId].filter(Boolean)
      ));

      console.log("Candidate ChildAccountIds:", candidateChildIds);

      const head = await Voucher_Heads.findAll({
        where: {
          VoucherId: x.id,
          ChildAccountId: { [Op.in]: candidateChildIds },
          // If you’re on Postgres and want case-insensitive, use Op.notILike
          narration: { [Op.notLike]: '%Ex-Rate%' }
          // narration: { [Op.notILike]: '%Ex-Rate%' } // Postgres only
        }
      });

      head.forEach((y) => {
        heads.push(y.dataValues);
      });
    }

    res.json({status:'success', result:{InvTran, vouchers, heads}});
  }catch(error){
    console.log(error)
    res.json({status:'error', result:error});
  }
})

// generate new invoice with invoice number (This API generates only invoice numbers)
routes.post("/makeInvoiceNew", async(req, res) => {
  try {
    let result = req.body.chargeList, charges = [], createdInvoice = { };
    const lastJB = await Invoice.findOne({where:{type:'Job Bill'},     order:[['invoice_Id', 'DESC']], attributes:["id","invoice_Id"], include:[{model:Charge_Head, attributes:['id']}]});
    const lastJI = await Invoice.findOne({where:{type:'Job Invoice'},  order:[['invoice_Id', 'DESC']], attributes:["id","invoice_Id"], include:[{model:Charge_Head, attributes:['id']}]});
    const lastAI = await Invoice.findOne({where:{type:'Agent Invoice'},order:[['invoice_Id', 'DESC']], attributes:["id","invoice_Id"], include:[{model:Charge_Head, attributes:['id']}]});
    const lastAB = await Invoice.findOne({where:{type:'Agent Bill'},   order:[['invoice_Id', 'DESC']], attributes:["id","invoice_Id"], include:[{model:Charge_Head, attributes:['id']}]});

    for(let x of result){
      console.log(x)
      if(x.invoiceType=="Job Bill"){
        if(Object.keys(createdInvoice).length==0){
          createdInvoice = await createInvoices(lastJB, "JB", "Job Bill", req.body.companyId, req.body.type, x)
        }
        charges.push({...x, status:"1", invoice_id:createdInvoice.invoice_No })
      }
      if(x.invoiceType=="Job Invoice"){
        if(Object.keys(createdInvoice).length==0){
          createdInvoice = await createInvoices(lastJI, "JI", "Job Invoice", req.body.companyId,req.body.type, x)
        }
        charges.push({...x, status:"1", invoice_id:createdInvoice.invoice_No })
      }
      if(x.invoiceType=="Agent Invoice"){
        if(Object.keys(createdInvoice).length==0){
          createdInvoice = await createInvoices(lastAI, "AI", "Agent Invoice", req.body.companyId,req.body.type, x)
        }
        charges.push({...x, status:"1", invoice_id:createdInvoice.invoice_No })
      }
      if(x.invoiceType=="Agent Bill"){
        if(Object.keys(createdInvoice).length==0){
          createdInvoice = await createInvoices(lastAB, "AB", "Agent Bill", req.body.companyId,req.body.type, x)
        }
        charges.push({...x, status:"1", invoice_id:createdInvoice.invoice_No })
      }
    };
    // console.log("Created Invoice",createdInvoice)
    const newInv = await Invoice.create(createdInvoice);
    // console.log("Invoice Creation",newInv)
    // const newCharges = await charges.map((x)=>{
    //   return{ ...x, InvoiceId:newInv.id }
    // })
    let chargesIds = []
    for(let x of charges){
      let chargeHeads = await Charge_Head.upsert({ ...x, InvoiceId:newInv.id, invoice_id: newInv.invoice_No });
      chargesIds.push(chargeHeads[0].dataValues.id)
    }
    await res.json({status: 'success', result: {chargesIds, newInv}});
  }
  catch (error) {
    console.log(error)
    res.json({status: 'error', result: error});
  }
});

routes.post("/openingInvoice", async(req, res) => {
  try{
    const lastOI = await Invoice.findOne({where:{type:'Opening Invoice'},     order:[['invoice_Id', 'DESC']], attributes:["id","invoice_Id"], include:[{model:Charge_Head, attributes:['id']}]});
    const lastOB = await Invoice.findOne({where:{type:'Opening Bill'},     order:[['invoice_Id', 'DESC']], attributes:["id","invoice_Id"], include:[{model:Charge_Head, attributes:['id']}]});
    // console.log(req.body)
    // console.log(lastOI)
    // console.log(lastOB)
    const invoice = {
      invoice_No: `${req.body.companyId=="1"?'SNS':"ACS"}-${req.body.type}-${req.body.type=="OI"?lastOI!=null?lastOI.invoice_Id+1:1:lastOB!=null?lastOB.invoice_Id+1:1}/${moment().add(1, 'years').format("YY")}`,
      invoice_Id: req.body.type=="OI"?lastOI!=null?lastOI.invoice_Id+1:1:lastOB!=null?lastOB.invoice_Id+1:1,
      type: req.body.type=="OI"?"Opening Invoice":"Opening Bill",
      status: "1",
      operation: req.body.operation,
      currency: req.body.currency,
      ex_rate: req.body.exRate,
      party_Id: req.body.party_Id,
      party_Name: req.body.party_Name,
      paid: 0,
      recieved: 0,
      roundOff: 0,
      total: req.body.amount,
      approved: 0,
      companyId: req.body.companyId,
      createdAt: req.body.date,
      SE_JobId: null,
      payType: req.body.payType,
      partyType: req.body.partyType
    }
    const invoices = await Invoice.create(invoice);
    console.log(invoices.dataValues.createdAt)

    const check = await Vouchers.findOne({
      order: [["voucher_No", "DESC"]],
      attributes: ["voucher_No"],
      where: { vType: invoices.dataValues.payType=="Recievable"?"SI":"PI", CompanyId: invoices.dataValues.companyId }
    });

    vouchers = {
      type:invoices.dataValues.payType=="Recievable"?"Opening Reciept":"Opening Payment",
      vType:invoices.dataValues.payType=="Recievable"?"OI":"OB",
      CompanyId:invoices.dataValues.companyId,
      amount:"",
      currency:invoices.dataValues.currency,
      exRate:invoices.dataValues.ex_rate,
      chequeNo:"",
      payTo:"",
      costCenter:"KHI",
      invoice_Voucher:"1",
      invoice_Id:invoices.dataValues.id,
      partyId: invoices.dataValues.party_Id,
      partyName: invoices.dataValues.party_Name,
      createdAt: invoices.dataValues.createdAt,
      updatedAt: invoices.dataValues.createdAt,
      voucher_No: check == null ? 1 : parseInt(check.voucher_No) + 1,
      voucher_Id: `${invoices.dataValues.companyId == 1 ? "SNS" : invoices.dataValues.companyId == 2 ? "CLS" : "ACS"}-${invoices.dataValues.payType=="Recievable"?"OI":"OB"}-${check == null ? 1 : parseInt(check.voucher_No) + 1}/${moment().month() >= 6 ? moment().add(1, 'year').format('YY') : moment().format('YY')}`
    }

    // console.log("Vouchers>>",vouchers)

    

    const voucher = await Vouchers.create({
      ...vouchers, // Spread your `vouchers` object
      updatedAt: invoices.dataValues.createdAt, // Explicitly set updatedAt to createdAt
    });

    // let expenseAccount
    // req.body.subType == "FCL"?expenseAccount = await Child_Account.findOne({where:{title:"FCL FREIGHT EXPENSE"}, include:[{model:Parent_Account, where:{CompanyId:invoices.dataValues.companyId}}]}):
    // req.body.subType == "LCL"?expenseAccount = await Child_Account.findOne({where:{title:"LCL FREIGHT EXPENSE"}, include:[{model:Parent_Account, where:{CompanyId:invoices.dataValues.companyId}}]}):
    // expenseAccount = await Child_Account.findOne({where:{title:"AIR FREIGHT EXPENSE"}, include:[{model:Parent_Account, where:{CompanyId:invoices.dataValues.companyId}}]})
    // let incomeAccount
    // req.body.subType == "FCL"?incomeAccount = await Child_Account.findOne({where:{title:"FCL FREIGHT INCOME"}, include:[{model:Parent_Account, where:{CompanyId:invoices.dataValues.companyId}}]}):
    // req.body.subType == "LCL"?incomeAccount = await Child_Account.findOne({where:{title:"LCL FREIGHT INCOME"}, include:[{model:Parent_Account, where:{CompanyId:invoices.dataValues.companyId}}]}):
    // incomeAccount = await Child_Account.findOne({where:{title:"AIR FREIGHT INCOME"}, include:[{model:Parent_Account, where:{CompanyId:invoices.dataValues.companyId}}]})
    // let account
    console.log(invoices.dataValues)
    // if(invoices.dataValues.partyType == "vendor"||invoices.dataValues.partyType == "agent"){
    //   account = await Vendor_Associations.findOne({where:{VendorId:invoices.dataValues.party_Id}})
    // }else{
    //   account = await Client_Associations.findOne({where:{ClientId:invoices.dataValues.party_Id}})
    // }
    // console.log("Account Id:", account.dataValues)
    let Voucher_Head = []
    let narration = `${req.body.type=="OI"?"Opening Invoice":"Opening Bill"} ${invoices.dataValues.invoice_No} From ${invoices.dataValues.party_Name}`

    let total = parseFloat(invoices.dataValues.total) + parseFloat(invoices.dataValues.roundOff)
    let defaultTotal = invoices.dataValues.currency!='PKR'?parseFloat(invoices.dataValues.total)*parseFloat(invoices.dataValues.ex_rate):parseFloat(invoices.dataValues.total)
    Voucher_Head.push({
      amount:total,
      defaultAmount: defaultTotal,
      type:invoices.dataValues.payType=="Recievable"?"debit":"credit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      accountType: "partyAccount",
      ChildAccountId:invoices.dataValues.party_Id,
      createdAt: invoices.dataValues.createdAt
    })
    Voucher_Head.push({
      amount:total,
      defaultAmount: defaultTotal,
      type:invoices.dataValues.payType!="Recievable"?"debit":"credit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      accountType: "payAccount",
      ChildAccountId:req.body.creditAccount,
      createdAt: invoices.dataValues.createdAt
    })

    await Voucher_Head.map(async(x)=>{
      await Voucher_Heads.create(x)
    })

    await Invoice.update(
        {
            approved: "1"
        },
        {
            where: {
                id: invoices.dataValues.id
            }
        }
    );
  

    res.json({status:'success', result:{invoices}});
  }catch(e){
    console.log(e)
  }
})

routes.get("/getOpeningInvoices", async(req, res) => {
  try{
    console.log(req.headers.type)
    console.log(req.headers.companyid)
    let type = req.headers.type=='OI'?"Opening Invoice":"Opening Bill"
    const result = await Invoice.findAll({
      where: {
        type: type,
        companyId: req.headers.companyid,
      }
    })
    result.forEach((x)=>{
      console.log(x.dataValues)
    })
    res.json({status: 'success', result: result});
  }catch(e){
    console.log(e)
    res.json({status: 'Error', result: e});
  }
})
routes.get("/getOpeningInvoice", async(req, res) => {
  try{
    console.log(req.headers.id)
    let result = await Invoice.findOne({
      where: {
        id: req.headers.id
      }
    })
    let voucher = await Vouchers.findOne({
      where:{
        invoice_Id:req.headers.id
      },
      include:[{model:Voucher_Heads}]
    })
    console.log(result)
    if(result == null){
      voucher = await Vouchers.findOne({
        where:{id: req.headers.id},
        include:[{model:Voucher_Heads}]
      })
      if(voucher != null){
        result = await Invoice.findOne({
          where:{id:voucher.dataValues.invoice_Id}
        })
      }
    }
    res.json({status: 'success', result: {result, voucher}});
  }catch(e){
    console.log(e)
    res.json({status: 'Error', result: e});
  }
})

routes.post("/deleteOpeningInvoices", async(req, res) => {
  try{
    await Invoice.destroy({where:{id:req.body.headers.id}})
    const voucher = await Vouchers.findOne({where:{invoice_Id:req.body.headers.id}})
    await Voucher_Heads.destroy({where:{VoucherId:voucher.dataValues.id}})
    await Vouchers.destroy({where:{invoice_Id:req.body.headers.id}})
    res.json({status: 'success', result: req.body.headers.id});
  }catch(e){
    console.log(e)
  }
})

// To display invoices in Invoices page present in accounts tab
routes.get("/getInvoices", async(req, res) =>{
  try {
    const result = await Invoice.findAll({
      where: {SEJobId: req.headers.id},
      attributes: ['invoice_No', 'payType', 'total', 'recieved', 'ex_rate','approved'],
      include:[{
        model:Charge_Head,
        attributes:['charge'],
        where:{charge:{ [Op.ne]: null }}
      }]
    })
    res.json({status: 'success', result: result});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

routes.post("/unApprove", async(req, res)=>{
  try{
    console.log(req.body.id)
    const inv = await Invoice.update(
      { approved: 0 },
      { where: { id: req.body.id } } // Replace someInvoiceId with the actual ID or condition
    );
    
    const voucher = await Vouchers.findOne({
      where: {
        invoice_Id: req.body.id.toString()
      }
    })
    const voucher_Heads = await Voucher_Heads.destroy({
      where:{
        VoucherId: voucher.id
      }
    })
    await Vouchers.destroy({
      where: {
        invoice_Id: req.body.id.toString()
      }
    })
    res.json({status: 'success'});
  }catch(e){
    console.error(e)
  }
})

routes.post("/approve", async(req, res) => {
  try{
    const chargesHeads = await Charge_Head.findAll({
      where:{InvoiceId:req.body.id}
    })
    const Inv = await Invoice.findOne({where:{id:req.body.id}})
    let total = 0.0;
    let defaultTotal = 0.0
    // console.log("Charge Heads:", chargesHeads)
    let payble = false
    let receivable = false
    let vendor = false
    let payAmount = 0.0
    let recAmount = 0.0
    let defaultPayAmount = 0.0
    let defaultRecAmount = 0.0
    chargesHeads.forEach((x)=>{
      if(x.type!="Recievable"){
        payble = true
        payAmount += parseFloat(x.net_amount)
        defaultPayAmount += parseFloat(x.local_amount)
      }else{
        receivable = true
        recAmount += parseFloat(x.net_amount)
        defaultRecAmount += parseFloat(x.local_amount)
      }
      if(x.partyType=='vendor' || x.partyType=='agent'){
        vendor = true
      }
    })
    
    // for(let x of chargesHeads){
    //   Inv.dataValues.currency=="PKR"?total += parseFloat(x.dataValues.local_amount):total += parseFloat(x.dataValues.net_amount)
    //   defaultTotal += parseFloat(x.dataValues.local_amount)
    // }
    let invPayType = Inv.dataValues.payType
    if(payble && receivable){
      if(payAmount>recAmount){
        Inv.dataValues.currency!="PKR"?
        total = payAmount - recAmount:
        total = defaultPayAmount - defaultRecAmount
        defaultTotal = defaultPayAmount - defaultRecAmount
        invPayType = "Payble"
      }else{
        Inv.dataValues.currency!="PKR"?
        total = recAmount - payAmount:
        total = defaultRecAmount - defaultPayAmount
        defaultTotal = defaultRecAmount - defaultPayAmount
        invPayType = "Recievable"
      }
    }else{
      for(let x of chargesHeads){
        Inv.dataValues.currency=="PKR"?total += parseFloat(x.dataValues.local_amount):total += parseFloat(x.dataValues.net_amount)
        defaultTotal += parseFloat(x.dataValues.local_amount)
      }
    }
    const invoice = await Invoice.findOne({where:{id:req.body.id}})
    // console.log("",invoice)
    const inv = await invoice.update({total:total, approved:1, payType: invPayType})
    await Charge_Head.update({approved:1, status:1}, {where:{InvoiceId:req.body.id}})
    const job = await SE_Job.findOne({where:{id:invoice.dataValues.SEJobId}})
    let expenseAccount
    job.dataValues.subType == "FCL"?expenseAccount = await Child_Account.findOne({where:{title:"FCL FREIGHT EXPENSE"}, include:[{model:Child_Account, as: 'parent'}]}):
    job.dataValues.subType == "LCL"?expenseAccount = await Child_Account.findOne({where:{title:"LCL FREIGHT EXP"}, include:[{model:Child_Account, as: 'parent'}]}):
    expenseAccount = await Child_Account.findOne({where:{title:"AIR FREIGHT EXPENSE"}, include:[{model:Child_Account, as: 'parent',}]})
    let incomeAccount
    job.dataValues.subType == "FCL"?incomeAccount = await Child_Account.findOne({where:{title:"FCL FREIGHT INCOME"}, include:[{model:Child_Account, as: 'parent'}]}):
    job.dataValues.subType == "LCL"?incomeAccount = await Child_Account.findOne({where:{title:"LCL FREIGHT INCOME"}, include:[{model:Child_Account, as: 'parent'}]}):
    incomeAccount = await Child_Account.findOne({where:{title:"AIR FREIGHT INCOME"}, include:[{model:Child_Account, as: 'parent',}]})
    let account
    // if(invoice.dataValues.partyType == "vendor"||invoice.dataValues.partyType == "agent"){
    //   account = await Vendor_Associations.findOne({where:{VendorId:invoice.dataValues.party_Id}})
    // }else{
    // }
    account = await Client_Associations.findOne({where:{ClientId:invoice.dataValues.party_Id}})

    vouchers = {
      type:invoice.dataValues.payType=="Recievable"?"Job Recievable":"Job Payble",
      vType:invoice.dataValues.payType=="Recievable"?"SI":"PI",
      CompanyId:invoice.dataValues.companyId,
      amount:"",
      currency:invoice.dataValues.type=="Job Bill"?"PKR":invoice.dataValues.type=="Job Invoice"?"PKR":invoice.dataValues.currency,
      exRate:invoice.dataValues.type=="Job Bill"?"1":invoice.dataValues.type=="Job Invoice"?"1":invoice.dataValues.ex_rate,
      chequeNo:"",
      payTo:"",
      costCenter:"KHI",
      invoice_Voucher:"1",
      invoice_Id:invoice.dataValues.id,
      partyId: invoice.dataValues.party_Id,
      partyName: invoice.dataValues.party_Name,
    }

    const check = await Vouchers.findOne({
      order: [["voucher_No", "DESC"]],
      attributes: ["voucher_No"],
      where: { vType: vouchers.vType, CompanyId: invoice.dataValues.companyId }
    });

    const voucher = await Vouchers.create({
      ...vouchers,
      voucher_No: check == null ? 1 : parseInt(check.voucher_No) + 1,
      voucher_Id: `${invoice.dataValues.companyId == 1 ? "SNS" : invoice.dataValues.companyId == 2 ? "CLS" : "ACS"}
      -${vouchers.vType}
      -${check == null ? 1 : parseInt(check.voucher_No) + 1}
      /${moment().month() >= 6 ? moment().add(1, 'year').format('YY') : moment().format('YY')}`
    })

    let Voucher_Head = []
    let narration = `${invoice.dataValues.payType} Against Invoice ${invoice.dataValues.invoice_No} For Job# ${job.dataValues.jobNo} From ${invoice.dataValues.party_Name}`

  if(invoice.dataValues.roundOff=="0"){  
    Voucher_Head.push({
      amount:total,
      defaultAmount: defaultTotal,
      type:invoice.dataValues.payType=="Recievable"?"debit":"credit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      ChildAccountId:invoice.dataValues.party_Id,
    })
    Voucher_Head.push({
      amount:total,
      defaultAmount: defaultTotal,
      type:invoice.dataValues.payType=="Recievable"?"credit":"debit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      ChildAccountId:invoice.dataValues.payType=="Recievable"?incomeAccount.dataValues.id:expenseAccount.dataValues.id,
    })
  } else if(parseFloat(invoice.dataValues.roundOff)>"0"  && invoice.dataValues.payType=="Recievable"){
   Voucher_Head.push({
      amount:amount + parseFloat(invoice.dataValues.roundOff),
      defaultAmount: defaultTotal,
      type:invoice.dataValues.payType=="Recievable"?"debit":"credit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      ChildAccountId:invoice.dataValues.party_Id,
    })
    Voucher_Head.push({
      amount:amount + parseFloat(invoice.dataValues.roundOff),
      defaultAmount: defaultTotal,
      type:"credit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      ChildAccountId:incomeAccount.dataValues.id
    })
  } else if(parseFloat(invoice.dataValues.roundOff)<"0"  && invoice.dataValues.payType=="Recievable"){
    Voucher_Head.push({
      amount:amount- parseFloat(invoice.dataValues.roundOff)*-1,
      defaultAmount: defaultTotal,
      type:invoice.dataValues.payType=="Recievable"?"debit":"credit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      ChildAccountId:invoice.dataValues.party_Id
    })
    Voucher_Head.push({
      amount:amount,
      type:"credit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      ChildAccountId:incomeAccount.dataValues.id
    })
    Voucher_Head.push({
      amount:parseFloat(invoice.dataValues.roundOff)*-1,
      defaultAmount: defaultTotal,
      type:invoice.dataValues.payType=="Recievable"?"debit":"credit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      ChildAccountId:expenseAccount.dataValues.id
    })
  } else if(parseFloat(invoice.dataValues.roundOff) >0  && invoice.dataValues.payType!="Recievable"){
    Voucher_Head.push({
      amount:amount+ parseFloat(invoice.dataValues.roundOff),
      defaultAmount: defaultTotal,
      type:"credit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      ChildAccountId:invoice.dataValues.party_Id
    })
    Voucher_Head.push({
      amount:amount + parseFloat(invoice.dataValues.roundOff),
      defaultAmount: defaultTotal,
      type:"debit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      ChildAccountId:expenseAccount.dataValues.id
    })
  } else if(parseFloat(invoice.dataValues.roundOff) <0  && invoice.dataValues.payType!="Recievable"){
    Voucher_Head.push({
      amount:(amount - parseFloat(invoice.dataValues.roundOff)*-1).toFixed(2),
      defaultAmount: defaultTotal,
      type:"credit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      ChildAccountId:invoice.dataValues.party_Id
    })
    Voucher_Head.push({
      amount:(amount).toFixed(2),
      defaultAmount: defaultTotal,
      type:"debit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      ChildAccountId:expenseAccount.dataValues.id
    })
    Voucher_Head.push({
      amount:(parseFloat(invoice.dataValues.roundOff)*-1).toFixed(2),
      defaultAmount: defaultTotal,
      type:"credit",
      narration:narration,
      VoucherId:voucher.dataValues.id,
      ChildAccountId:incomeAccount.dataValues.id
    })
  }

  await Voucher_Head.map(async(x)=>{
    console.log(x.ChildAccountId)
     await Voucher_Heads.create(x)
  })
    res.json({status: 'success', result: req.body.id});
  }catch(error){
    console.log(error)
    res.json({status: 'error', result: error});
  }
  
})

routes.post("/approveHeads", async(req, res) => {
  try{
    const result = await Charge_Head.findOne({where:{id:req.body.id}})
    await Charge_Head.update({status:result.dataValues.status=="1"?"0":"1"}, {where:{id:result.dataValues.id}})
    res.json({status: 'success', result: result});
  }catch(error){
    console.log(error)
    res.json({status: 'error', result: error});
  }
})

// For Experimental Purposes
routes.get('/getTaskInvoices', async(req, res) => {
  try {
    const result = await Invoice.findAll({ where: {status: "2" , approved: "1"}})
    res.json({status: 'success', result: result});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// For Experimental Purposes
routes.get('/getCPUS', async(req, res) => {
  try {
    //const result = await Invoice.findAll({ where: {status: "2" , approved: "1"}})
    res.json({status: 'success', result: numCPUs});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// For Data Backup
routes.get('/testGetLastInvoice', async(req, res) => {
  try {
    const lastJI = await Invoice.findOne({ 
      //limit:1,
      where:{type:'Job Invoice'},
      order: [['invoice_Id', 'DESC']],
      attributes:["invoice_Id"]
    });
    res.json({status: 'success', result: lastJI});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

// displays job data according to Invoice balance Page
routes.get("/jobBalancing", async (req, res) => {
  try {
    // console.log(req.headers)
    let account
    if(req.headers.party){
      // console.log("ID>>",req.headers.party)
      account = await Client_Associations.findOne({
        where:{
          ClientId: req.headers.party
        }
      })
      // if(!account){
      //   account = await Vendor_Associations.findOne({
      //     where:{
      //       VendorId: req.headers.party
      //     }
      //   })
      // }
    }
    if(req.headers.overseasagent){
      // console.log("ID>>",req.headers.overseasagent)
      account = await Client_Associations.findOne({
        where:{
          ClientId: req.headers.overseasagent
        }
      })
    }
    let invoiceObj = {
      // below condition sets the date range
      createdAt: {
        [Op.gte]: moment(req.headers.from).toDate(),
        [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
      },
      // status:{ [Op.ne]: null },
      // below condition make sures to display only Job-Invoice & Job-Bill
      [Op.and]: [
        { type: { [Op.ne]: "Agent Invoice" } },
        { type: { [Op.ne]: "Old Agent Invoice" } },
        { type: { [Op.ne]: "Agent Bill" } },
        { type: { [Op.ne]: "Old Agent Bill" } },
      ]
    };
    // below condition sets if both payble & receivable invoices/bills are being called
    if(req.headers.paytype!="All"){
      invoiceObj.payType=req.headers.paytype
    }
    // party wise invoice/bill
    account?invoiceObj.party_Id=req.headers.party:null
    // Company wise invoice/bill
    if(req.headers.company=='4'){
      invoiceObj = {
        ...invoiceObj,
        [Op.or]: [{companyId: '1'}, {companyId:'3'}]
      }
    } else {
      req.headers.company?invoiceObj.companyId=req.headers.company:null;
    }
    // Currency wise invoice/bill
    req.headers.currency?invoiceObj.currency=req.headers.currency:null;
    // Job Type/operation wise invoice/bill
    req.headers.jobtypes?.length>0?invoiceObj.operation=req.headers.jobtypes.split(","):null;

    // To include the Job, Bl & Equipments data in the invoices
    let includeObj = [
      {
        model: Charge_Head,
      },
      {
      model:SE_Job,
      include:[
        { model:Voyage, attributes:['voyage', 'importArrivalDate', 'exportSailDate'] },
        { model:Clients, attributes:['code','name'] },
        { model:Bl, attributes:['hbl','mbl'] },
        { model:SE_Equipments, attributes:['qty', 'size'] },
        { model: Clients, as:'shipper', attributes:['name'] },
        {
          model: Clients,
          as:'consignee', 
          attributes:['name']
        },
        {
          model: Employees,
          as:'sales_representator', 
          attributes:['name']
        },
        {
          model: Vessel,
          as:'vessel', 
          attributes:['name']
        },
        {
          model: Clients,
          as:'shipping_line', 
          attributes:['name']
        },
      ],
      attributes:['id', 'weight', 'vol', 'fd', 'freightType', 'jobNo', 'operation', 'subType', 'jobDate', 'shipDate', 'arrivalDate', 'container', 'createdAt', 'fileNo', 'customerRef'],
      
    }]

    invoiceObj.approved = '1'

    // overseas agent wise invoice/bill
    req.headers.overseasagent?includeObj.where = {overseasAgentId:req.headers.overseasagent}:null;
    const result = await Invoice.findAll({
      where:invoiceObj,
      attributes:['id','invoice_No', 'payType', 'currency', 'ex_rate', 'roundOff', 'total', 'paid', 'recieved', 'createdAt', 'party_Name', 'companyId'],
      include:includeObj,
      order: [[ 'createdAt', 'ASC' ]],
    });
    await res.json({ status: "success", result: result });
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

// this below api is just a copy of the above api just it's specifically for Agent-Invoices/Agent-Bills only
// routes.get("/invoiceBalancing", async (req, res) => {
//   try {
//     let invoiceObj = {
//       createdAt: {
//         [Op.gte]: moment(req.headers.from).toDate(),
//         [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
//       },
//       // status:{ [Op.ne]: null },
//       [Op.and]: [
//         { type: { [Op.ne]: "Job Invoice" } },
//         { type: { [Op.ne]: "Old Job Invoice" } },
//         { type: { [Op.ne]: "Job Bill" } },
//         { type: { [Op.ne]: "Old Job Bill" } },
//       ]
//     };
//     if(req.headers.paytype!="All"){
//       invoiceObj.payType=req.headers.paytype
//     }
//     if(req.headers.company=='4'){
//       invoiceObj = {
//         ...invoiceObj,
//         [Op.or]: [{companyId: '1'}, {companyId:'3'}]
//       }
//     } else {
//       req.headers.company?invoiceObj.companyId=req.headers.company:null;
//     }
//     let accountObj
//     if(req.headers.company=='4'){
//       accountObj = {
//         [Op.or]: [{CompanyId: '1'}, {CompanyId:'3'}]
//       }
//     } else {
//       req.headers.company?accountObj.CompanyId=req.headers.company:null;
//     }
//     console.log(accountObj)
//     let account
//     if(req.headers.overseasagent){
//       account = await Vendor_Associations.findAll({
//         where: {
//           ...accountObj,
//           VendorId: req.headers.overseasagent
//         }
//       })
//     }
//     console.log("Account", account.dataValues)
//     account?invoiceObj.party_Id=account.ChildAccountId:null;
//     const result = await Invoice.findAll({
//       where:invoiceObj,
//       attributes:['id', 'invoice_No', 'payType', 'currency', 'ex_rate', 'roundOff', 'total', 'paid', 'recieved', 'createdAt', 'party_Name', 'companyId'],
//       include:[{
//         model:SE_Job,
//         include:[
//           { model: Clients, as:'shipper', attributes:['name'] },
//           { model: Clients, as:'Client', attributes:['name'] },
//           { model: Vessel, as:'vessel', attributes:['name'] },
//           { model: Voyage, as:'Voyage', attributes:['voyage'] },

//           {
//             model: Employees,
//             as:'sales_representator', 
//             attributes:['name']
//           },
//           {
//             model:Bl,
//             attributes:['hbl', 'mbl'],
//           },
//           {
//             model:SE_Equipments,
//             attributes:['qty', 'size']
//           }
//         ],
//         order: [[ 'createdAt', 'ASC' ]],
//         attributes:['id', 'fd', 'freightType', 'jobNo', 'operation', 'subType', 'vol', 'weight', 'container', 'customerRef', 'fileNo', 'arrivalDate', 'shipDate'],
//       },
//       {
//         model:Charge_Head,
//       }]

//     });
//     await res.json({ status: "success", result: result });
//   } catch (error) {
//     console.log(error)
//     res.json({ status: "error", result: error });
//   }
// });

routes.get("/invoiceBalancing", async (req, res) => {
  try {
    console.log("Headers:", req.headers);
    let invoiceObj = {
      createdAt: {
        [Op.gte]: moment(req.headers.from).toDate(),
        [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
      },
      [Op.and]: [
        { type: { [Op.notIn]: ["Job Invoice", "Old Job Invoice", "Job Bill", "Old Job Bill"] } }
      ]
    };
    if (req.headers.paytype !== "All") {
      invoiceObj.payType = req.headers.paytype;
    }
    if (req.headers.company === "4") {
      invoiceObj.companyId = { [Op.in]: ["1", "3"] };
    } else if (req.headers.company) {
      invoiceObj.companyId = req.headers.company;
    }
    let account = [];
    if (req.headers.overseasagent) {
      account = await Client_Associations.findAll({
        where: {
          ClientId: req.headers.overseasagent,
        },
      });
    }
    console.log("Account:", account);
    if (account.length > 0) {
      invoiceObj.party_Id = account.map(a => a.ChildAccountId.toString());
    }
    console.log("InvoiceObj:", invoiceObj);
    const result = await Invoice.findAll({
      // where: invoiceObj,
      where: {
        party_Id: req.headers.overseasagent
      },
      attributes: [
        "id", "invoice_No", "payType", "currency", "ex_rate", "roundOff", 
        "total", "paid", "recieved", "createdAt", "party_Name", "companyId"
      ],
      include: [
        {
          model: SE_Job,
          required: false,
          include: [
            { model: Clients, required: false, as: "shipper", attributes: ["name"] },
            { model: Clients, required: false, as: "Client", attributes: ["name"] },
            { model: Vessel, required: false, as: "vessel", attributes: ["name"] },
            { model: Voyage, required: false, as: "Voyage", attributes: ["voyage"] },
            { model: Employees, required: false, as: "sales_representator", attributes: ["name"] },
            { model: Bl, required: false, attributes: ["hbl", "mbl"] },
            { model: SE_Equipments, required: false, attributes: ["qty", "size"] },
          ],
          order: [["createdAt", "ASC"]],
          attributes: [
            "id", "fd", "freightType", "jobNo", "operation", "subType", "vol", 
            "weight", "container", "customerRef", "fileNo", "arrivalDate", "shipDate"
          ],
        },
        {
          model: Charge_Head,
        },
      ],
    });
    console.log("Result Count:", result.length);
    res.json({ status: "success", result });
  } catch (error) {
    console.error(error);
    res.json({ status: "error", result: error });
  }
});


// For Data Backup
routes.get("/invoiceTest", async (req, res) => {
  try {

    const from = moment("2023-09-08");
    const to   = moment("2023-09-10");
    const result = await Invoice.findAll({
      where:{
        createdAt: {
          [Op.gte]: from.toDate(),
          [Op.lte]: to.toDate(),
         }
      },
      order: [[ 'createdAt', 'ASC' ]]
    });

    await res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

// For Data Backup
routes.post("/uploadbulkInvoicesTest", async (req, res) => {
  try {
    const resultOne = await Clients.findOne({
      where:{name:req.body.party_Name},
      attributes:['id']
    })
    const resultTwo = await Vendors.findOne({
      where:{name:req.body.party_Name},
      attributes:['id']
    })
    await res.json({ status:"success", result:resultOne?resultOne.id:resultTwo.id });
  } catch (error) {
    console.log(error);
    res.json({ status: "error", result: error });
  }
});

const setVoucherHeads = (id, heads) => {
  let result = [];
  heads.forEach((x) => {
    result.push({
      ...x,
      VoucherId: id,
      amount: `${x.amount}`
    });
  });
  return result;
};

routes.post("/uploadbulkInvoices", async (req, res) => {
  try {
    temp = req.body
    voucher = temp.voucher
    delete temp.voucher
    let result
    try{
      result = await Invoice.create(temp)

    }catch(e){
      console.log("Invoice creater",e)
    }
    let vouchers
    let invoiceNo = temp.invoice_No.slice(0, -2)
    try{
      const voucher = await Vouchers.findOne({
        where: {
          voucherNarration: {
            [Op.like]: `%${invoiceNo}%`
          }
        }
      });
      
      if (voucher) {
        // Append the new result.id to the existing invoices string
        const updatedInvoices = voucher.invoices ? `${voucher.invoices},${result.id}` : result.id;
      
        // Update the record with the new invoices string
        await Vouchers.update(
          {
            invoices: updatedInvoices,
          },
          {
            where: {
              id: voucher.id, // Update only the specific record
            }
          }
        );
      } else {
        console.log('No voucher found with the specified narration.');
      }
      // vouchers = await Vouchers.update({
      //   where: {
      //     voucherNarration: {
      //       [Op.like]: `%${invoiceNo}%`
      //     }
      //   }
      // });

    }catch(e){
      console.log("Voucher finder",e)
    }
    let Invoice_Transaction = {}
    for(let x of vouchers){
      if(x.voucherNarration.includes(invoiceNo)){
        Invoice_Transaction = {
          InvoiceId: result.dataValues.id,
          VoucherId: x.id
        }
        await Voucher.update(
          { invoices: result.dataValues.id }, // Fields to update
          { where: { id: x.id } }// Condition
        );
      }
    } 
    // vouchers.forEach((x)=>{
    //   if(x.voucherNarration.includes(invoiceNo)){
    //     Invoice_Transaction = {
    //       InvoiceId: result.dataValues.id,
    //       VoucherId: x.id
    //     }
    //     await Invoice.update
    //   }
    // })  
    let resultThree
    try{
      resultThree = await Invoice_Transactions.create({
        gainLoss: result.dataValues.payType=="Receivable"?(result.dataValues.total - result.dataValues.recieved):(result.dataValues.total - result.dataValues.paid),
        amount: result.dataValues.total,
        createdAt: result.dataValues.createdAt,
        ...Invoice_Transaction
      })
      
    }catch(e){
      console.log("Invoice Transaction creater",e)
    }
    res.json({ status: "success", result: result });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
})

routes.post("/updateVouchersWithInvoices", async (req, res) => {
  try {
    const allInvoices = await Invoice.findAll();
    console.log(allInvoices)
    for (const invoice of allInvoices) {
      
      const invoiceNo = invoice.dataValues.invoice_No;
      const invoiceId = invoice.dataValues.id;
      const vouchers = await Vouchers.findAll({
        where: {
          voucherNarration: {
            [Op.like]: `%${invoiceNo}%`
          }
        }
      });
      for (const voucher of vouchers) {
        const updatedInvoices = voucher.invoices ? `${voucher.invoices},${invoiceId}` : invoiceId;
        console.log(updatedInvoices)
        await Vouchers.update(
          {
            invoices: updatedInvoices,
          },
          {
            where: {
              id: voucher.id,
            }
          }
        );
      }
    }

    res.json({ status: 'success', message: 'All vouchers updated with invoice IDs.' });
  } catch (e) {
    console.log(e);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// For Data Backup
routes.post("/createBulkInvoices", async (req, res) => {
  try {
    temp = req.body
    voucher = temp.voucher
    delete temp.voucher
    const result = await Invoice.create(temp)
    const resultC = await Client_Associations.findOne({
      where:{
        ClientId:req.body.party_Id,
        CompanyId: req.body.companyId
      },
    })
    const resultV = await Vendor_Associations.findOne({
      where:{
        VendorId:req.body.party_Id,
        CompanyId: req.body.companyId
      },
    })
    voucher.Voucher_Heads.forEach((x)=>{
      x.ChildAccountId = resultC?resultC.dataValues.ChildAccountId:resultV.dataValues.ChildAccountId
      x.narration = req.body.invoice_No 
    })
    const check = await Vouchers.findOne({
      order: [["voucher_No", "DESC"]],
      attributes: ["voucher_No"],
      where: { vType: voucher.vType, CompanyId: voucher.CompanyId }
    });
    const resultTwo = await Vouchers.create({
      ...voucher,
      partyId: req.body.party_Id,
      partyName: req.body.party_Name,
      voucher_No: check == null ? 1 : parseInt(check.voucher_No) + 1,
      voucher_Id: `${voucher.CompanyId == 1 ? "SNS" : voucher.CompanyId == 2 ? "CLS" : "ACS"
      }-${voucher.vType
      }-${check == null ? 1 : parseInt(check.voucher_No) + 1
      }/${moment().month() >= 6 ? moment().add(1, 'year').format('YY') : moment().format('YY')}`,
    })
    const resultThree = await Invoice_Transactions.create({
      gainLoss: result.dataValues.payType=="Receivable"?(result.dataValues.total - result.dataValues.recieved):(result.dataValues.total - result.dataValues.paid),
      amount: result.dataValues.total,
      createdAt: result.dataValues.createdAt,
      InvoiceId: result.dataValues.id,
      VoucherId: resultTwo.dataValues.id
    })

    let dataz = await setVoucherHeads(resultTwo.id, voucher.Voucher_Heads);
    const datab = await Voucher_Heads.bulkCreate(dataz);
    await res.json({ status: "success" });
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

// For Data Backup
routes.get("/getClientsWithACPayble", async (req, res) => {
  try {
    const result = await Clients.findAll({
      include:[{
        model:Client_Associations,
        include:[{
          model:Parent_Account,
          where:{CompanyId:'1'}
        }]
      }]
    })
    await res.json({ status: "success", result});
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

routes.get("/invoiceMatching", async (req, res) => {
  try {
    const result = await Invoice.findAll({})
    await res.json({ status: "success", result});
  } catch (error) {
    console.log(error)
    res.json({ status: "error", result: error });
  }
});

module.exports = routes;        