// npm i pdfkit dayjs
const PDFDocument = require("pdfkit");
const dayjs = require("dayjs");

/**
 * generateInvoicePDF(invoice, opts?)
 * @param {Object} invoice
 * @param {number} invoice.totalSalesMoney
 * @param {number} invoice.mySales
 * @param {number} invoice.profitPercentage
 * @param {number} invoice.profits
 * @param {Date|string} invoice.createdAt
 * @param {string} invoice.createdBy
 * @param {string[]} invoice.orders  // array of Order ObjectIds or strings
 * @param {"pending"|"paid"} invoice.status
 * @param {Date|string} [invoice.paidAt]
 * @param {Object} [opts]
 * @param {string} [opts.currency="USD"]
 * @param {string} [opts.logoPath]   // optional local path to a PNG/SVG
 * @param {string} [opts.title="Sales Invoice"]
 * @returns {Promise<Buffer>}
 */
async function generateInvoicePDF(invoice, opts = {}) {
  const { currency = "USD", logoPath, title = "Sales Invoice" } = opts;

  const doc = new PDFDocument({ size: "A4", margin: 36 }); // ~0.5in margin
  const chunks = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    // ---------- Helpers ----------
    const fmtMoney = (n) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
        Number.isFinite(n) ? n : 0
      );
    const fmtDate = (d) => dayjs(d || new Date()).format("YYYY-MM-DD HH:mm");

    function badge(text, color) {
      const y = doc.y;
      const x = doc.page.width - doc.page.margins.right - 100;
      doc
        .roundedRect(x, y - 2, 100, 20, 6)
        .fillColor(color)
        .fill();
      doc
        .fillColor("#ffffff")
        .fontSize(10)
        .text(text.toUpperCase(), x, y, { width: 100, align: "center" })
        .moveDown(0.6)
        .fillColor("#111111");
    }

    function sectionHeading(text) {
      doc
        .moveDown(1)
        .fontSize(12)
        .fillColor("#111111")
        .text(text, { continued: false })
        .moveTo(doc.x, doc.y + 4)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
        .lineWidth(1)
        .strokeColor("#e5e7eb")
        .stroke()
        .moveDown(0.6);
      doc.fillColor("#111111");
    }

    function keyVal(key, val, opts = {}) {
      const { keyWidth = 140, gap = 12 } = opts;
      const startX = doc.x;
      const startY = doc.y;
      doc
        .fontSize(10)
        .fillColor("#6b7280")
        .text(key, startX, startY, { width: keyWidth });
      doc
        .fillColor("#111111")
        .text(String(val ?? "-"), startX + keyWidth + gap, startY);
      doc.moveDown(0.4);
    }

    function table(headers, rows, colWidths) {
      const startX = doc.x;
      const tableWidth =
        colWidths?.reduce((a, b) => a + b, 0) ||
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // header bg
      doc
        .roundedRect(startX, doc.y, tableWidth, 24, 6)
        .fillAndStroke("#f3f4f6", "#e5e7eb");
      // header text
      let x = startX + 10;
      doc.fillColor("#111111").fontSize(10);
      headers.forEach((h, i) => {
        const w = colWidths?.[i] ?? tableWidth / headers.length;
        doc.text(h, x, doc.y + 6, { width: w - 20 });
        x += w;
      });
      doc.moveDown(1.4);

      // rows
      rows.forEach((r) => {
        let x2 = startX + 10;
        const yBefore = doc.y;
        r.forEach((cell, i) => {
          const w = colWidths?.[i] ?? tableWidth / r.length;
          doc.fillColor("#111111").text(String(cell ?? ""), x2, yBefore + 4, {
            width: w - 20,
          });
          x2 += w;
        });
        // row divider
        const yAfter = Math.max(doc.y + 6, yBefore + 24);
        doc
          .moveTo(startX, yAfter)
          .lineTo(startX + tableWidth, yAfter)
          .lineWidth(0.5)
          .strokeColor("#e5e7eb")
          .stroke();
        doc.y = yAfter;
      });
      doc.moveDown(0.6);
    }

    // ---------- Header ----------
    if (logoPath) {
      try {
        doc.image(logoPath, doc.x, doc.y, { width: 80 });
      } catch {
        // ignore bad image path
      }
      doc.moveDown(1);
    }

    doc.fontSize(20).fillColor("#111111").text(title, { continued: false });

    // status badge
    const isPaid = String(invoice.status || "").toLowerCase() === "paid";
    badge(isPaid ? "Paid" : "Pending", isPaid ? "#16a34a" : "#f59e0b");

    doc.moveDown(0.6);
    doc
      .fontSize(10)
      .fillColor("#6b7280")
      .text(`Invoice Date: ${fmtDate(invoice.createdAt)}`)
      .text(`Created by: ${invoice.createdBy || "-"}`)
      .text(`Status: ${invoice.status || "pending"}`)
      .text(isPaid ? `Paid at: ${fmtDate(invoice.paidAt)}` : "");

    // ---------- Summary Cards ----------
    doc.moveDown(1);
    const cardW =
      (doc.page.width - doc.page.margins.left - doc.page.margins.right - 24) /
      2;
    const startY = doc.y;

    function statCard(x, title, value) {
      const h = 70;
      doc
        .roundedRect(x, startY, cardW, h, 12)
        .fillAndStroke("#ffffff", "#e5e7eb");
      doc
        .fillColor("#6b7280")
        .fontSize(10)
        .text(title, x + 14, startY + 12);
      doc
        .fillColor("#111111")
        .fontSize(16)
        .text(value, x + 14, startY + 32);
    }

    const leftX = doc.x;
    const rightX = leftX + cardW + 24;

    statCard(leftX, "Total Sales", fmtMoney(invoice.totalSalesMoney));
    statCard(rightX, "My Sales", fmtMoney(invoice.mySales));

    doc.moveDown(0.2);
    const startY2 = startY + 84;
    function statCardSmall(x, title, value) {
      const h = 60;
      doc
        .roundedRect(x, startY2, cardW, h, 12)
        .fillAndStroke("#ffffff", "#e5e7eb");
      doc
        .fillColor("#6b7280")
        .fontSize(10)
        .text(title, x + 14, startY2 + 10);
      doc
        .fillColor("#111111")
        .fontSize(14)
        .text(value, x + 14, startY2 + 28);
    }

    statCardSmall(
      leftX,
      "Profit %",
      `${Number(invoice.profitPercentage ?? 0).toFixed(2)}%`
    );
    statCardSmall(rightX, "Profits", fmtMoney(invoice.profits));

    doc.y = startY2 + 70;

    // ---------- Details ----------
    sectionHeading("Details");
    keyVal("Invoice ID", (invoice._id || "").toString?.() || "-");
    keyVal("Creator", invoice.createdBy || "-");
    keyVal("Currency", currency);
    keyVal("Status", isPaid ? "Paid" : "Pending");
    if (isPaid) keyVal("Paid at", fmtDate(invoice.paidAt));

    // ---------- Orders ----------
    sectionHeading("Orders");
    const orderIds = (invoice.orders || []).map((o) => o.toString());
    const orderRows =
      orderIds.length === 0
        ? [["—", "—"]]
        : orderIds.map((id, i) => [String(i + 1), id]);
    table(["#", "Order ID"], orderRows, [50, 400]);

    // ---------- Footer / Notes ----------
    doc.moveDown(1);
    doc
      .fontSize(9)
      .fillColor("#6b7280")
      .text(
        "Thank you for your effort! This invoice is generated automatically for marketing payouts.",
        { align: "left" }
      );
    doc
      .moveDown(0.5)
      .text(`Generated on ${fmtDate(new Date())}`, { align: "left" });

    doc.end();
  });
}

// ---------------- Example usage ----------------
// (Uncomment to test locally)
// const fs = require('fs');
// (async () => {
//   const buf = await generateInvoicePDF({
//     _id: 'INV-2025-001',
//     totalSalesMoney: 15000,
//     mySales: 4500,
//     profitPercentage: 30,
//     profits: 1350,
//     createdAt: new Date(),
//     createdBy: 'Marketing Bot',
//     orders: ['665a0...', '665a1...', '665a2...'],
//     status: 'pending',
//   }, { currency: 'USD', logoPath: './logo.png', title: 'Marketer Payout' });
//   fs.writeFileSync('./invoice.pdf', buf);
//   console.log('Saved invoice.pdf');
// })();

module.exports = { generateInvoicePDF };
