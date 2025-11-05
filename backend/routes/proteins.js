const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireOwner } = require('../middleware/roleAuth');
const { syncSectionToJSON } = require('../utils/syncToJSON');

const router = express.Router();

function getSqliteDb(req) {
  const sqlite = req.app?.locals?.db;
  return sqlite?.db;
}

// Validation middleware
const validateProtein = [
  body('name').notEmpty().withMessage('Product name is required'),
  body('base_price').isNumeric().withMessage('Base price must be a number'),
  body('selling_price').isNumeric().withMessage('Selling price must be a number'),
  body('quantity_in_stock').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('supplier_name').optional().isString(),
  body('expiry_date').optional().isISO8601().withMessage('Expiry date must be a valid date')
];

const validateSale = [
  body('units_sold').isInt({ min: 1 }).withMessage('Units sold must be a positive integer')
];

// Get low stock products
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    const db = getSqliteDb(req);
    if (!db) return res.json([]);
    const rows = await new Promise((resolve) => {
      db.all("SELECT * FROM proteins WHERE quantity_in_stock < 5 ORDER BY quantity_in_stock ASC", (err, rs) => resolve(err ? [] : rs));
    });
    res.json(rows);
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

// Get products near expiry
router.get('/expiry', authenticateToken, async (req, res) => {
  try {
    const db = getSqliteDb(req);
    if (!db) return res.json([]);
    const rows = await new Promise((resolve) => {
      db.all("SELECT * FROM proteins WHERE expiry_date IS NOT NULL AND date(expiry_date) <= date('now','+30 day') ORDER BY date(expiry_date) ASC", (err, rs) => resolve(err ? [] : rs));
    });
    res.json(rows);
  } catch (error) {
    console.error('Error fetching near expiry products:', error);
    res.status(500).json({ error: 'Failed to fetch near expiry products' });
  }
});

// Get total protein revenue
router.get('/revenue/total', authenticateToken, async (req, res) => {
  try {
    const db = getSqliteDb(req);
    if (!db) return res.json({ totalRevenue: 0 });
    const row = await new Promise((resolve) => {
      db.get("SELECT COALESCE(SUM(selling_price * units_sold),0) AS totalRevenue FROM proteins", (err, r) => resolve(err ? { totalRevenue: 0 } : r));
    });
    res.json(row);
  } catch (error) {
    console.error('Error fetching protein revenue:', error);
    res.status(500).json({ error: 'Failed to fetch protein revenue' });
  }
});

// Get all protein products
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getSqliteDb(req);
    if (!db) return res.json([]);
    const rows = await new Promise((resolve) => {
      db.all("SELECT * FROM proteins ORDER BY created_at DESC", (err, rs) => resolve(err ? [] : rs));
    });
    res.json(rows);
  } catch (error) {
    console.error('Error fetching proteins:', error);
    res.status(500).json({ error: 'Failed to fetch protein products' });
  }
});

// Get protein by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getSqliteDb(req);
    const { id } = req.params;
    if (!db) return res.status(404).json({ error: 'Protein product not found' });
    const row = await new Promise((resolve) => {
      db.get("SELECT * FROM proteins WHERE id = ?", [id], (err, r) => resolve(err ? null : r));
    });
    if (!row) return res.status(404).json({ error: 'Protein product not found' });
    res.json(row);
  } catch (error) {
    console.error('Error fetching protein:', error);
    res.status(500).json({ error: 'Failed to fetch protein product' });
  }
});

// Create new protein product (Owner only)
router.post('/', authenticateToken, requireOwner, validateProtein, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, base_price, selling_price, quantity_in_stock, supplier_name, expiry_date } = req.body;

    // Validate that selling price is higher than base price
    if (selling_price <= base_price) {
      return res.status(400).json({ error: 'Selling price must be higher than base price' });
    }

    const db = getSqliteDb(req);
    const now = new Date().toISOString();
    const created = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO proteins (name, base_price, selling_price, quantity_in_stock, units_sold, supplier_name, expiry_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        [name, parseFloat(base_price), parseFloat(selling_price), parseInt(quantity_in_stock), supplier_name || null, expiry_date || null, now, now],
        function(err){ if (err) reject(err); else resolve({ id: this.lastID }); }
      );
    });

    await syncSectionToJSON(req.app.locals.db.db, 'proteins');

    res.status(201).json({ id: created.id, name, base_price, selling_price, quantity_in_stock, supplier_name, expiry_date });
  } catch (error) {
    console.error('Error creating protein:', error);
    res.status(500).json({ error: 'Failed to create protein product' });
  }
});

// Update protein product (Owner only)
router.put('/:id', authenticateToken, requireOwner, validateProtein, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, base_price, selling_price, quantity_in_stock, supplier_name, expiry_date } = req.body;

    // Validate that selling price is higher than base price
    if (selling_price <= base_price) {
      return res.status(400).json({ error: 'Selling price must be higher than base price' });
    }

    const db = getSqliteDb(req);
    const now = new Date().toISOString();
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE proteins SET name = ?, base_price = ?, selling_price = ?, quantity_in_stock = ?, supplier_name = ?, expiry_date = ?, updated_at = ? WHERE id = ?`,
        [name, parseFloat(base_price), parseFloat(selling_price), parseInt(quantity_in_stock), supplier_name || null, expiry_date || null, now, id],
        (err) => err ? reject(err) : resolve()
      );
    });

    await syncSectionToJSON(req.app.locals.db.db, 'proteins');

    res.json({ id, name, base_price, selling_price, quantity_in_stock, supplier_name, expiry_date });
  } catch (error) {
    console.error('Error updating protein:', error);
    res.status(500).json({ error: 'Failed to update protein product' });
  }
});

// Record a sale
router.post('/:id/sale', authenticateToken, validateSale, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = getSqliteDb(req);
    const { id } = req.params;
    const { units_sold } = req.body;
    const units = parseInt(units_sold);

    // Check stock
    const product = await new Promise((resolve) => {
      db.get("SELECT id, quantity_in_stock, units_sold FROM proteins WHERE id = ?", [id], (err, r) => resolve(err ? null : r));
    });
    if (!product || product.quantity_in_stock < units) throw new Error('Insufficient stock or product not found');

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE proteins SET quantity_in_stock = quantity_in_stock - ?, units_sold = units_sold + ?, updated_at = ? WHERE id = ?`,
        [units, units, new Date().toISOString(), id],
        (err) => err ? reject(err) : resolve()
      );
    });

    await syncSectionToJSON(req.app.locals.db.db, 'proteins');

    res.json({ message: 'Sale recorded successfully', id, units_sold: units });
  } catch (error) {
    console.error('Error recording sale:', error);
    if (error.message === 'Insufficient stock or product not found') {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to record sale' });
    }
  }
});

// Delete protein product (Owner only)
router.delete('/:id', authenticateToken, requireOwner, async (req, res) => {
  try {
    const db = getSqliteDb(req);
    const { id } = req.params;
    const changes = await new Promise((resolve, reject) => {
      db.run(`DELETE FROM proteins WHERE id = ?`, [id], function(err){ err ? reject(err) : resolve(this.changes); });
    });
    if (!changes) return res.status(404).json({ error: 'Protein product not found' });
    await syncSectionToJSON(req.app.locals.db.db, 'proteins');
    res.json({ message: 'Protein product deleted successfully' });
  } catch (error) {
    console.error('Error deleting protein:', error);
    res.status(500).json({ error: 'Failed to delete protein product' });
  }
});

module.exports = router;