const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const express = require("express");
const app = express();

app.get("/product/:productId", async (req, res) => {
  const productId = req.params.productId;
  
  try {
    const db = admin.firestore();
    let productData = null;
    
    // Try fetching by ID
    let docSnap = await db.collection("products").doc(productId).get();
    if (docSnap.exists) {
      productData = docSnap.data();
    } else {
      // Try fetching by slug
      const querySnap = await db.collection("products").where("slug", "==", productId).limit(1).get();
      if (!querySnap.empty) {
        productData = querySnap.docs[0].data();
      }
    }

    if (!productData) {
      return res.status(404).send("Product not found");
    }

    const title = `${productData.title} | Zbuild`;
    const description = productData.description?.replace(/<[^>]+>/g, "").substring(0, 160) || "Chi tiết sản phẩm Zbuild";
    const image = productData.image || "https://zbuild.click/og-image.jpg";
    const url = `https://zbuild.click/product/${productId}`;

    // If it's a bot, serve a simplified HTML with full metadata
    // If it's a human, we still serve this for Open Graph previews (FB/Zalo)
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="product">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${url}">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="${description}">
    <meta property="twitter:image" content="${image}">

    <!-- Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": "${productData.title}",
      "image": "${image}",
      "description": "${description}",
      "brand": {
        "@type": "Brand",
        "name": "Zbuild"
      },
      "offers": {
        "@type": "Offer",
        "url": "${url}",
        "priceCurrency": "VND",
        "price": "${productData.discountPrice || productData.basePrice || 0}",
        "availability": "https://schema.org/InStock"
      }
    }
    </script>
    
    <!-- Redirect for humans (SPA takeover) -->
    <script>
      window.location.href = "/#/product/${productId}"; 
    </script>
</head>
<body>
    <h1>${productData.title}</h1>
    <p>${description}</p>
    <img src="${image}" alt="${productData.title}">
    <p>Giá: ${Number(productData.discountPrice || productData.basePrice || 0).toLocaleString('vi-VN')}₫</p>
    <hr>
    <p>Đang chuyển hướng bạn đến trang sản phẩm...</p>
</body>
</html>`;

    return res.send(html);
  } catch (error) {
    console.error("SEO Function Error:", error);
    return res.status(500).send("Internal Server Error");
  }
});

// Endpoint for all products as JSON (Bot Feed)
app.get("/api/products.json", async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection("products").orderBy("createdAt", "desc").get();
    const products = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

exports.server = functions.https.onRequest(app);

