
export const parseOfflineInput = (text: string) => {
  console.log("Parsing offline input:", text);
  
  // Normalize text and split into potential items
  const items = text.split(/[;\n|.]/).filter(item => item.trim().length > 3);
  
  for (const item of items) {
    // Extract quantity
    const qtyMatch = item.match(/\b(\d+)\s*(?:x|bags?|packs?|units?|pieces?|pcs|kg|cartons?|box(?:es)?|pair(?:s)?|bottle(?:s)?)?\b/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    
    // Find candidate prices - all numbers with optional decimal and multiplier
    const numbersMatch = [...item.matchAll(/\b([\d,.]+)\s*(k|kilo|thousand|m|million)?\b/gi)];
    let price = 0;
    
    if (numbersMatch.length > 0) {
      let bestMatch = numbersMatch[0];
      // If there are multiple matches and the first matches qty, take the second one as price
      if (numbersMatch.length > 1 && parseInt(numbersMatch[0][1].replace(/,/g, ''), 10) === qty) {
        bestMatch = numbersMatch[1];
      } else {
        // Look for a match that is explicitly prefixed by at/@/for or followed by naira/unit/each/k/million
        const premiumMatch = numbersMatch.find(m => {
          const idx = m.index || 0;
          const preText = item.substring(Math.max(0, idx - 10), idx).toLowerCase();
          const postText = item.substring(idx + m[0].length, Math.min(item.length, idx + m[0].length + 15)).toLowerCase();
          return /at|@|for|each|price/.test(preText) || /naira|each|unit|k|kilo|million/.test(postText);
        });
        if (premiumMatch) {
          bestMatch = premiumMatch;
        }
      }
      
      const numPart = parseFloat(bestMatch[1].replace(/,/g, ''));
      if (!isNaN(numPart)) {
        price = numPart;
        const mult = bestMatch[2] ? bestMatch[2].toLowerCase() : '';
        if (['k', 'kilo', 'thousand'].includes(mult)) price *= 1000;
        else if (['m', 'million'].includes(mult)) price *= 1000000;
      }
    }
    
    // Extract name
    let name = item
      .replace(/\b(\d+)\s*(?:x|bags?|packs?|units?|pieces?|pcs|kg|cartons?|box(?:es)?|pair(?:s)?|bottle(?:s)?)?\b/i, '')
      .replace(/\b([\d,.]+)\s*(?:k|kilo|thousand|m|million)?\b/gi, '')
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
