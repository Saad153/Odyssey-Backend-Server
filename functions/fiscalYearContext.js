const { AsyncLocalStorage } = require('async_hooks');

// Carries "which fiscal year does the current request's user have selected"
// through the whole request without every route/Sequelize call having to
// pass it explicitly - the frontend attaches it as a header on every
// request (see apis/axiosClient.js), and the fiscalYearAssociations hooks
// read it from here to decide whether an update/destroy is allowed to
// touch a record from a fiscal year other than the one currently selected.
const storage = new AsyncLocalStorage();

const fiscalYearContextMiddleware = (req, res, next) => {
    const fiscalYearId = req.headers['x-fiscal-year-id'] || null;
    storage.run({ fiscalYearId }, next);
};

const getSelectedFiscalYearId = () => storage.getStore()?.fiscalYearId || null;

module.exports = { fiscalYearContextMiddleware, getSelectedFiscalYearId };
