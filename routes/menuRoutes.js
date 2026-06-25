const express = require('express');
const router = express.Router();
const { 
  createMenuItem, getAdminMenuItems, updateMenuItem, deleteMenuItem, 
  createCombo, getPublicCatalog 
} = require('../controllers/menuController');
const { protect, authorize } = require('../middleware/auth');
const tenantContext = require('../middleware/tenant');

// Admin CRUD management bindings (Bina multer middleware ke)
router.use('/admin', protect, authorize('OWNER', 'MANAGER'), tenantContext);

router.route('/admin/items')
  .post(createMenuItem)  // standard JSON endpoint
  .get(getAdminMenuItems);

router.route('/admin/items/:id')
  .patch(updateMenuItem) // standard JSON endpoint
  .delete(deleteMenuItem);

router.post('/admin/combos', createCombo);

// Open Customer Catalog endpoints
router.get('/public/catalog/:restaurantId', getPublicCatalog);

module.exports = router;