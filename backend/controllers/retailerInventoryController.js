import RetailerInventory from '../models/RetailerInventory.js';
import RetailSale from '../models/RetailSale.js';
import { safeExactRegex } from '../utils/regex.js';

/**
 * Get all inventory items belonging to the authenticated retailer
 */
export const getMyRetailerInventory = async (req, res) => {
  try {
    const items = await RetailerInventory.find({ retailer: req.user._id }).sort({ productName: 1 });

    const totalValuation = items.reduce((sum, item) => sum + item.stockQuantity * item.averageCostPrice, 0);
    const lowStockCount = items.filter((item) => item.stockQuantity <= item.minStockThreshold).length;

    res.json({
      success: true,
      inventory: items,
      count: items.length,
      totalValuation: Number(totalValuation.toFixed(2)),
      lowStockCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add a new product to retailer store inventory
 */
export const addRetailerInventoryItem = async (req, res) => {
  const { productName, category, brand, unit, stockQuantity, minStockThreshold, averageCostPrice, sellingPrice } =
    req.body;

  if (!productName || !category || !unit) {
    return res.status(400).json({ success: false, message: 'Product name, category, and unit are required.' });
  }

  const initialQty = Math.max(0, Number(stockQuantity) || 0);
  const cost = Math.max(0, Number(averageCostPrice) || 0);
  const sellPrice = Math.max(0, Number(sellingPrice) || 0);
  const threshold = Math.max(0, Number(minStockThreshold) !== undefined ? Number(minStockThreshold) : 10);

  try {
    const existing = await RetailerInventory.findOne({
      retailer: req.user._id,
      productName: safeExactRegex(productName),
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Product "${productName}" already exists in your inventory. Use stock adjustment instead.`,
      });
    }

    const newItem = new RetailerInventory({
      retailer: req.user._id,
      productName: productName.trim(),
      category: category.trim(),
      brand: brand ? brand.trim() : '',
      unit: unit.trim().toLowerCase(),
      stockQuantity: initialQty,
      minStockThreshold: threshold,
      averageCostPrice: cost,
      sellingPrice: sellPrice,
      lastRestockedAt: initialQty > 0 ? new Date() : null,
      stockMovements:
        initialQty > 0
          ? [
              {
                movementType: 'initial_stock',
                quantityChange: initialQty,
                balanceAfter: initialQty,
                unitCost: cost,
                sellingPrice: sellPrice,
                notes: 'Initial inventory creation',
              },
            ]
          : [],
    });

    await newItem.save();
    res.status(201).json({ success: true, message: 'Item added to retailer inventory', item: newItem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Manual stock adjustment (e.g. stock count correction, physical audit, breakage/wastage)
 */
export const adjustRetailerInventoryItem = async (req, res) => {
  const { id } = req.params;
  const { adjustmentType, quantity, notes, newMinThreshold, newSellingPrice } = req.body;

  try {
    const item = await RetailerInventory.findOne({ _id: id, retailer: req.user._id });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (newMinThreshold !== undefined) {
      item.minStockThreshold = Math.max(0, Number(newMinThreshold));
    }
    if (newSellingPrice !== undefined) {
      item.sellingPrice = Math.max(0, Number(newSellingPrice));
    }

    if (quantity !== undefined && quantity !== null) {
      const qty = Number(quantity);
      if (isNaN(qty)) {
        return res.status(400).json({ success: false, message: 'Quantity must be a valid number' });
      }

      let change = 0;
      if (adjustmentType === 'add') {
        change = Math.abs(qty);
      } else if (adjustmentType === 'deduct') {
        change = -Math.abs(qty);
      } else if (adjustmentType === 'set') {
        change = qty - item.stockQuantity;
      } else {
        change = qty;
      }

      const newBalance = item.stockQuantity + change;
      if (newBalance < 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce stock below zero. Current stock is ${item.stockQuantity} ${item.unit}.`,
        });
      }

      item.stockQuantity = newBalance;
      item.stockMovements.push({
        movementType: change < 0 ? 'wastage' : 'manual_adjustment',
        quantityChange: change,
        balanceAfter: newBalance,
        unitCost: item.averageCostPrice,
        notes: notes || `Manual stock adjustment (${adjustmentType || 'custom'})`,
      });
    }

    await item.save();
    res.json({ success: true, message: 'Stock updated successfully', item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Record a retail sale and deduct inventory
 */
export const recordRetailSale = async (req, res) => {
  const { items, paymentMethod, customerNote } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one sale item is required' });
  }

  try {
    const processedItems = [];
    let totalSaleRevenue = 0;
    let totalSaleCost = 0;

    // Validate all items exist and have sufficient stock before making any mutations
    for (const line of items) {
      const pName = (line.productName || '').trim();
      const qty = Number(line.quantity);
      const sellPrice = Number(line.unitSellingPrice);

      if (!pName || isNaN(qty) || qty <= 0 || isNaN(sellPrice) || sellPrice < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid line item: check product name, positive quantity, and selling price.`,
        });
      }

      const invItem = await RetailerInventory.findOne({
        retailer: req.user._id,
        productName: safeExactRegex(pName),
      });

      if (!invItem) {
        return res.status(400).json({
          success: false,
          message: `Product "${pName}" is not present in your store inventory. Add it to stock before recording sales.`,
        });
      }

      if (invItem.stockQuantity < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${pName}". Available: ${invItem.stockQuantity} ${invItem.unit}, requested: ${qty} ${invItem.unit}.`,
        });
      }

      const lineRevenue = Number((qty * sellPrice).toFixed(2));
      const lineCost = Number((qty * invItem.averageCostPrice).toFixed(2));
      const lineProfit = Number((lineRevenue - lineCost).toFixed(2));

      totalSaleRevenue += lineRevenue;
      totalSaleCost += lineCost;

      processedItems.push({
        invItem,
        pName,
        category: invItem.category,
        unit: invItem.unit,
        quantity: qty,
        unitSellingPrice: sellPrice,
        unitCostPrice: invItem.averageCostPrice,
        totalRevenue: lineRevenue,
        totalCost: lineCost,
        grossProfit: lineProfit,
      });
    }

    // Deduct stock and log movements
    for (const processed of processedItems) {
      const { invItem, quantity, totalRevenue, totalCost } = processed;
      const newBalance = Math.max(0, invItem.stockQuantity - quantity);
      invItem.stockQuantity = newBalance;
      invItem.lastSaleAt = new Date();
      invItem.stockMovements.push({
        movementType: 'retail_sale',
        quantityChange: -quantity,
        balanceAfter: newBalance,
        unitCost: invItem.averageCostPrice,
        sellingPrice: processed.unitSellingPrice,
        notes: `Retail Sale: ${quantity} ${invItem.unit} @ ₹${processed.unitSellingPrice}/${invItem.unit}`,
      });
      await invItem.save();
    }

    const saleRecord = await RetailSale.create({
      retailer: req.user._id,
      items: processedItems.map((p) => ({
        productName: p.pName,
        category: p.category,
        unit: p.unit,
        quantity: p.quantity,
        unitSellingPrice: p.unitSellingPrice,
        unitCostPrice: p.unitCostPrice,
        totalRevenue: p.totalRevenue,
        totalCost: p.totalCost,
        grossProfit: p.grossProfit,
      })),
      totalRevenue: Number(totalSaleRevenue.toFixed(2)),
      totalCost: Number(totalSaleCost.toFixed(2)),
      totalGrossProfit: Number((totalSaleRevenue - totalSaleCost).toFixed(2)),
      paymentMethod: paymentMethod || 'cash',
      customerNote: customerNote || '',
    });

    res.status(201).json({
      success: true,
      message: 'Sale recorded and inventory deducted successfully',
      sale: saleRecord,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get sales history for retailer
 */
export const getRetailSalesHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sales = await RetailSale.find({ retailer: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RetailSale.countDocuments({ retailer: req.user._id });

    res.json({
      success: true,
      sales,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Helper function called when an order is delivered to update retailer inventory exactly once.
 */
export async function addDeliveredOrderToRetailerInventory(order) {
  if (!order || !order.retailer) return;

  const deliveredItems =
    order.items && order.items.length > 0
      ? order.items.map((it) => ({
          productName: it.productName,
          category: it.category || 'General',
          brand: it.brand || '',
          quantity: it.quantity,
          unit: it.unit || order.unit,
          unitPrice: it.unitPrice,
        }))
      : [
          {
            productName: order.productName,
            category: 'Pantry Staples',
            brand: '',
            quantity: order.quantity,
            unit: order.unit,
            unitPrice: order.unitPrice,
          },
        ];

  for (const item of deliveredItems) {
    const cleanName = (item.productName || '').trim();
    if (!cleanName || item.quantity <= 0) continue;

    let inv = await RetailerInventory.findOne({
      retailer: order.retailer,
      productName: safeExactRegex(cleanName),
    });

    const receivedQty = item.quantity;
    const purchaseCost = item.unitPrice;

    if (!inv) {
      // Create new retailer inventory record
      inv = new RetailerInventory({
        retailer: order.retailer,
        productName: cleanName,
        category: item.category || 'General',
        brand: item.brand || '',
        unit: (item.unit || 'kg').trim().toLowerCase(),
        stockQuantity: receivedQty,
        minStockThreshold: 10,
        averageCostPrice: purchaseCost,
        sellingPrice: Number((purchaseCost * 1.2).toFixed(2)), // Default 20% markup suggestion
        lastRestockedAt: new Date(),
        stockMovements: [
          {
            movementType: 'procurement_delivery',
            quantityChange: receivedQty,
            balanceAfter: receivedQty,
            referenceId: order._id.toString(),
            unitCost: purchaseCost,
            notes: `Delivered procurement order #${order._id.toString().slice(-6)}`,
          },
        ],
      });
    } else {
      // Update existing record: weighted average cost price
      const oldQty = inv.stockQuantity;
      const oldCost = inv.averageCostPrice || 0;
      const totalNewQty = oldQty + receivedQty;
      const newWeightedCost =
        totalNewQty > 0 ? Number(((oldQty * oldCost + receivedQty * purchaseCost) / totalNewQty).toFixed(2)) : purchaseCost;

      inv.stockQuantity = totalNewQty;
      inv.averageCostPrice = newWeightedCost;
      inv.lastRestockedAt = new Date();
      inv.stockMovements.push({
        movementType: 'procurement_delivery',
        quantityChange: receivedQty,
        balanceAfter: totalNewQty,
        referenceId: order._id.toString(),
        unitCost: purchaseCost,
        notes: `Delivered procurement order #${order._id.toString().slice(-6)}`,
      });
    }

    await inv.save();
  }
}
