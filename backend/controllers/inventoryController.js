import Inventory from '../models/Inventory.js';

export const getMyInventory = async (req, res) => {
  try {
    const items = await Inventory.find({ wholesaler: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, inventory: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addInventoryItem = async (req, res) => {
  const { productName, category, brand, unit, stockQuantity, unitPrice, minStockThreshold } = req.body;

  if (!productName || !category || !unit || stockQuantity === undefined || unitPrice === undefined) {
    return res.status(400).json({ success: false, message: 'Required fields missing' });
  }

  try {
    const existing = await Inventory.findOne({ wholesaler: req.user._id, productName });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Item already exists in your inventory. Update it instead.' });
    }

    const item = await Inventory.create({
      wholesaler: req.user._id,
      productName,
      category,
      brand,
      unit,
      stockQuantity,
      unitPrice,
      minStockThreshold: minStockThreshold || 10,
      isAvailable: stockQuantity > 0,
    });

    res.status(201).json({ success: true, message: 'Inventory item added', item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateInventoryItem = async (req, res) => {
  const { id } = req.params;
  const { stockQuantity, unitPrice, isAvailable, minStockThreshold } = req.body;

  try {
    const item = await Inventory.findOne({ _id: id, wholesaler: req.user._id });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (stockQuantity !== undefined) item.stockQuantity = stockQuantity;
    if (unitPrice !== undefined) item.unitPrice = unitPrice;
    if (minStockThreshold !== undefined) item.minStockThreshold = minStockThreshold;
    if (isAvailable !== undefined) item.isAvailable = isAvailable;
    else if (stockQuantity !== undefined) item.isAvailable = stockQuantity > 0;

    await item.save();

    res.json({ success: true, message: 'Inventory updated successfully', item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteInventoryItem = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await Inventory.findOneAndDelete({ _id: id, wholesaler: req.user._id });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }
    res.json({ success: true, message: 'Inventory item removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
