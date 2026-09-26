import Inventory from '../models/Inventory.js';

export const COMMON_100_CATALOGUE = [
  // 1. Grains, Flours & Staples (20 items)
  { productName: 'Sona Masoori Raw Rice', category: 'Pantry Staples', brand: 'Royal Harvest', unit: 'kg', unitPrice: 52 },
  { productName: 'Basmati Steam Rice', category: 'Pantry Staples', brand: 'India Gate', unit: 'kg', unitPrice: 95 },
  { productName: 'Kolam Boiled Rice', category: 'Pantry Staples', brand: 'Shree', unit: 'kg', unitPrice: 48 },
  { productName: 'Brown Rice', category: 'Pantry Staples', brand: 'Daawat', unit: 'kg', unitPrice: 70 },
  { productName: 'Idli Rice', category: 'Pantry Staples', brand: 'Heritage', unit: 'kg', unitPrice: 42 },
  { productName: 'Superior MP Sharbati Atta', category: 'Pantry Staples', brand: 'Aashirvaad', unit: 'kg', unitPrice: 46 },
  { productName: 'Whole Wheat Grain', category: 'Pantry Staples', brand: 'Fortune', unit: 'kg', unitPrice: 34 },
  { productName: 'Refined Maida Flour', category: 'Pantry Staples', brand: 'Pillsbury', unit: 'kg', unitPrice: 40 },
  { productName: 'Roasted Sooji Rava', category: 'Pantry Staples', brand: 'Fortune', unit: 'kg', unitPrice: 45 },
  { productName: 'Chiroti Fine Rava', category: 'Pantry Staples', brand: 'Naga', unit: 'kg', unitPrice: 48 },
  { productName: 'Thick Poha Aval', category: 'Pantry Staples', brand: 'MTR', unit: 'kg', unitPrice: 44 },
  { productName: 'Thin Poha Aval', category: 'Pantry Staples', brand: 'MTR', unit: 'kg', unitPrice: 46 },
  { productName: 'Finger Millet Ragi Grain', category: 'Pantry Staples', brand: 'Organic Tattva', unit: 'kg', unitPrice: 38 },
  { productName: 'Pearl Millet Bajra Grain', category: 'Pantry Staples', brand: 'Organic Tattva', unit: 'kg', unitPrice: 35 },
  { productName: 'Sorghum Jowar Grain', category: 'Pantry Staples', brand: 'Organic Tattva', unit: 'kg', unitPrice: 42 },
  { productName: 'Semolina Bombay Rava', category: 'Pantry Staples', brand: 'Fortune', unit: 'kg', unitPrice: 42 },
  { productName: 'Besan Fine Gram Flour', category: 'Pantry Staples', brand: 'Tata Sampann', unit: 'kg', unitPrice: 85 },
  { productName: 'Rice Flour Fine', category: 'Pantry Staples', brand: 'Aashirvaad', unit: 'kg', unitPrice: 40 },
  { productName: 'Corn Flour Starch', category: 'Pantry Staples', brand: 'Weikfield', unit: 'kg', unitPrice: 65 },
  { productName: 'Roasted Vermicelli Semiya', category: 'Pantry Staples', brand: 'Bambino', unit: 'packet', unitPrice: 28 },

  // 2. Pulses & Dals (15 items)
  { productName: 'Toor Dal Premium Unpolished', category: 'Pantry Staples', brand: 'Tata Sampann', unit: 'kg', unitPrice: 155 },
  { productName: 'Moong Dal Yellow Split', category: 'Pantry Staples', brand: 'Tata Sampann', unit: 'kg', unitPrice: 120 },
  { productName: 'Moong Whole Green Sabut', category: 'Pantry Staples', brand: 'Farm Fresh', unit: 'kg', unitPrice: 110 },
  { productName: 'Chana Dal Polished', category: 'Pantry Staples', brand: 'Fortune', unit: 'kg', unitPrice: 88 },
  { productName: 'Urad Dal White Split', category: 'Pantry Staples', brand: 'Tata Sampann', unit: 'kg', unitPrice: 135 },
  { productName: 'Urad Whole Black Gota', category: 'Pantry Staples', brand: 'Organic Tattva', unit: 'kg', unitPrice: 130 },
  { productName: 'Masoor Dal Red Lentils', category: 'Pantry Staples', brand: 'Fortune', unit: 'kg', unitPrice: 92 },
  { productName: 'Kabuli Chana Chickpeas', category: 'Pantry Staples', brand: 'Tata Sampann', unit: 'kg', unitPrice: 140 },
  { productName: 'Kala Chana Brown', category: 'Pantry Staples', brand: 'Farm Fresh', unit: 'kg', unitPrice: 85 },
  { productName: 'Rajma Red Kidney Beans', category: 'Pantry Staples', brand: 'Tata Sampann', unit: 'kg', unitPrice: 130 },
  { productName: 'Green Peas Dried', category: 'Pantry Staples', brand: 'Farm Fresh', unit: 'kg', unitPrice: 90 },
  { productName: 'Fried Gram Chutney Pottu Dal', category: 'Pantry Staples', brand: 'Shree', unit: 'kg', unitPrice: 95 },
  { productName: 'White Lobia Cowpea', category: 'Pantry Staples', brand: 'Organic Tattva', unit: 'kg', unitPrice: 98 },
  { productName: 'Brown Soya Beans', category: 'Pantry Staples', brand: 'Nutrela', unit: 'kg', unitPrice: 75 },
  { productName: 'Horse Gram Kulthi Dal', category: 'Pantry Staples', brand: 'Farm Fresh', unit: 'kg', unitPrice: 80 },

  // 3. Edible Oils & Ghee (10 items)
  { productName: 'Refined Sunflower Oil', category: 'Pantry Staples', brand: 'Fortune', unit: 'liter', unitPrice: 135 },
  { productName: 'Cold Pressed Groundnut Oil', category: 'Pantry Staples', brand: 'Idhayam', unit: 'liter', unitPrice: 195 },
  { productName: 'Pure Mustard Oil', category: 'Pantry Staples', brand: 'Fortune', unit: 'liter', unitPrice: 145 },
  { productName: 'Cold Pressed Gingelly Sesame Oil', category: 'Pantry Staples', brand: 'Idhayam', unit: 'liter', unitPrice: 240 },
  { productName: 'Pure Cow Ghee', category: 'Dairy & Eggs', brand: 'Amul', unit: 'liter', unitPrice: 580 },
  { productName: 'Pure Desi Ghee', category: 'Dairy & Eggs', brand: 'Nandini', unit: 'liter', unitPrice: 620 },
  { productName: 'Refined Rice Bran Oil', category: 'Pantry Staples', brand: 'Saffola Gold', unit: 'liter', unitPrice: 140 },
  { productName: 'Cold Pressed Coconut Oil', category: 'Pantry Staples', brand: 'Parachute', unit: 'liter', unitPrice: 220 },
  { productName: 'Palmolein Cooking Oil', category: 'Pantry Staples', brand: 'Ruchi Gold', unit: 'liter', unitPrice: 110 },
  { productName: 'Extra Virgin Olive Oil', category: 'Pantry Staples', brand: 'Borges', unit: 'liter', unitPrice: 750 },

  // 4. Sugars, Sweeteners & Salt (7 items)
  { productName: 'Refined White Sugar', category: 'Pantry Staples', brand: 'Madhur', unit: 'kg', unitPrice: 44 },
  { productName: 'Organic Brown Jaggery Powder', category: 'Pantry Staples', brand: 'Organic Tattva', unit: 'kg', unitPrice: 75 },
  { productName: 'Solid Jaggery Blocks', category: 'Pantry Staples', brand: 'Farm Fresh', unit: 'kg', unitPrice: 65 },
  { productName: 'Iodized Crystal Salt', category: 'Pantry Staples', brand: 'Tata Salt', unit: 'kg', unitPrice: 18 },
  { productName: 'Iodized Table Free Flow Salt', category: 'Pantry Staples', brand: 'Tata Salt', unit: 'kg', unitPrice: 24 },
  { productName: 'Himalayan Pink Rock Salt', category: 'Pantry Staples', brand: 'Tata Sampann', unit: 'kg', unitPrice: 60 },
  { productName: 'Pure Natural Honey', category: 'Pantry Staples', brand: 'Dabur', unit: 'kg', unitPrice: 360 },

  // 5. Spices, Masalas & Seasonings (20 items)
  { productName: 'Turmeric Powder Haldi', category: 'Pantry Staples', brand: 'Everest', unit: 'kg', unitPrice: 180 },
  { productName: 'Kashmiri Red Chilli Powder', category: 'Pantry Staples', brand: 'Everest', unit: 'kg', unitPrice: 290 },
  { productName: 'Spicy Guntur Chilli Powder', category: 'Pantry Staples', brand: 'Aashirvaad', unit: 'kg', unitPrice: 240 },
  { productName: 'Coriander Powder Dhaniya', category: 'Pantry Staples', brand: 'Catch', unit: 'kg', unitPrice: 160 },
  { productName: 'Cumin Seeds Jeera', category: 'Pantry Staples', brand: 'Catch', unit: 'kg', unitPrice: 420 },
  { productName: 'Black Mustard Seeds Rai', category: 'Pantry Staples', brand: 'Tata Sampann', unit: 'kg', unitPrice: 110 },
  { productName: 'Fenugreek Seeds Methi', category: 'Pantry Staples', brand: 'Tata Sampann', unit: 'kg', unitPrice: 95 },
  { productName: 'Black Pepper Whole Kali Mirch', category: 'Pantry Staples', brand: 'Catch', unit: 'kg', unitPrice: 750 },
  { productName: 'Green Cardamom Elaichi', category: 'Pantry Staples', brand: 'Catch', unit: 'kg', unitPrice: 2400 },
  { productName: 'Cloves Laung', category: 'Pantry Staples', brand: 'Catch', unit: 'kg', unitPrice: 1100 },
  { productName: 'Cinnamon Sticks Dalchini', category: 'Pantry Staples', brand: 'Catch', unit: 'kg', unitPrice: 600 },
  { productName: 'Star Anise', category: 'Pantry Staples', brand: 'Farm Fresh', unit: 'kg', unitPrice: 850 },
  { productName: 'Bay Leaves Tej Patta', category: 'Pantry Staples', brand: 'Catch', unit: 'kg', unitPrice: 200 },
  { productName: 'Sambar Masala Powder', category: 'Pantry Staples', brand: 'MTR', unit: 'packet', unitPrice: 45 },
  { productName: 'Rasam Masala Powder', category: 'Pantry Staples', brand: 'MTR', unit: 'packet', unitPrice: 45 },
  { productName: 'Garam Masala Blend', category: 'Pantry Staples', brand: 'Everest', unit: 'packet', unitPrice: 65 },
  { productName: 'Biryani Masala Blend', category: 'Pantry Staples', brand: 'Everest', unit: 'packet', unitPrice: 55 },
  { productName: 'Asafoetida Hing Compound', category: 'Pantry Staples', brand: 'LG', unit: 'box', unitPrice: 72 },
  { productName: 'Kasuri Methi Dried Leaves', category: 'Pantry Staples', brand: 'Kasuri', unit: 'packet', unitPrice: 38 },
  { productName: 'Dry Ginger Powder Saunth', category: 'Pantry Staples', brand: 'Catch', unit: 'kg', unitPrice: 340 },

  // 6. Beverages & Breakfast (9 items)
  { productName: 'Assam Strong CTC Tea', category: 'Beverages', brand: 'Tata Tea Gold', unit: 'kg', unitPrice: 320 },
  { productName: 'Premium Green Tea Bags', category: 'Beverages', brand: 'Tetley', unit: 'box', unitPrice: 190 },
  { productName: 'Instant Coffee Granules', category: 'Beverages', brand: 'Nescafe Classic', unit: 'jar', unitPrice: 280 },
  { productName: 'Filter Coffee Chicory Blend', category: 'Beverages', brand: 'Bru Green Label', unit: 'kg', unitPrice: 450 },
  { productName: 'Rolled Oats', category: 'Pantry Staples', brand: 'Quaker', unit: 'kg', unitPrice: 160 },
  { productName: 'Instant Veggie Oats', category: 'Pantry Staples', brand: 'Saffola', unit: 'kg', unitPrice: 175 },
  { productName: 'Corn Flakes Crisp', category: 'Pantry Staples', brand: 'Kelloggs', unit: 'box', unitPrice: 195 },
  { productName: 'Malted Chocolate Drink Powder', category: 'Beverages', brand: 'Bournvita', unit: 'jar', unitPrice: 240 },
  { productName: 'Health Nutrition Drink Powder', category: 'Beverages', brand: 'Horlicks', unit: 'jar', unitPrice: 290 },

  // 7. Packaged Snacks, Dry Fruits & Biscuits (12 items)
  { productName: 'Marie Gold Biscuits Family Pack', category: 'Canned & Packaged Goods', brand: 'Britannia', unit: 'box', unitPrice: 120 },
  { productName: 'Glucose Biscuits Bulk Pack', category: 'Canned & Packaged Goods', brand: 'Parle-G', unit: 'box', unitPrice: 90 },
  { productName: 'Butter Cookies Assorted', category: 'Canned & Packaged Goods', brand: 'Good Day', unit: 'box', unitPrice: 150 },
  { productName: 'Bourbon Chocolate Biscuits', category: 'Canned & Packaged Goods', brand: 'Britannia', unit: 'box', unitPrice: 130 },
  { productName: 'Salted Cream Crackers', category: 'Canned & Packaged Goods', brand: 'Britannia', unit: 'box', unitPrice: 110 },
  { productName: 'Instant 2-Minute Noodles Carton', category: 'Canned & Packaged Goods', brand: 'Maggi', unit: 'box', unitPrice: 240 },
  { productName: 'Instant Hakka Noodles', category: 'Canned & Packaged Goods', brand: 'Chings', unit: 'packet', unitPrice: 45 },
  { productName: 'Roasted Salted Peanuts', category: 'Canned & Packaged Goods', brand: 'Haldirams', unit: 'kg', unitPrice: 180 },
  { productName: 'Mixed Dry Fruits & Nuts', category: 'Pantry Staples', brand: 'Happilo', unit: 'kg', unitPrice: 850 },
  { productName: 'Whole Cashews Kaju', category: 'Pantry Staples', brand: 'Happilo', unit: 'kg', unitPrice: 920 },
  { productName: 'California Almonds Badam', category: 'Pantry Staples', brand: 'Happilo', unit: 'kg', unitPrice: 780 },
  { productName: 'Golden Raisins Kishmish', category: 'Pantry Staples', brand: 'Happilo', unit: 'kg', unitPrice: 320 },

  // 8. Personal Care & Hygiene (10 items)
  { productName: 'Bathing Beauty Soap 4-Pack', category: 'Canned & Packaged Goods', brand: 'Dove', unit: 'box', unitPrice: 140 },
  { productName: 'Antiseptic Bath Soap 4-Pack', category: 'Canned & Packaged Goods', brand: 'Dettol', unit: 'box', unitPrice: 130 },
  { productName: 'Sandalwood Fragrance Soap', category: 'Canned & Packaged Goods', brand: 'Mysore Sandal', unit: 'box', unitPrice: 160 },
  { productName: 'Total Care Toothpaste 200g', category: 'Canned & Packaged Goods', brand: 'Colgate', unit: 'tube', unitPrice: 95 },
  { productName: 'Ayurvedic Toothpaste 200g', category: 'Canned & Packaged Goods', brand: 'Dabur Red', unit: 'tube', unitPrice: 110 },
  { productName: 'Anti-Dandruff Shampoo 340ml', category: 'Canned & Packaged Goods', brand: 'Head & Shoulders', unit: 'bottle', unitPrice: 220 },
  { productName: 'Smooth & Silky Shampoo 340ml', category: 'Canned & Packaged Goods', brand: 'Pantene', unit: 'bottle', unitPrice: 210 },
  { productName: 'Hand Wash Liquid Refill 750ml', category: 'Canned & Packaged Goods', brand: 'Lifebuoy', unit: 'pouch', unitPrice: 99 },
  { productName: 'Coconut Hair Oil 500ml', category: 'Canned & Packaged Goods', brand: 'Parachute', unit: 'bottle', unitPrice: 175 },
  { productName: 'Body Lotion Nourishing 400ml', category: 'Canned & Packaged Goods', brand: 'Nivea', unit: 'bottle', unitPrice: 260 },

  // 9. Cleaning & Household Supplies (11 items)
  { productName: 'Detergent Powder 1kg', category: 'Canned & Packaged Goods', brand: 'Surf Excel', unit: 'kg', unitPrice: 115 },
  { productName: 'Washing Powder Matic 1kg', category: 'Canned & Packaged Goods', brand: 'Ariel', unit: 'kg', unitPrice: 140 },
  { productName: 'Fabric Conditioner 1L', category: 'Canned & Packaged Goods', brand: 'Comfort', unit: 'bottle', unitPrice: 190 },
  { productName: 'Dishwash Bar Tub 500g', category: 'Canned & Packaged Goods', brand: 'Vim', unit: 'tub', unitPrice: 42 },
  { productName: 'Dishwash Gel Concentrate 750ml', category: 'Canned & Packaged Goods', brand: 'Pril', unit: 'bottle', unitPrice: 145 },
  { productName: 'Disinfectant Surface Cleaner 1L', category: 'Canned & Packaged Goods', brand: 'Lizol', unit: 'bottle', unitPrice: 165 },
  { productName: 'Toilet Cleaner Thick Liquid 1L', category: 'Canned & Packaged Goods', brand: 'Harpic', unit: 'bottle', unitPrice: 175 },
  { productName: 'Glass & Mirror Cleaner 500ml', category: 'Canned & Packaged Goods', brand: 'Colin', unit: 'bottle', unitPrice: 95 },
  { productName: 'Steel Scrubber 3-Pack', category: 'Canned & Packaged Goods', brand: 'Scotch-Brite', unit: 'pack', unitPrice: 35 },
  { productName: 'Kitchen Sponge Wipe 3-Pack', category: 'Canned & Packaged Goods', brand: 'Scotch-Brite', unit: 'pack', unitPrice: 85 },
  { productName: 'Garbage Bags Medium Roll 30-Pack', category: 'Canned & Packaged Goods', brand: 'Shalimar', unit: 'roll', unitPrice: 95 },
];

/**
 * Ensures that a given wholesaler has the standard 100-item common stock catalogue.
 * Initial quantity for each common stock item is set to 100.
 * If the wholesaler already has items, existing items are PRESERVED and NOT overwritten.
 */
export async function ensureWholesalerInventory(wholesalerUserId) {
  if (!wholesalerUserId) return;

  try {
    const existing = await Inventory.find({ wholesaler: wholesalerUserId }).select('productName');
    const existingSet = new Set(existing.map((item) => (item.productName || '').toLowerCase().trim()));

    const itemsToCreate = [];
    for (const item of COMMON_100_CATALOGUE) {
      const normalizedName = item.productName.toLowerCase().trim();
      if (!existingSet.has(normalizedName)) {
        itemsToCreate.push({
          wholesaler: wholesalerUserId,
          productName: item.productName,
          category: item.category,
          brand: item.brand || '',
          unit: item.unit,
          stockQuantity: 100, // Common initial 100 stock units
          unitPrice: item.unitPrice,
          minStockThreshold: 15,
          leadTimeDays: 2,
          reorderQuantity: 50,
          isAvailable: true,
        });
      }
    }

    if (itemsToCreate.length > 0) {
      await Inventory.insertMany(itemsToCreate, { ordered: false });
    }
  } catch (err) {
    console.error(`Failed to ensure 100-stock inventory for wholesaler ${wholesalerUserId}:`, err.message);
  }
}
