const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const express = require("express");
const app = express();

app.use(express.json()); // Parse JSON bodies

// Custom CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Hàm tạo slug tự động
const slugify = (text) => {
  if (!text) return '';
  const from = "áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ·/_,:;";
  const to   = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd------";
  let str = text.toLowerCase().trim();
  for (let i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }
  str = str.replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
  return str;
};

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
app.get(["/api/products.json", "/products.json"], async (req, res) => {
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

// Endpoint for products with filtering and pagination/limit for n8n/Ollama
app.get("/api/products", async (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  
  try {
    const db = admin.firestore();
    
    // Retrieve the expected API key
    const settingsSnap = await db.collection("storeSettings").doc("main").get();
    let expectedApiKey = "bot_zbuild_2026"; // Fallback
    if (settingsSnap.exists) {
      const openClawConfig = settingsSnap.data().openClawConfig;
      if (openClawConfig && openClawConfig.botApiKey) {
        expectedApiKey = openClawConfig.botApiKey;
      }
    }
    
    if (!apiKey || apiKey !== expectedApiKey) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing API Key" });
    }

    const status = req.query.status;
    const limitVal = parseInt(req.query.limit, 10);

    let queryRef = db.collection("products");

    if (status) {
      const statusList = [status];
      if (status.toLowerCase() !== status) {
        statusList.push(status.toLowerCase());
      } else {
        const capitalized = status.charAt(0).toUpperCase() + status.slice(1);
        if (capitalized !== status) {
          statusList.push(capitalized);
        }
      }
      queryRef = queryRef.where("status", "in", statusList);
    }

    const snap = await queryRef.get();
    let products = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort in memory by createdAt descending
    products.sort((a, b) => {
      const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
      const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
      return timeB - timeA;
    });

    // Apply limit
    if (!isNaN(limitVal) && limitVal > 0) {
      products = products.slice(0, limitVal);
    }

    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint for Bots to create new products
app.post("/api/products", async (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  
  if (!apiKey) {
    return res.status(401).json({ error: "Unauthorized: Missing API Key" });
  }

  try {
    const db = admin.firestore();

    // 1. Lấy cấu hình API Key từ database
    const settingsSnap = await db.collection("storeSettings").doc("main").get();
    let expectedApiKey = "bot_zbuild_2026"; // Fallback
    
    if (settingsSnap.exists) {
      const openClawConfig = settingsSnap.data().openClawConfig;
      if (openClawConfig && openClawConfig.botApiKey) {
        expectedApiKey = openClawConfig.botApiKey;
      }
    }

    // 2. So sánh API Key
    if (apiKey !== expectedApiKey) {
      return res.status(403).json({ error: "Forbidden: Invalid API Key" });
    }

    // 3. Tiến hành tạo sản phẩm
    const { 
      title, 
      category = "Khác", 
      weight = "", 
      specs = "", 
      description = "",
      basePrice = 0,
      discountPrice = 0
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Missing required field: title" });
    }

    const newProduct = {
      title,
      slug: slugify(title),
      category,
      weight,
      specs,
      description,
      basePrice: Number(basePrice) || 0,
      discountPrice: Number(discountPrice) || 0,
      status: "draft", // Mặc định là draft chờ duyệt/thêm hình
      image: "",
      extraImages: [],
      stock: 0,
      trackInventory: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: "API_Bot"
    };

    const docRef = await db.collection("products").add(newProduct);

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      productId: docRef.id,
      slug: newProduct.slug
    });

  } catch (error) {
    console.error("Error creating product via API:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Endpoint for Bots to update products (e.g. n8n updating description)
app.put("/api/products/:productId", async (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  
  if (!apiKey) {
    return res.status(401).json({ error: "Unauthorized: Missing API Key" });
  }

  try {
    const db = admin.firestore();

    // 1. Lấy cấu hình API Key từ database
    const settingsSnap = await db.collection("storeSettings").doc("main").get();
    let expectedApiKey = "bot_zbuild_2026"; // Fallback
    
    if (settingsSnap.exists) {
      const openClawConfig = settingsSnap.data().openClawConfig;
      if (openClawConfig && openClawConfig.botApiKey) {
        expectedApiKey = openClawConfig.botApiKey;
      }
    }

    // 2. So sánh API Key
    if (apiKey !== expectedApiKey) {
      return res.status(403).json({ error: "Forbidden: Invalid API Key" });
    }

    const { productId } = req.params;
    const { description, status } = req.body;

    const productRef = db.collection("products").doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
      return res.status(404).json({ error: "Product not found" });
    }

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (description !== undefined) {
      updateData.description = description;
    }
    if (status !== undefined) {
      updateData.status = status;
    }

    await productRef.update(updateData);

    return res.json({
      success: true,
      message: "Product updated successfully"
    });

  } catch (error) {
    console.error("Error updating product via API:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Endpoint for dynamic Sitemap (Googlebot & SEO)
app.get("/sitemap.xml", async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection("products").get();
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://zbuild.click/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://zbuild.click/products.json</loc>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>\n`;

    snap.docs.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || doc.id;
      // Tránh lỗi các kí tự đặc biệt trong XML
      xml += `  <url>
    <loc>https://zbuild.click/product/${encodeURIComponent(slug)}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>\n`;
    });

    xml += `</urlset>`;
    
    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// ==========================================
// TELEGRAM BOT WEBHOOK & LIVE CHAT
// ==========================================

// Setup Webhook endpoint
app.post("/api/setup-telegram-webhook", async (req, res) => {
  const { botToken, botConnected } = req.body;
  if (!botToken) {
    return res.status(400).json({ success: false, error: "Missing botToken" });
  }

  try {
    const projectId = process.env.GCLOUD_PROJECT || "dunvex-89461";
    const webhookUrl = `https://us-central1-${projectId}.cloudfunctions.net/server/api/telegram-webhook`;
    
    if (botConnected) {
      // Set Webhook
      const url = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&allowed_updates=${JSON.stringify(["message"])}`;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok || !data.ok) {
        return res.status(500).json({ success: false, error: data.description || "Failed to set webhook" });
      }
      console.log("Telegram webhook successfully registered:", webhookUrl);
    } else {
      // Delete Webhook
      const url = `https://api.telegram.org/bot${botToken}/deleteWebhook`;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok || !data.ok) {
        return res.status(500).json({ success: false, error: data.description || "Failed to delete webhook" });
      }
      console.log("Telegram webhook successfully deleted.");
    }

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Telegram Webhook endpoint (Staff replies -> Web Customer)
app.post("/api/telegram-webhook", async (req, res) => {
  const update = req.body;
  console.log("Received Telegram update:", JSON.stringify(update));

  const message = update.message;
  if (!message) {
    return res.sendStatus(200);
  }

  const replyTo = message.reply_to_message;
  if (!replyTo) {
    return res.sendStatus(200);
  }

  const textToSearch = replyTo.text || replyTo.caption || '';
  const match = textToSearch.match(/\[KH_ID:\s*([a-zA-Z0-9_-]+)\]/);
  if (!match) {
    return res.sendStatus(200);
  }

  const userId = match[1];
  const db = admin.firestore();

  try {
    const settingsSnap = await db.collection("storeSettings").doc("main").get();
    if (!settingsSnap.exists) {
      return res.sendStatus(200);
    }
    const config = settingsSnap.data().telegramChatConfig;
    const botToken = config?.botToken;

    let imageUrl = "";
    const replyText = message.text || message.caption || "";

    // Handle image reply from staff
    if (message.photo && message.photo.length > 0 && botToken) {
      const photo = message.photo[message.photo.length - 1];
      const fileId = photo.file_id;

      const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
      const getFileRes = await fetch(getFileUrl);
      const getFileData = await getFileRes.json();

      if (getFileRes.ok && getFileData.ok && getFileData.result?.file_path) {
        const filePath = getFileData.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

        const imgFetch = await fetch(downloadUrl);
        if (imgFetch.ok) {
          const arrayBuffer = await imgFetch.arrayBuffer();
          const base64Data = Buffer.from(arrayBuffer).toString('base64');
          const mimeType = imgFetch.headers.get('content-type') || 'image/jpeg';
          const dataUri = `data:${mimeType};base64,${base64Data}`;

          // Upload to Cloudinary
          const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dtdgrcznj';
          const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'zbuild';

          const formData = new URLSearchParams();
          formData.append('file', dataUri);
          formData.append('upload_preset', uploadPreset);

          const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
          });
          const cloudData = await cloudRes.json();
          if (cloudRes.ok && cloudData.secure_url) {
            imageUrl = cloudData.secure_url;
          } else {
            console.error("Cloudinary upload failed from Telegram webhook:", cloudData);
          }
        }
      }
    }

    if (replyText || imageUrl) {
      await db.collection("conversations").doc(userId).collection("messages").add({
        text: replyText,
        image: imageUrl,
        sender: 'staff',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await db.collection("conversations").doc(userId).update({
        lastMessageText: replyText || "[Hình ảnh]",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Successfully forwarded Telegram reply to user ${userId}`);
    }
  } catch (err) {
    console.error("Error processing Telegram reply:", err);
  }

  return res.sendStatus(200);
});

exports.server = functions.runWith({
  serviceAccount: "z-build-dunvex@appspot.gserviceaccount.com"
}).https.onRequest(app);

// Cron Job: Tự động học sản phẩm vào 2:00 sáng mỗi ngày
exports.autoLearnProducts = functions.runWith({
  serviceAccount: "z-build-dunvex@appspot.gserviceaccount.com"
}).pubsub.schedule('0 2 * * *').timeZone('Asia/Ho_Chi_Minh').onRun(async () => {
  const db = admin.firestore();
  
  try {
    console.log("Bắt đầu tiến trình tự động học sản phẩm (Cron Job)");

    // Lấy API Key từ setting hoặc ENV
    let apiKey = process.env.DEEPSEEK_API_KEY;
    const settingsSnap = await db.collection("storeSettings").doc("main").get();
    if (settingsSnap.exists) {
      const openClawConfig = settingsSnap.data().openClawConfig;
      if (openClawConfig && openClawConfig.botApiKey) {
        apiKey = openClawConfig.botApiKey;
      }
    }

    if (!apiKey) {
      console.error("Không tìm thấy DeepSeek API Key. Hủy tiến trình.");
      return null;
    }

    // Truy vấn các sản phẩm chưa học (hoặc giới hạn 5 sản phẩm mỗi lần để tránh timeout)
    const snap = await db.collection("products").get();
    const unlearnedProducts = [];
    
    snap.docs.forEach(doc => {
      const data = doc.data();
      if (!data.learned_by_ai && data.status !== "inactive") {
        unlearnedProducts.push({ id: doc.id, ...data });
      }
    });

    const batchToLearn = unlearnedProducts.slice(0, 5); // Xử lý 5 sản phẩm mỗi đêm
    if (batchToLearn.length === 0) {
      console.log("Tất cả sản phẩm đã được học. Không có việc cần làm.");
      return null;
    }

    console.log(`Đang tiến hành học ${batchToLearn.length} sản phẩm...`);

    for (const product of batchToLearn) {
      console.log(`Đang học sản phẩm: ${product.title}`);
      
      const prompt = `Bạn là Chuyên gia Kỹ thuật Z-BUILD. Hãy đọc thông tin sản phẩm dưới đây và viết 1 tài liệu hướng dẫn thi công, ứng dụng thực tế, kèm danh sách vật tư phụ BẮT BUỘC phải mua kèm.
      Viết ngắn gọn, súc tích, dễ hiểu. Không dùng định dạng phức tạp.

      THÔNG TIN SẢN PHẨM:
      - Tên: ${product.title || "N/A"}
      - Danh mục: ${product.category || "Chung"}
      - Kích thước/Quy cách: ${product.specs || "N/A"}
      - Mô tả: ${product.description ? product.description.replace(/<[^>]+>/g, "").substring(0, 1000) : "N/A"}
      `;

      try {
        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3
          })
        });

        if (response.ok) {
          const data = await response.json();
          const aiContent = data.choices[0]?.message?.content;

          if (aiContent) {
            // Lưu vào Knowledge Base
            await db.collection("ai_knowledge_units").add({
              category: product.category || "Sản phẩm Zbuild",
              content: `[Cẩm nang ${product.title}]: ${aiContent}`,
              keywords: product.title.split(" "),
              summary: `Hướng dẫn thi công và vật tư phụ cho ${product.title}`,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Đánh dấu sản phẩm đã học
            await db.collection("products").doc(product.id).update({
              learned_by_ai: true
            });
            console.log(`✅ Đã học xong: ${product.title}`);
          }
        } else {
          console.error(`Lỗi API khi học ${product.title}:`, await response.text());
        }
      } catch (err) {
        console.error(`Lỗi kết nối khi học ${product.title}:`, err);
      }
    }

    console.log("Hoàn thành tiến trình tự động học.");
    return null;
  } catch (error) {
    console.error("Lỗi Cron Job:", error);
    return null;
  }
});

// Firestore trigger to forward user messages to Telegram Bot in real-time
exports.onConversationMessageCreated = functions.runWith({
  serviceAccount: "z-build-dunvex@appspot.gserviceaccount.com"
}).firestore
  .document('conversations/{userId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();
    if (message.sender !== 'user') return null;

    const userId = context.params.userId;
    const db = admin.firestore();

    try {
      // 1. Fetch Telegram live chat configs
      const settingsSnap = await db.collection("storeSettings").doc("main").get();
      if (!settingsSnap.exists) return null;
      
      const config = settingsSnap.data().telegramChatConfig;
      if (!config || !config.enabled || !config.botConnected || !config.groupForwardEnabled) {
        console.log("Telegram forwarding is disabled or inactive.");
        return null;
      }

      const botToken = config.botToken;
      const chatId = config.chatId;

      if (!botToken || !chatId) {
        console.error("Missing Bot Token or Chat ID in Telegram config.");
        return null;
      }

      // 2. Fetch user display info
      const userSnap = await db.collection("users").doc(userId).get();
      const userData = userSnap.exists ? userSnap.data() : {};
      const userName = userData.displayName || message.userName || "Khách hàng";
      const userEmail = userData.email || "";

      // Escape Markdown characters for Telegram Markdown parsing
      const cleanName = String(userName).replace(/[_*`\[]/g, '\\$&');
      const cleanEmail = String(userEmail).replace(/[_*`\[]/g, '\\$&');
      const cleanText = String(message.text || '').replace(/[_*`\[]/g, '\\$&');

      const textMessage = `👉 *Khách hàng*: *${cleanName}* ${cleanEmail ? `(${cleanEmail})` : ''}\n\`[KH_ID: ${userId}]\`\n\n💬 *Tin nhắn*: ${cleanText || '[Hình ảnh]'}`;

      if (message.image) {
        // Send image to Telegram
        const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: message.image,
            caption: textMessage,
            parse_mode: 'Markdown'
          })
        });
        if (!response.ok) {
          const errText = await response.text();
          console.error("Failed to forward photo to Telegram:", errText);
        }
      } else {
        // Send text to Telegram
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: textMessage,
            parse_mode: 'Markdown'
          })
        });
        if (!response.ok) {
          const errText = await response.text();
          console.error("Failed to forward message to Telegram:", errText);
        }
      }
    } catch (err) {
      console.error("Error in onConversationMessageCreated:", err);
    }
    return null;
  });

