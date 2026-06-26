
export const parseOfflineInput = (text: string) => {
  console.log("Parsing offline input:", text);
  
  // Normalize text and split into potential items
  const items = text.split(/[;\n|.]/).filter(item => item.trim().length > 3);
  
  for (const item of items) {
    // Extract quantity
    const qtyMatch = item.match(/(\d+)\s*(?:x|bags?|packs?|units?|pieces?|pcs|kg|cartons?|box(?:es)?|pair(?:s)?|bottle(?:s)?)?/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    
    // Extract price (look for digits potentially followed by k/000)
    const priceMatch = item.match(/([\d,]+)\s*(?:k|kilo|thousand)?/i);
    let price = 0;
    if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (item.toLowerCase().includes('k')) price *= 1000;
    }
    
    // Extract name
    let name = item
        .replace(/(\d+)\s*(?:x|bags?|packs?|units?|pieces?|pcs|kg|cartons?|box(?:es)?|pair(?:s)?|bottle(?:s)?)?/i, '')
        .replace(/([\d,]+)\s*(?:k|kilo|thousand)?/i, '')
        .replace(/[@\-at:()]/g, '')
        .trim();
        
    if (qty > 0 && price > 0 && name.length > 2) {
        return {
          name: name,
          sku: 'SKU-' + name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 100),
          stock: qty,
          price: price
        };
    }
  }
  
  // Fallback
  return {
    name: "Unknown Product",
    sku: "SKU-" + Math.floor(Math.random() * 1000),
    stock: 1,
    price: 0
  };
};
