// src/utils/pdfGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

class PDFGenerator {
  static generateOrderPDF(order, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const {
          outputDirectory = './uploads/orders',
          logoPath = path.join(__dirname, 'iconicLogo.png'),
          primaryColor = '#2C3E50',
          secondaryColor = '#1ABC9C',
        } = options;

        // Ensure output directory exists
        fs.mkdirSync(outputDirectory, { recursive: true });

        const outputPath = path.join(
          outputDirectory,
          `order-${order._id}-${Date.now()}.pdf`,
        );
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(outputPath);

        doc.pipe(stream);

        // Header Section
        this._renderHeader(doc, order, {
          logoPath,
          primaryColor,
          secondaryColor,
        });

        // Order Details Section
        this._renderOrderDetails(doc, order, { primaryColor });

        // Items Section
        this._renderOrderItems(doc, order, { primaryColor });

        // Payment Summary Section
        this._renderPaymentSummary(doc, order, {
          primaryColor,
        });

        // Footer
        this._renderFooter(doc, { primaryColor });

        doc.end();

        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  static _renderHeader(doc, order, { logoPath, primaryColor }) {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 20, { width: 80 });
    }

    doc
      .fillColor(primaryColor)
      .fontSize(20)
      .text('Nexgen Academy', { align: 'center' })
      .moveDown(0.5)
      .fontSize(12)
      .text(`Order ID: ${order._id}`, { align: 'center' })
      .moveDown(1);

    doc.moveDown(0.5);

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke(primaryColor);
  }

  static _renderOrderDetails(doc, order, { primaryColor }) {
    doc
      .moveDown(1)
      .fontSize(16)
      .fillColor(primaryColor)
      .text('Order Details', { underline: true })
      .moveDown(0.5)
      .fontSize(12)
      .fillColor('#2F3F5F');

    const details = [
      { label: 'Customer Name', value: order.user.name },
      { label: 'Email', value: order.user.email },
    ];

    doc.moveDown(0.5);

    details.forEach((detail) => {
      // Apply label color
      doc
        .fillColor(primaryColor)
        .text(`${detail.label}: `, { continued: true })
        .fontSize(12);
      // Reset to black for the value
      doc.fillColor('black').text(` ${detail.value}`);
      doc.moveDown(0.5);
    });
  }

  static _renderOrderItems(doc, order, { primaryColor }) {
    doc
      .moveDown(1)
      .fontSize(16)
      .fillColor(primaryColor)
      .text('Purchased Items', { underline: true })
      .moveDown(0.5)
      .fontSize(12)
      .fillColor('black');

    doc.moveDown(0.5);

    const items = [
      order.course
        ? { name: order.course.title.en, price: order.course.price }
        : null,
      order.package
        ? { name: order.package.title.en, price: order.package.price }
        : null,
      order.coursePackage
        ? {
            name: order.coursePackage.title.en,
            price: order.coursePackage.price,
          }
        : null,
    ].filter(Boolean);

    items.forEach((item) => {
      doc.text(`- ${item.name}: $${item.price}`);
      doc.moveDown(0.5);
    });
  }

  static _renderPaymentSummary(doc, order, { primaryColor }) {
    doc
      .moveDown(1)
      .fontSize(16)
      .fillColor(primaryColor)
      .text('Payment Summary', { underline: true })
      .moveDown(0.5)
      .fontSize(12)
      .fillColor('black');

    doc.moveDown(0.5);

    const paymentDetails = [
      { label: 'Total Price', value: `$${order.totalOrderPrice}` },
      { label: 'Payment Method', value: order.paymentMethodType },
      { label: 'Payment Status', value: order.isPaid ? 'Paid' : 'Pending' },
      {
        label: 'Payment Date',
        value: order.paidAt
          ? moment(order.paidAt).format('MMMM Do, YYYY')
          : 'N/A',
      },
    ];

    paymentDetails.forEach((detail) => {
      // Apply label color
      doc
        .fillColor(primaryColor)
        .text(`${detail.label}:`, { continued: true })
        .fontSize(12);
      // Reset to black for the value
      doc.fillColor('black').text(` ${detail.value}`);
      doc.moveDown(0.5);
    });
    doc.moveDown(3);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke(primaryColor);
  }

  static _renderFooter(doc, { primaryColor }) {
    doc
      .moveDown(2)
      .fontSize(10)
      .fillColor(primaryColor)
      .text('© 2024 Nexgen Academy. All Rights Reserved.', {
        align: 'center',
      });
    doc.moveDown(0.5);
  }
}

module.exports = { PDFGenerator };
