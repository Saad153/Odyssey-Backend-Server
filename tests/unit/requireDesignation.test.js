const requireDesignation = require('../../functions/requireDesignation');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireDesignation middleware', () => {
  it('calls next() when req.user.designation is in the allowed list', () => {
    const mw = requireDesignation(['CEO', 'CFO', 'admin']);
    const next = jest.fn();
    const req = { user: { designation: 'admin' } };
    mw(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('is case-insensitive on both the allowed list and req.user.designation', () => {
    const mw = requireDesignation(['CEO', 'CFO', 'admin']);
    const next = jest.fn();
    const req = { user: { designation: 'CeO' } };
    mw(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects with 403 when req.user.designation is not in the allowed list', () => {
    const mw = requireDesignation(['CEO', 'CFO', 'admin']);
    const next = jest.fn();
    const res = mockRes();
    const req = { user: { designation: 'employee' } };
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' })
    );
  });

  it('rejects with 403 when req.user is missing entirely (e.g. auth middleware not run)', () => {
    const mw = requireDesignation(['CEO', 'CFO', 'admin']);
    const next = jest.fn();
    const res = mockRes();
    mw({}, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects when req.user.designation is undefined', () => {
    const mw = requireDesignation(['CEO', 'CFO', 'admin']);
    const next = jest.fn();
    const res = mockRes();
    mw({ user: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('includes the allowed designations in the error message', () => {
    const mw = requireDesignation(['CEO', 'CFO', 'admin']);
    const res = mockRes();
    mw({ user: { designation: 'employee' } }, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ result: expect.stringContaining('CEO or CFO or admin') })
    );
  });
});
