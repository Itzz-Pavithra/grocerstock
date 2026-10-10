import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/db.js';
import Inventory from '../models/Inventory.js';
import User from '../models/User.js';
import { COMMON_100_CATALOGUE } from '../services/commonInventoryService.js';

async function cleanup() {
  try {
    await connectDB();
    console.log('Connected to MongoDB for inventory cleanup...');

    const commonNames = new Set(COMMON_100_CATALOGUE.map((i) => i.productName.toLowerCase().trim()));

    // 1. Find all active wholesalers
    const wholesalers = await User.find({ role: 'wholesaler' }).select('_id email');
    console.log('Active wholesalers in system:', wholesalers);

    for (const w of wholesalers) {
      // Find items that match the COMMON_100_CATALOGUE and default stockQuantity: 100
      const items = await Inventory.find({ wholesaler: w._id });
      console.log(`Wholesaler ${w.email} has ${items.length} total inventory items.`);

      const demoItemsToDelete = items.filter((item) =>
        commonNames.has((item.productName || '').toLowerCase().trim()) && item.stockQuantity === 100
      );

      console.log(`Found ${demoItemsToDelete.length} automatically injected demo inventory items for ${w.email}.`);

      if (demoItemsToDelete.length > 0) {
        const ids = demoItemsToDelete.map((i) => i._id);
        const res = await Inventory.deleteMany({ _id: { $in: ids } });
        console.log(`✅ Safely removed ${res.deletedCount} demo inventory records for ${w.email}.`);
      }
    }

    // 2. Clean up orphaned inventory belonging to non-existent wholesaler IDs
    const activeWholesalerIds = (await User.find({ role: 'wholesaler' }).select('_id')).map((u) => u._id.toString());
    const allInventories = await Inventory.find().select('wholesaler');
    const orphanedIds = allInventories
      .filter((inv) => !activeWholesalerIds.includes(inv.wholesaler?.toString()))
      .map((inv) => inv._id);

    if (orphanedIds.length > 0) {
      console.log(`Cleaning up ${orphanedIds.length} orphaned inventory records from old deleted test accounts...`);
      const orphanRes = await Inventory.deleteMany({ _id: { $in: orphanedIds } });
      console.log(`✅ Removed ${orphanRes.deletedCount} orphaned inventory records.`);
    }

    const remainingCount = await Inventory.countDocuments();
    console.log(`Current remaining inventory records in database: ${remainingCount}`);
  } catch (err) {
    console.error('Error during cleanup:', err.message);
  } finally {
    process.exit(0);
  }
}

cleanup();
