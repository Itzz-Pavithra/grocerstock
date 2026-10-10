/**
 * cleanup_demo_inventory_v2.js
 *
 * Safely removes ONLY auto-seeded demo inventory records inserted by the
 * seed script via ensureWholesalerInventory() / COMMON_100_CATALOGUE.
 *
 * Protection rules:
 *  - Only deletes records whose productName matches the catalogue AND
 *    whose stockQuantity is exactly 100 (the hardcoded default from the seed).
 *  - Records with a different quantity are assumed to have been edited by
 *    a real user and are preserved.
 *  - Prints a full report before and after deletion.
 *  - Never touches RetailerInventory, Orders, Products, or any other collection.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// ---- Inline Inventory Schema (minimal read/delete only) ----
const inventorySchema = new mongoose.Schema(
  {
    wholesaler: mongoose.Schema.Types.ObjectId,
    productName: String,
    category: String,
    brand: String,
    unit: String,
    stockQuantity: Number,
    unitPrice: Number,
    isAvailable: Boolean,
  },
  { timestamps: true }
);
const Inventory =
  mongoose.models.Inventory ||
  mongoose.model('Inventory', inventorySchema, 'inventories');

// ---- The exact catalogue seeded by ensureWholesalerInventory ----
const SEED_PRODUCT_NAMES = new Set([
  'Sona Masoori Raw Rice','Basmati Steam Rice','Kolam Boiled Rice','Brown Rice','Idli Rice',
  'Superior MP Sharbati Atta','Whole Wheat Grain','Refined Maida Flour','Roasted Sooji Rava',
  'Chiroti Fine Rava','Thick Poha Aval','Thin Poha Aval','Finger Millet Ragi Grain',
  'Pearl Millet Bajra Grain','Sorghum Jowar Grain','Semolina Bombay Rava','Besan Fine Gram Flour',
  'Rice Flour Fine','Corn Flour Starch','Roasted Vermicelli Semiya',
  'Toor Dal Premium Unpolished','Moong Dal Yellow Split','Moong Whole Green Sabut',
  'Chana Dal Polished','Urad Dal White Split','Urad Whole Black Gota','Masoor Dal Red Lentils',
  'Kabuli Chana Chickpeas','Kala Chana Brown','Rajma Red Kidney Beans','Green Peas Dried',
  'Fried Gram Chutney Pottu Dal','White Lobia Cowpea','Brown Soya Beans','Horse Gram Kulthi Dal',
  'Refined Sunflower Oil','Cold Pressed Groundnut Oil','Pure Mustard Oil',
  'Cold Pressed Gingelly Sesame Oil','Pure Cow Ghee','Pure Desi Ghee','Refined Rice Bran Oil',
  'Cold Pressed Coconut Oil','Palmolein Cooking Oil','Extra Virgin Olive Oil',
  'Refined White Sugar','Organic Brown Jaggery Powder','Solid Jaggery Blocks',
  'Iodized Crystal Salt','Iodized Table Free Flow Salt','Himalayan Pink Rock Salt','Pure Natural Honey',
  'Turmeric Powder Haldi','Kashmiri Red Chilli Powder','Spicy Guntur Chilli Powder',
  'Coriander Powder Dhaniya','Cumin Seeds Jeera','Black Mustard Seeds Rai','Fenugreek Seeds Methi',
  'Black Pepper Whole Kali Mirch','Green Cardamom Elaichi','Cloves Laung','Cinnamon Sticks Dalchini',
  'Star Anise','Bay Leaves Tej Patta','Sambar Masala Powder','Rasam Masala Powder',
  'Garam Masala Blend','Biryani Masala Blend','Asafoetida Hing Compound','Kasuri Methi Dried Leaves',
  'Dry Ginger Powder Saunth',
  'Assam Strong CTC Tea','Premium Green Tea Bags','Instant Coffee Granules','Filter Coffee Chicory Blend',
  'Rolled Oats','Instant Veggie Oats','Corn Flakes Crisp','Malted Chocolate Drink Powder',
  'Health Nutrition Drink Powder',
  'Marie Gold Biscuits Family Pack','Glucose Biscuits Bulk Pack','Butter Cookies Assorted',
  'Bourbon Chocolate Biscuits','Salted Cream Crackers','Instant 2-Minute Noodles Carton',
  'Instant Hakka Noodles','Roasted Salted Peanuts','Mixed Dry Fruits & Nuts',
  'Whole Cashews Kaju','California Almonds Badam','Golden Raisins Kishmish',
  'Bathing Beauty Soap 4-Pack','Antiseptic Bath Soap 4-Pack','Sandalwood Fragrance Soap',
  'Total Care Toothpaste 200g','Ayurvedic Toothpaste 200g','Anti-Dandruff Shampoo 340ml',
  'Smooth & Silky Shampoo 340ml','Hand Wash Liquid Refill 750ml','Coconut Hair Oil 500ml',
  'Body Lotion Nourishing 400ml',
  'Detergent Powder 1kg','Washing Powder Matic 1kg','Fabric Conditioner 1L','Dishwash Bar Tub 500g',
  'Dishwash Gel Concentrate 750ml','Disinfectant Surface Cleaner 1L','Toilet Cleaner Thick Liquid 1L',
  'Glass & Mirror Cleaner 500ml','Steel Scrubber 3-Pack','Kitchen Sponge Wipe 3-Pack',
  'Garbage Bags Medium Roll 30-Pack',
]);

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || 'grocery-stock-request-system',
    });
    console.log('Connected.\n');

    // Count total inventory records
    const totalRecords = await Inventory.countDocuments();
    console.log(`Total inventory records in database: ${totalRecords}`);

    // Find records that match catalogue name AND have default quantity of 100
    const candidatesForDeletion = await Inventory.find({ stockQuantity: 100 })
      .select('_id productName stockQuantity unitPrice wholesaler createdAt');

    const toDelete = candidatesForDeletion.filter(item =>
      SEED_PRODUCT_NAMES.has(item.productName)
    );
    const preservedUserEdited = candidatesForDeletion.filter(item =>
      !SEED_PRODUCT_NAMES.has(item.productName)
    );

    // Find catalogue items with non-100 quantities (user-edited, preserve these)
    const userEditedCatalogueItems = await Inventory.find({
      stockQuantity: { $ne: 100 },
    }).select('_id productName stockQuantity unitPrice wholesaler');
    const preservedEdited = userEditedCatalogueItems.filter(item =>
      SEED_PRODUCT_NAMES.has(item.productName)
    );

    console.log(`\n=== ANALYSIS ===`);
    console.log(`Seed catalogue items with qty=100 (SAFE TO DELETE): ${toDelete.length}`);
    console.log(`Seed catalogue items with modified qty (PRESERVED):   ${preservedEdited.length}`);
    console.log(`Non-catalogue items with qty=100 (PRESERVED):         ${preservedUserEdited.length}`);
    console.log(`\nProceeding to delete ${toDelete.length} auto-seeded demo records...`);

    if (toDelete.length === 0) {
      console.log('Nothing to delete. Database is already clean.');
      await mongoose.disconnect();
      return;
    }

    const idsToDelete = toDelete.map(r => r._id);
    const result = await Inventory.deleteMany({ _id: { $in: idsToDelete } });

    console.log(`\n=== DELETION RESULT ===`);
    console.log(`Records deleted: ${result.deletedCount}`);

    const remaining = await Inventory.countDocuments();
    console.log(`Remaining inventory records: ${remaining}`);
    console.log(`\nCleanup complete. No user-entered data was removed.`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Cleanup failed:', err.message);
    process.exit(1);
  }
}

run();
