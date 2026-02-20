const { sequelize } = require("../models");
// const History = require("../models/History");
const { History } = require('../models/');

const createHistory = async (employeeId, formName, Type, docNo) => {
    try {
        const result = await sequelize.transaction(async (t) => {
            const history = await History.create({
                formName: formName,
                type: Type,
                docNo: docNo,
                EmployeeId: employeeId
            }, { transaction: t });
            return true;
        });
    } catch (error) {
        console.error('Error creating history:', error);   
        return false;
    }
}
module.exports = { createHistory };