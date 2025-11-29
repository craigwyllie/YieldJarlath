const USERNAME = process.env.USERNAME || 'admin';
const PASSWORD = process.env.PASSWORD || 'changeme';

function unauthorized(res) {
  res.setHeader('WWW-Authenticate', 'Basic realm="Gilts"');
  return res.status(401).json({ error: 'Unauthorized' });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    return unauthorized(res);
  }

  const base64Credentials = header.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [user, pass] = credentials.split(':');

  if (user === USERNAME && pass === PASSWORD) {
    return next();
  }

  return unauthorized(res);
}

module.exports = {
  authMiddleware,
};
