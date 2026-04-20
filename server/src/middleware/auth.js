import jwt from 'jsonwebtoken';
import 'dotenv/config';

// Verify trainer JWT (issued by /auth/login)
function requireTrainer(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'trainer') {
      return res.status(403).json({ error: 'Trainer access required' });
    }
    req.trainer = payload; // { id, email, name, tenantId, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Verify trainee JWT (issued by /auth/liff after LIFF token verification)
function requireTrainee(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'trainee') {
      return res.status(403).json({ error: 'Trainee access required' });
    }
    req.trainee = payload; // { id, lineUid, displayName, tenantId, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Allow both roles (e.g. cancel booking)
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export { requireTrainer, requireTrainee, requireAuth };
