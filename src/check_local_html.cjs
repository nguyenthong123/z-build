async function run() {
  const url = "http://localhost:3000";
  console.log(`Fetching local storefront HTML from ${url}...`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Status error: ${response.status}`);
      return;
    }
    const html = await response.text();
    console.log("HTML length:", html.length);
    
    // Check if "Sơn sắt" is in the HTML
    const hasSonSat = html.includes("Sơn sắt");
    const hasSSMaKem = html.includes("S.S MẠ KẼM");
    console.log(`HTML includes "Sơn sắt": ${hasSonSat}`);
    console.log(`HTML includes "S.S MẠ KẼM": ${hasSSMaKem}`);
    
    // Print occurrences
    let index = 0;
    while (true) {
      const idx = html.indexOf("Sơn sắt", index);
      if (idx === -1) break;
      console.log(`Found "Sơn sắt" at index ${idx}:`);
      console.log(html.substring(Math.max(0, idx - 100), Math.min(html.length, idx + 200)));
      index = idx + "Sơn sắt".length;
    }
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}
run().catch(console.error);
