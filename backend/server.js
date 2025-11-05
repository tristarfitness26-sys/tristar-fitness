const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const env = require('./config/env');
const SQLiteDatabase = require('./database/sqlite');
const logger = require('./config/logger');
const { createRateLimiters, securityMiddleware, corsOptions, requestLimits } = require('./middleware/security');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const { syncSectionToJSON, writeSectionJSON } = require('./utils/syncToJSON');

console.log('🚀 Starting TriStar Fitness Backend Server...');

// Initialize Express app
const app = express();
const PORT = env.PORT;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`📋 Environment: ${NODE_ENV}`);
console.log(`🔌 Port: ${PORT}`);

// Enforce JWT secret in production
if (NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('❌ Missing JWT_SECRET in production. Set JWT_SECRET environment variable.');
  process.exit(1);
}

// Production data store - no demo data
const dataStore = {
  members: [],
  trainers: [],
  sessions: [],
  visitors: [],
  invoices: [],
  followUps: [],
  activities: [],
  proteins: []
};

// Initialize SQLite database
const db = new SQLiteDatabase();
db.initialize()
  .then(() => {
    logger.info('✅ SQLite database connected successfully');
    return db.insertDemoData();
  })
  .then(() => {
    logger.info('✅ Essential users initialized');
    app.locals.db = db;
    // Load data from SQLite into in-memory dataStore
    return loadDataFromDatabase(db);
  })
  .then(() => {
    logger.info('✅ Data loaded from database to memory');
    // Auto-sync data to JSON files for frontend
    return syncSectionToJSON(db.db, 'all');
  })
  .then(() => {
    logger.info('✅ Data synced to JSON files');
  })
  .catch(err => {
    console.error('❌ Database error:', err);
    logger.error('Database initialization failed:', err);
  });

// Function to load data from SQLite database into in-memory dataStore
async function loadDataFromDatabase(db) {
  try {
    // Load members
    const members = await new Promise((resolve, reject) => {
      db.db.all("SELECT * FROM members", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Load invoices
    const invoices = await new Promise((resolve, reject) => {
      db.db.all("SELECT * FROM invoices", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Load activities
    const activities = await new Promise((resolve, reject) => {
      db.db.all("SELECT * FROM activities", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Load follow-ups
    const followUps = await new Promise((resolve, reject) => {
      db.db.all("SELECT * FROM follow_ups", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Load visitors
    const visitors = await new Promise((resolve, reject) => {
      db.db.all("SELECT * FROM visitors", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Load proteins
    const proteins = await new Promise((resolve, reject) => {
      db.db.all("SELECT * FROM proteins", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Update the in-memory dataStore with loaded data
    dataStore.members = members;
    dataStore.invoices = invoices;
    dataStore.activities = activities;
    dataStore.followUps = followUps;
    dataStore.visitors = visitors;
    dataStore.proteins = proteins;

    console.log(`✅ Loaded ${members.length} members, ${invoices.length} invoices, ${activities.length} activities from database`);
  } catch (error) {
    console.error('❌ Error loading data from database:', error);
    throw error;
  }
}

// Initialize cache (optional for now) - disabled for production
console.log('⚠️  Redis cache disabled for production');

// Create rate limiters
const rateLimiters = createRateLimiters();

console.log('🔒 Security middleware initialized');

// Security middleware
app.use(securityMiddleware);

// Compression middleware
app.use(compression());

// CORS configuration
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true
}));

// Request parsing middleware
app.use(express.json(requestLimits.json));
app.use(express.urlencoded(requestLimits.urlencoded));

// Enhanced logging with Winston
app.use(morgan('combined', { stream: logger.stream }));

// API logging middleware
app.use(logger.logAPI);

console.log('📝 Logging middleware initialized');

// Rate limiting
app.use('/api/', rateLimiters.general);
app.use('/api/auth', rateLimiters.auth);
app.use('/api/upload', rateLimiters.upload);

// Swagger API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'TriStar Fitness API Documentation',
}));

// Serve JSON cache statically
app.use('/api/static', express.static(path.resolve(__dirname, 'data')));
// Back-compat: serve raw data path used by frontend fallbacks
app.use('/backend/data', express.static(path.resolve(__dirname, 'data')));

console.log('📚 Swagger documentation initialized');

const { authenticateToken } = require('./middleware/roleAuth');

// Enhanced error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details
    });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      error: 'Not Found',
      message: err.message
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong on the server',
    timestamp: new Date().toISOString()
  });
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'TriStar Fitness API',
    version: '1.0.0',
    description: 'Gym Management System API',
    endpoints: {
      auth: '/api/auth',
      members: '/api/members',
      trainers: '/api/trainers',
      visitors: '/api/visitors',
      invoices: '/api/invoices',
      sessions: '/api/sessions',
      followups: '/api/followups',
      activities: '/api/activities',
      analytics: '/api/analytics'
    },
    documentation: '/api/docs'
  });
});

// Import and use routes
app.use('/api/auth', require('./routes/auth'));
// Load route modules
const membersRouter = require('./routes/members');
const trainersRouter = require('./routes/trainers');
const visitorsRouter = require('./routes/visitors');
const invoicesRouter = require('./routes/invoices');
const sessionsRouter = require('./routes/sessions');
const followupsRouter = require('./routes/followups');
const activitiesRouter = require('./routes/activities');
const proteinsRouter = require('./routes/proteins');

// Register routes
app.use('/api/members', membersRouter);
app.use('/api/trainers', trainersRouter);
app.use('/api/visitors', visitorsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/followups', followupsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/proteins', proteinsRouter);

// JSON sync endpoints
app.post('/api/sync/:section', authenticateToken, async (req, res) => {
  try {
    const section = req.params.section;
    const result = await syncSectionToJSON(app.locals.db.db, section);
    if (!result.success) return res.status(500).json(result);
    res.json({ success: true, section });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sync-all', authenticateToken, async (req, res) => {
  try {
    const result = await syncSectionToJSON(app.locals.db.db, 'all');
    if (!result.success) return res.status(500).json(result);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Refresh in-memory data from database
app.post('/api/refresh-data', authenticateToken, async (req, res) => {
  try {
    await loadDataFromDatabase(app.locals.db);
    // Also sync to JSON files
    await syncSectionToJSON(app.locals.db.db, 'all');
    res.json({ 
      success: true, 
      message: 'Data refreshed successfully',
      counts: {
        members: dataStore.members.length,
        invoices: dataStore.invoices.length,
        activities: dataStore.activities.length,
        followUps: dataStore.followUps.length,
        visitors: dataStore.visitors.length,
        proteins: dataStore.proteins.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Monthly revenue endpoint from Paid invoices (amount_paid)
app.get('/api/analytics/monthly-revenue', authenticateToken, async (req, res) => {
  try {
    const sqlite = req.app.locals.db;
    const month = (req.query.month || new Date().toISOString().slice(0,7)); // YYYY-MM
    if (!sqlite || !sqlite.db) return res.json({ month, totalPaid: 0, breakdown: [] });
    const rows = await new Promise((resolve) => {
      sqlite.db.all(
        "SELECT date(created_at) as date, COALESCE(amount_paid, total, amount) as amount_paid, status FROM invoices WHERE status='paid' AND substr(created_at,1,7)=? ORDER BY date(created_at)",
        [month],
        (err, rs) => resolve(err ? [] : rs)
      );
    });
    const total = rows.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
    const breakdown = rows.map(r => ({ date: r.date, amount: Number(r.amount_paid || 0) }));
    res.json({ month, totalPaid: total, breakdown });
  } catch (error) {
    console.error('Monthly revenue error:', error);
    res.status(500).json({ error: 'Failed to compute monthly revenue' });
  }
});

// Analytics endpoint
app.get('/api/analytics', authenticateToken, async (req, res) => {
  try {
    const sqlite = req.app.locals.db;
    if (!sqlite || !sqlite.db) return res.json({ success: true, data: {}, timestamp: new Date().toISOString() });
    const [members, invoices, activities] = await Promise.all([
      sqlite.getMembers(),
      sqlite.getInvoices(),
      sqlite.getActivities()
    ]);
    const analytics = {
      members: {
        total: members.length,
        active: members.filter(m => m.status === 'active').length,
        expiring: members.filter(m => {
          const expiryDate = new Date(m.end_date || m.expiryDate);
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          return expiryDate <= thirtyDaysFromNow && (m.status === 'active' || !m.status);
        }).length
      },
      revenue: {
        total: invoices.filter(inv => inv.status === 'paid').reduce((s, i) => s + Number(i.amount_paid ?? i.total ?? i.amount ?? 0), 0),
        pending: invoices.filter(inv => inv.status === 'pending').reduce((s, i) => s + Number(i.amount_paid ?? 0), 0),
        overdue: invoices.filter(inv => inv.status === 'overdue').reduce((s, i) => s + Number(i.amount_paid ?? 0), 0)
      },
      activities: {
        today: activities.filter(a => new Date(a.time).toDateString() === new Date().toDateString()).length
      }
    };
    res.json({ success: true, data: analytics, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to generate analytics', message: error.message });
  }
});

// Admin: Reset demo database (deletes DB file and recreates empty schema)
app.post('/api/admin/reset-demo', authenticateToken, async (req, res) => {
  try {
    const dbPath = require('path').resolve(__dirname, 'data', 'tristar.db');
    if (fs.existsSync(dbPath)) {
      await fs.promises.unlink(dbPath);
    }
    const freshDb = new SQLiteDatabase();
    await freshDb.initialize();
    app.locals.db = freshDb;
    return res.json({ success: true, message: 'Database reset successfully' });
  } catch (e) {
    console.error('Reset demo DB error:', e);
    return res.status(500).json({ success: false, message: 'Failed to reset database' });
  }
});

// Analytics export endpoint (SQLite -> Excel)
app.get('/api/analytics/export', authenticateToken, async (req, res) => {
  try {
    const sqlite = req.app.locals.db;
    if (!sqlite || !sqlite.db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    let members = [];
    let invoices = [];
    let activities = [];
    try {
      members = await sqlite.getMembers();
      invoices = await sqlite.getInvoices();
      activities = await sqlite.getActivities();
    } catch {}
    // If DB has no rows (or feature is running in offline/in-memory), fallback to in-memory store
    if (!members || members.length === 0) members = dataStore.members || [];
    if (!invoices || invoices.length === 0) invoices = dataStore.invoices || [];
    if (!activities || activities.length === 0) activities = dataStore.activities || [];

    const exportsDir = path.resolve(__dirname, 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analytics_export_${timestamp}.xlsx`;
    const filepath = path.join(exportsDir, filename);

    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Summary');
    const membersSheet = workbook.addWorksheet('Members');
    const invoicesSheet = workbook.addWorksheet('Invoices');
    const activitiesSheet = workbook.addWorksheet('Activities');

    // Summary
    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (Number(i.amount_paid ?? i.total ?? i.amount) || 0), 0);
    const pendingRevenue = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + (Number(i.amount_paid ?? 0) || 0), 0);
    const overdueRevenue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + (Number(i.amount_paid ?? 0) || 0), 0);
    summarySheet.addRows([
      ['Metric', 'Value'],
      ['Total Members', members.length],
      ['Total Paid Revenue', totalRevenue],
      ['Pending Revenue', pendingRevenue],
      ['Overdue Revenue', overdueRevenue]
    ]);

    // Members
    membersSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Membership Type', key: 'membership_type', width: 16 },
      { header: 'Start Date', key: 'start_date', width: 12 },
      { header: 'End Date', key: 'end_date', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Trainer', key: 'trainer', width: 18 }
    ];
    members.forEach(m => membersSheet.addRow(m));

    // Invoices
    invoicesSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Member ID', key: 'member_id', width: 10 },
      { header: 'Member Name', key: 'member_name', width: 24 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Due Date', key: 'due_date', width: 14 },
      { header: 'Created At', key: 'created_at', width: 20 }
    ];
    invoices.forEach(i => invoicesSheet.addRow({
      id: i.id,
      member_id: i.memberId || i.member_id,
      member_name: i.memberName || i.member_name,
      amount: i.amount ?? i.total,
      status: i.status,
      total: i.total ?? i.amount,
      due_date: i.dueDate || i.due_date,
      created_at: i.createdAt || i.created_at,
    }));

    // Activities
    activitiesSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Action', key: 'action', width: 24 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Time', key: 'time', width: 20 },
      { header: 'Details', key: 'details', width: 32 },
      { header: 'Member ID', key: 'member_id', width: 10 },
      { header: 'Invoice ID', key: 'invoice_id', width: 10 }
    ];
    activities.forEach(a => activitiesSheet.addRow(a));

    // Write to buffer and file, then stream to client with proper headers
    const buffer = await workbook.xlsx.writeBuffer();
    await fs.promises.writeFile(filepath, Buffer.from(buffer));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Analytics export error:', error);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

// Analytics export (from client-provided data) - POST endpoint
app.post('/api/analytics/export-client', express.json({ limit: '2mb' }), authenticateToken, async (req, res) => {
  try {
    const { members = [], invoices = [], activities = [] } = req.body || {};
    const exportsDir = path.resolve(__dirname, 'exports');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analytics_export_${timestamp}.xlsx`;
    const filepath = path.join(exportsDir, filename);

    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Summary');
    const membersSheet = workbook.addWorksheet('Members');
    const invoicesSheet = workbook.addWorksheet('Invoices');
    const activitiesSheet = workbook.addWorksheet('Activities');

    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (Number(i.amount_paid ?? i.total ?? i.amount) || 0), 0);
    const pendingRevenue = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + (Number(i.amount_paid ?? 0) || 0), 0);
    const overdueRevenue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + (Number(i.amount_paid ?? 0) || 0), 0);
    summarySheet.addRows([
      ['Metric', 'Value'],
      ['Total Members', members.length],
      ['Total Paid Revenue', totalRevenue],
      ['Pending Revenue', pendingRevenue],
      ['Overdue Revenue', overdueRevenue]
    ]);

    membersSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Membership Type', key: 'membershipType', width: 16 },
      { header: 'Start Date', key: 'startDate', width: 12 },
      { header: 'End Date', key: 'endDate', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Trainer', key: 'trainer', width: 18 }
    ];
    members.forEach(m => membersSheet.addRow(m));

    invoicesSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Member ID', key: 'memberId', width: 10 },
      { header: 'Member Name', key: 'memberName', width: 24 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Due Date', key: 'dueDate', width: 14 },
      { header: 'Created At', key: 'createdAt', width: 20 }
    ];
    invoices.forEach(i => invoicesSheet.addRow(i));

    activitiesSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Action', key: 'action', width: 24 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Time', key: 'time', width: 20 },
      { header: 'Details', key: 'details', width: 32 }
    ];
    activities.forEach(a => activitiesSheet.addRow(a));

    const buffer = await workbook.xlsx.writeBuffer();
    await fs.promises.writeFile(filepath, Buffer.from(buffer));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error('Analytics export (POST) error:', e);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

// Database file export (download raw .db)
app.get('/api/export/db', authenticateToken, async (req, res) => {
  try {
    const dbPath = path.resolve(__dirname, 'data', 'tristar.db');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found' });
    }
    const filename = `tristar_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    res.download(dbPath, filename);
  } catch (e) {
    console.error('DB export error:', e);
    res.status(500).json({ error: 'Failed to export database' });
  }
});

// CSV export per table
app.get('/api/export/csv/:table', authenticateToken, async (req, res) => {
  try {
    const sqlite = req.app.locals.db;
    if (!sqlite || !sqlite.db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }
    const table = req.params.table;
    // Allow any known export key; if table doesn't exist, stream empty CSV
    const allowed = new Set(['members', 'invoices', 'activities', 'check_ins', 'follow_ups', 'visitors', 'payments']);
    if (!allowed.has(table)) {
      return res.status(400).json({ error: 'Invalid table' });
    }

    sqlite.db.all(`SELECT * FROM ${table}`,(err, rows) => {
      const filename = `${table}_export_${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      let data = rows;
      if (err) {
        console.warn(`CSV export query error for ${table}:`, err.message);
      }
      // If DB query failed or returned empty, fallback to in-memory dataStore
      if (!data || data.length === 0) {
        const map = {
          members: dataStore.members,
          invoices: dataStore.invoices,
          activities: dataStore.activities,
          check_ins: [],
          follow_ups: dataStore.followUps,
          visitors: dataStore.visitors,
          payments: [],
        };
        data = map[table] || [];
      }

      if (!data || data.length === 0) {
        return res.send('');
      }
      const headers = Object.keys(data[0]);
      const csv = [headers.join(',')].concat(
        data.map((r) => headers.map((h) => {
          const v = r[h] == null ? '' : String(r[h]).replace(/"/g, '""');
          return /[,\"]/.test(v) ? `"${v}"` : v;
        }).join(','))
      ).join('\n');
      res.send(csv);
    });
  } catch (e) {
    console.error('CSV export error:', e);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Export all CSVs as a single ZIP
app.get('/api/export/all.zip', authenticateToken, async (req, res) => {
  try {
    const sqlite = req.app.locals.db;
    if (!sqlite || !sqlite.db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="tristar_export_${timestamp}.zip"`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('warning', (err) => console.warn('ZIP warning:', err));
    archive.on('error', (err) => {
      console.error('ZIP error:', err);
      try { res.status(500).end(); } catch {}
    });
    archive.pipe(res);

    const tables = ['members', 'invoices', 'activities', 'check_ins', 'follow_ups', 'visitors'];
    for (const table of tables) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        sqlite.db.all(`SELECT * FROM ${table}`, (err, rows) => {
          if (err) {
            console.error(`CSV export query error (${table}):`, err);
            archive.append('', { name: `${table}.csv` });
            return resolve();
          }
          const headers = rows && rows[0] ? Object.keys(rows[0]) : [];
          const csv = rows && rows.length ? [headers.join(',')].concat(
            rows.map((r) => headers.map((h) => {
              const v = r[h] == null ? '' : String(r[h]).replace(/"/g, '""');
              return /[,\"]/.test(v) ? `"${v}"` : v;
            }).join(','))
          ).join('\n') : '';
          archive.append(csv, { name: `${table}.csv` });
          resolve();
        });
      });
    }
    archive.finalize();
  } catch (e) {
    console.error('Export all ZIP error:', e);
    res.status(500).json({ error: 'Failed to export all data' });
  }
});

// Enhanced 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/health',
      '/api',
      '/api/auth',
      '/api/members',
      '/api/trainers',
      '/api/visitors',
      '/api/invoices',
      '/api/sessions',
      '/api/followups',
      '/api/activities',
      '/api/analytics'
    ]
  });
});

// Apply error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 TriStar Fitness API Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API info: http://localhost:${PORT}/api`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = { app };
