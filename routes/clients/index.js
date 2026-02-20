const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const db = require("../../models");
const moment = require("moment");
const routes = require('express').Router();
// const { History } = require("../../functions/Associations/historyAssociations");
const { Employees } = require("../../functions/Associations/employeeAssociations");
const { Clients, Client_Associations } = require("../../functions/Associations/clientAssociation");
const { Child_Account, Parent_Account } = require("../../functions/Associations/accountAssociations");
const { Voucher_Heads } = require('../../functions/Associations/voucherAssociations');
// const { Vendors, Vendor_Associations } = require("../../functions/Associations/vendorAssociations");
const { createHistory } = require('../../functions/history');
const { types } = require('pg');

const validTypes = [
  "Slot Operator",
  "Buyer",
  "Terminal",
  "Depot",
  "Principal",
  "Stevedore",
  "Cartage",
  "Drayman",
  "Trucking",
  "Air Line",
  "Buying House",
  "Warehouse",
  "Delivery Agent",
  "Shipping Line",
  "CHA/CHB",
  "Transporter",
  "Indentor",
  "Commission Agent",
  "Overseas Agent",
  "Potential Customer",
  "Non operational Party",
  "Forwarder/Coloader",
  "Local Vendor"
];

const createChildAccounts = (list, name) => {
    let result = [];
    list.forEach((x)=>{
        result.push({title:name, ChildAccountId:x.id, subCategory:'Customer'})
    })
    return result;
}
const createAccountList = (parent, child, id) => {
    let result = [];
    parent.forEach((x, i)=>{
        result[i] = {
            ClientId:id,
            CompanyId:x.CompanyId,
            ParentAccountId:x.id,
            ChildAccountId:null
        }
        child.forEach((y, j)=>{
            if(y.ParentAccountId==x.id){
                result[i].ChildAccountId=child[j].id
            }
        })
    })
    return result;
}

routes.post("/addClient", async(req, res)=>{
    try{
        // console.log(req.body)
        const result = await Clients.create(req.body)
        console.log(result)
        res.json({
            status:'success', 
            result:result.dataValues
        });
    }catch(e){
        res.json({status:'error', result:e});
        console.error(e)
    }
})

routes.post("/createClientAssociations", async(req, res) => {
    try{
        const result1 = await Clients.findOne({
            attributes:['id', 'name'],
            where:{
                name: req.body.name
            }
        })
        const ChAcc = await Child_Account.findOne({
            where:{
                id: req.body.ChildAccountId
            },
            attributes:['id', 'title', 'ParentAccountId'],
        })
        // for(let x of result1){
        //     console.log(x.dataValues)

        // }
        // console.log(result1.dataValues.id)
        // console.log(req.body.companyId)
        // console.log(ChAcc.dataValues.ParentAccountId)
        // console.log(ChAcc.dataValues.id)
        const result = await Client_Associations.create({
            ClientId: result1.dataValues.id,
            CompanyId: req.body.companyId,
            ParentAccountId: ChAcc.dataValues.ParentAccountId,
            ChildAccountId: ChAcc.dataValues.id
        });        
        console.log(result.dataValues)
        res.json({status: 'success', result:result.dataValues});
    }catch(e){
        res.json({status:'error', result:e});
        console.error(e)
    }
})

routes.post("/createClient", async (req, res) => {
  // Start a managed transaction (auto-commit/rollback)
  const resultPayload = await db.sequelize.transaction(async (t) => {
    try {
      let value = req.body;
      value.operations = value.operations.join(', ');
      value.types = value.types.join(', ');
      delete value.id;

      const check = await Clients.findOne({
        where: {
          [Op.and]: [
            { code: { [Op.ne]: 'CU-00633' } },
            { code: { [Op.ne]: 'CC-00884' } },
            { code: { [Op.ne]: 'CU-00647' } },
            { code: { [Op.ne]: 'CU-00013' } },
            { code: { [Op.ne]: 'CU-00721' } },
            { code: { [Op.ne]: 'CU-00902' } },
            { code: { [Op.ne]: 'CU-00146' } },
            { code: { [Op.ne]: 'CC-11914' } },
          ]
        },
        attributes: ['code'],
        order: [['createdAt', 'DESC']],
        transaction: t
      });

      if (!check) {
        // keep your pattern (you had check.code = 0 but check could be null)
        // not changing logic: we’ll just guard where it's used below
      }

      value.accountRepresentatorId = value.accountRepresentatorId == "" ? null : value.accountRepresentatorId;
      value.salesRepresentatorId = value.salesRepresentatorId == "" ? null : value.salesRepresentatorId;
      value.docRepresentatorId = value.docRepresentatorId == "" ? null : value.docRepresentatorId;
      value.authorizedById = value.authorizedById == "" ? null : value.authorizedById;
      req.body.pAccountName ? value.nongl = '0' : value.nongl = '1';
      // value.nongl = null
      console.log(value);

      const check2 = await Clients.findOne({
        where: { name: value.name },
        transaction: t
      });

      if (check2) {
        // Early return inside a managed transaction throws to rollback;
        // we'll bubble a custom object and handle it below.
        return { earlyExit: true, payload: { status: 'exists', message: "Client Already Exists" } };
      }

      const result = await Clients.create(
        { ...value, code: parseInt(check?.code || 0) + 1 },
        { transaction: t }
      );
      console.log(result);

      if (req.body.pAccountName) {
        console.log("Creating associated accounts...", req.body.pAccountName)
        const accounts = await Child_Account.findOne({
          where: { id: req.body.pAccountName },
          transaction: t
        });

        const maxCode = await Child_Account.findOne({
          attributes: [
            [Sequelize.fn('MAX', Sequelize.cast(Sequelize.col('code'), 'INTEGER')), 'maxCode']
          ],
          where: {
            ChildAccountId: accounts.id
          },
          transaction: t
        });

        console.log("Max Code: ", maxCode.maxCode);

        const account = await Child_Account.create({
          title: result.name,
          subCategory: 'Customer',
          editable: false,
          code: maxCode.maxCode + 1,
          ChildAccountId: accounts.id
        }, { transaction: t });

        await Client_Associations.bulkCreate(
          createAccountList(accounts, accountsList, result.id),
          { transaction: t }
        );
      }

      // Non-DB side-effect; left as-is (doesn't need transaction, but fine to keep)
      createHistory(req.body.employeeId, 'Client', 'Create', result.name);
      return { earlyExit: false, payload: { status: 'success', result } };

    } catch (error) {
      // Throwing here triggers automatic rollback by Sequelize
      throw error;
    }
  })
  .then((outcome) => {
    if (outcome.earlyExit) {
      return res.json(outcome.payload);
    }
    return res.json(outcome.payload);
  })
  .catch((error) => {
    console.error(error);
    return res.json({ status: 'error', result: error });
  });
});

routes.post("/createClientInBulk", async(req, res) => {

    const createChildAccounts = (list, name) => {
        let result = [];
        list.forEach((x)=>{
            result.push({title:name+ `${x.title=="ACCOUNT RECEIVABLE"?" RECEIVABLE":" PAYABLE"}`, ParentAccountId:x.id, subCategory:'Customer'})
        })
        return result;
    }
    const createAccountList = (parent, child, id) => {
        let result = [];
        parent.forEach((x, i)=>{
            result[i] = {
                ClientId:id,
                CompanyId:x.CompanyId,
                ParentAccountId:x.id,
                ChildAccountId:null
            }
            child.forEach((y, j)=>{
                if(y.ParentAccountId==x.id){
                    result[i].ChildAccountId=child[j].id
                }
            })
        })
        return result;
    }

    try {
        await obj.forEach(async(val, i)=>{
            let value = {...val};
            value.accountRepresentatorId = null;
            value.salesRepresentatorId   = null;
            value.docRepresentatorId     = null;
            value.authorizedById         = null;
            value.createdBy              = "";
            const result = await Clients.create({...value}).catch((x)=>console.log(x))
            const accounts = await Parent_Account.findAll({
                where: {
                    CompanyId: { [Op.or]: [1, 2, 3] },
                    title: { [Op.or]: ['ACCOUNT RECEIVABLE', 'ACCOUNT PAYABLE'] }
                }
            }).catch((x)=>console.log("===========1=============", x))
            const accountsList = await Child_Account.bulkCreate(createChildAccounts(accounts, result.name)).catch((x)=>console.log("===========2===========", x))
            Client_Associations.bulkCreate(createAccountList(accounts, accountsList, result.id)).catch((x)=>console.log("===========3===========", x))
            console.log(i)
        });
        
        await res.json({status:'success'});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.post("/editClient", async (req, res) => {
  db.sequelize.transaction(async (t) => {
    try {
      let value = req.body.data;
      value.id = value.id;
      value.operations = value.operations.join(', ');
      value.types = value.types.join(', ');

      await Clients.update(
        { ...value, code: parseInt(value.code) },
        { where: { id: value.id }, transaction: t }
      );

      const pAccountList = await Child_Account.findOne({
        where: { id: req.body.pAccountName },
        transaction: t
      });

      const clientAssociation = await Client_Associations.findOne({
        where: { ClientId: value.id },
        transaction: t
      });

      if (clientAssociation) {
        await Child_Account.update(
          {
            title: value.name,
            ChildAccountId: pAccountList.id
        },
          { where: { id: clientAssociation.ChildAccountId }, transaction: t }
        );
      }

      // Side-effect (non-transactional), preserved exactly as you had it
      createHistory(req.body.employeeId, 'Client', 'Edit', value.name);

      res.json({ status: 'success' });
    } catch (error) {
      console.error(error);
      // Throwing inside managed transaction triggers automatic rollback
      throw error;
    }
  }).catch((error) => {
    // Send error only once the transaction block reports failure
    return res.json({ status: 'error', result: error });
  });
});
``

routes.get("/getClients", async(req, res) => {
    try {
        const result = await Clients.findAll({
            // where:{[Op.or]:[{nongl:'0'}, {[Op.eq]:{nongl:null}}]},
            attributes:['id', 'name' , 'person1', 'mobile1', 'person2', 'mobile2', 'telephone1', 'telephone2', 'address1', 'address2', 'createdBy', 'code', 'active', 'types'],
            order: [['createdAt', 'DESC'], /* ['name', 'ASC'],*/] 
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getClientsbyType", async(req, res) => {
    try {
        const result = await Clients.findAll({
            where:{
                types: {
                    [Op.like]: `%${req.headers.type}%`
                }
            },
            attributes:['id', 'name' , 'person1', 'mobile1', 'person2', 'mobile2', 'telephone1', 'telephone2', 'address1', 'address2', 'createdBy', 'code', 'active', 'types'],
            order: [['createdAt', 'DESC'], /* ['name', 'ASC'],*/] 
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getClientById", async(req, res) => {
    try {
        const result = await Clients.findOne({
            where:{id:req.headers.id},
            include:[{
                model:Client_Associations,
                required:false,
                attributes:['id'],
                include:[{
                    // where:{CompanyId:1},
                    attributes:['id', 'title'],
                    model:Child_Account,
                    include:[{
                        model:Child_Account,
                        as: 'children'
                    }]
                }]
            }]
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
        console.error(error)
      res.json({status:'error', result:error});
    }
});

routes.get("/getNotifyParties", async(req, res) => {
    try {
        const result = await Clients.findAll({
            where:{
                types:{[Op.substring]: 'Notify'},
                
            },
            attributes:['id','name', 'address1', 'address1', 'person1', 'mobile1',
            'person2', 'mobile2', 'telephone1', 'telephone2', 'infoMail'],
            order: [['createdAt', 'DESC'], /* ['name', 'ASC'],*/] 
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getForCharges", async(req, res) => {
    try {
        let obj = req.headers.id===undefined?{[Op.and]:[{nongl:{[Op.eq]:null}}]}:{[Op.and]:[{ nongl:{[Op.eq]:'0'}, id:req.headers.id }]};
        const result = await Clients.findAll({
            where:obj,
            attributes:["id", "name", "person2", "person1", "mobile1", "mobile2", "address1", "address2", "types", "city", "types", "nongl"],
            order: [['createdAt', 'DESC'], /* ['name', 'ASC'],*/] 
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/experimentalQuery", async(req, res) => {
    try {
        const [results, metadata] = await db.sequelize.query(
            `
            SELECT
                Clients.name,
                Employees.name AS EmployeeName,
                Clients.bank
            FROM Clients
            LEFT OUTER JOIN Employees ON Clients.accountRepresentatorId=Employees.id;
            `
            );
        res.json({status:'success', result:results});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getChildAccounts", async(req, res) => {
    try {
        const result = await Client_Associations.findOne({
            where: {
                id: req.headers.id
            },
        });
        const result1 = await Vendor_Associations.findOne({
            where: {
                id: req.headers.id
            }
        })
        if(result){
            console.log(result)
            res.json({status:'success', result:result});
        }
        if(result1){   
            console.log(result1)
            res.json({status:'success', result:result1});
        }
    }
    catch (error) {
        console.log(error)
      res.json({status:'error', result:error});
    }
})

routes.post("/findAccounts", async(req, res) => {
    try {
        console.log(req.body);
        const result = await Parent_Account.findAll({
            where: {
                CompanyId: {
                    [Op.or]: req.body.companies
                },
                title:'Accounts Recievable'
            },
            attributes:['id', 'title']
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getClientAssociations", async(req, res) => {
    try {
        const result = await Client_Associations.findAll({
            where: {
                CompanyId: req.headers.company
            },
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
        console.log(error)
        res.json({status:'error', result:error});
    }
});

routes.post("/deleteClient", async(req, res) => {
    try{
        let clientId = req.body.id
        const result0 = await Clients.findOne({where: {
            id: clientId
        }})
        if(result0){
            const result1 = await Client_Associations.findOne({
                where: {
                    ClientId: result0.dataValues.id
                }
            })
            if(result1){
                const result2 = await Child_Account.findOne({
                    where: {
                        id: result1.dataValues.ChildAccountId
                    }
                })
                if(result2){
                    const result3 = await Voucher_Heads.findOne({
                        where: {
                            ChildAccountId: result2.dataValues.id
                        }
                    })
                    if(result3){
                        return res.json({status: 'transaction'})
                    } else {
                        await Child_Account.destroy({
                            where: {
                                id: result2.dataValues.id
                            }
                        })
                        await Client_Associations.destroy({
                            where: {
                                id: result1.dataValues.id
                            }
                        })
                        await Clients.destroy({
                            where: {
                                id: result0.dataValues.id
                            }
                        })
                    }
                } else {
                    await Client_Associations.destroy({
                        where: {
                            id: result1.dataValues.id
                        }
                    })
                    await Clients.destroy({
                        where: {
                            id: result0.dataValues.id
                        }
                    })
                }
            } else {
                await Clients.destroy({
                    where: {
                        id: result0.dataValues.id
                    }
                })
            }
        } else {
            return res.json({status: 'deleted'})
        }
        res.json({status: 'success'})
    }catch(e){
        console.error(e)
        res.json({status: 'error', message: e})
    }
})

routes.post("/bulkCreate", async (req, res) => {
  const parties = req.body;
  try {
    let i = 1
    const accounts = await Child_Account.findAll({
        include: {
            model: Child_Account,
            as: 'parent'
        }
    });

    console.log("Accounts Fetched", accounts[10].dataValues.id)

    for (let party of parties) {
        let ops = '';

        if (party.IsAirExport) ops += 'Air Export, ';
        if (party.IsAirImport) ops += 'Air Import, ';
        if (party.IsSeaExport) ops += 'Sea Export, ';
        if (party.IsSeaImport) ops += 'Sea Import, ';

        let type = '';

        if (party.IsShipper) type += 'Shipper, ';
        if (party.IsConsignee) type += 'Consignee, ';
        if (party.IsNotify) type += 'Notify, ';
        if (party.IsPotentialCustomer) type += 'Potential Customer, ';
        if (party.IsNonOperationalParty) type += 'Non operational Party, ';
        if (party.IsForwarder) type += 'Forwarder/Coloader, ';
        if (party.IsLocalAgent) type += 'Local Vendor, ';
        if (party.IsOverseasAgent) type += 'Overseas Agent, ';
        if (party.IsCommissionAgent) type += 'Commission Agent, ';
        if (party.IsIndentor) type += 'Indentor, ';
        if (party.IsTransporter) type += 'Transporter, ';
        if (party.IsCHACHB) type += 'CHA/CHB, ';
        if (party.IsShippingLine) type += 'Shipping Line, ';
        if (party.IsDeliveryAgent) type += 'Delivery Agent, ';
        if (party.IsWarehouse) type += 'Warehouse, ';
        if (party.IsBuyingHouse) type += 'Buying House, ';
        if (party.IsAirLine) type += 'Air Line, ';
        if (party.IsTrucking) type += 'Trucking, ';
        if (party.IsDrayman) type += 'Drayman, ';
        if (party.IsCartage) type += 'Cartage, ';
        if (party.IsStevedore) type += 'Stevedore, ';
        if (party.IsPrincipal) type += 'Principal, ';
        if (party.IsDepo) type += 'Depot, ';
        if (party.IsTerminalParty) type += 'Terminal, ';
        if (party.IsBuyer) type += 'Buyer, ';
        if (party.IsSlotOperator) type += 'Slot Operator, ';

        let COA1 = null
        accounts.forEach((account) => {
            if (account.dataValues.id == party?.AccountId) {
                COA1 = account.dataValues.id;
            }
        })
        const SNSClient = await Clients.create({
            climaxId: party.Id,
            code: i || null,
            name: party.PartyName,
            city: party.City?.UNLocName || null,
            telephone1: party.Telephone1 || null,
            telephone2: party.Telephone2 || null,
            address1: party.Address1 || null,
            address2: party.Address2 || null,
            website: party.WebSite || null,
            accountsMail: party.AccountsEmail || null,
            infoMail: party.Email || null,
            strn: party.STRN || null,
            ntn: party.NTNName || null,
            registerDate: party.DateOfRegistration || moment().format("YYYY-MM-DD"),
            operations: ops || null,
            types: type || null,
            bankAuthorizeDate: party.AuthorizationDate || moment().format("YYYY-MM-DD"),
            bank: party.BankName || null,
            branchName: party.BranchName || null,
            branchCode: party.BranchCode || null,
            accountNo: party.AccountNo || null,
            iban: party.IBAN || null,
            swiftCode: party.SwiftCode || null,
            routingNo: party.RoutingNo || null,
            ifscCode: party.IFCSCode || null,
            micrCode: party.MICRCode || null,
            currency: party.CurrencyId || "PKR",
            createdBy: party.AddLog || "System",
            active: true,
            nongl: COA1 != null ? '0' : '1'
        });
        if(COA1 != null){
            await Client_Associations.create({
                ClientId: SNSClient.id,
                ChildAccountId: COA1
            })
        }
      i++
    }

    return res.json({ status: 'success', result: 'Parties created successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', result: error.message });
  }
});

module.exports = routes;