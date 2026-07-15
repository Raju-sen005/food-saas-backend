const express = require('express');
const router = express.Router();
const {
  createMenuItem, getAdminMenuItems, updateMenuItem, deleteMenuItem,
  createCombo, getPublicCatalog, getAdminCombos, updateCombo, deleteCombo,
} = require('../controllers/menuController');
const { protect, restrictTo } = require('../middleware/auth');
const tenantContext = require('../middleware/tenant');

// 🔑 restrictTo ko roles ke saath CALL karo — bina call kiye pass karne se request hang ho jaati h
router.use('/admin', protect, restrictTo('OWNER', 'STAFF'), tenantContext);

router.route('/admin/items')
  .post(createMenuItem)
  .get(getAdminMenuItems);

router.route('/admin/items/:id')
  .patch(updateMenuItem)
  .delete(deleteMenuItem);

router.post('/admin/combos', createCombo);
router.get('/admin/combos', getAdminCombos);

router.route('/admin/combos/:id')
  .patch(updateCombo)
  .delete(deleteCombo);

router.get('/public/catalog/:restaurantId', getPublicCatalog);

module.exports = router;