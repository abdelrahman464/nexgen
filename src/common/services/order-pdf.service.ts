import { Injectable } from '@nestjs/common';
import fs from 'fs';
import moment from 'moment';
import path from 'path';

const PDFDocument = require('pdfkit');

interface OrderPdfOptions {
  outputDirectory?: string;
  logoPath?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

@Injectable()
export class OrderPdfService {
  generateOrderPDF(order: any, options: OrderPdfOptions = {}) {
    return new Promise<string>((resolve, reject) => {
      try {
        const {
          outputDirectory = './uploads/orders',
          logoPath = path.join(process.cwd(), 'assets', 'iconicLogo.png'),
          primaryColor = '#2C3E50',
          secondaryColor = '#1ABC9C',
        } = options;

        fs.mkdirSync(outputDirectory, { recursive: true });
        const outputPath = path.join(outputDirectory, `order-${order._id}-${Date.now()}.pdf`);
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(outputPath);

        doc.pipe(stream);
        this.renderHeader(doc, order, { logoPath, primaryColor, secondaryColor });
        this.renderOrderDetails(doc, order, { primaryColor });
        this.renderOrderItems(doc, order, { primaryColor });
        this.renderPaymentSummary(doc, order, { primaryColor });
        this.renderFooter(doc, { primaryColor });
        doc.end();

        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private renderHeader(doc: any, order: any, { logoPath, primaryColor }: any) {
    if (fs.existsSync(logoPath)) doc.image(logoPath, 50, 20, { width: 80 });
    doc.fillColor(primaryColor).fontSize(20).text('Nexgen Academy', { align: 'center' }).moveDown(0.5).fontSize(12).text(`Order ID: ${order._id}`, { align: 'center' }).moveDown(1);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke(primaryColor);
  }

  private renderOrderDetails(doc: any, order: any, { primaryColor }: any) {
    doc.moveDown(1).fontSize(16).fillColor(primaryColor).text('Order Details', { underline: true }).moveDown(0.5).fontSize(12).fillColor('#2F3F5F');
    [
      { label: 'Customer Name', value: order.user.name },
      { label: 'Email', value: order.user.email },
    ].forEach((detail) => {
      doc.fillColor(primaryColor).text(`${detail.label}: `, { continued: true }).fontSize(12);
      doc.fillColor('black').text(` ${detail.value}`);
      doc.moveDown(0.5);
    });
  }

  private renderOrderItems(doc: any, order: any, { primaryColor }: any) {
    doc.moveDown(1).fontSize(16).fillColor(primaryColor).text('Purchased Items', { underline: true }).moveDown(0.5).fontSize(12).fillColor('black');
    [
      order.course ? { name: order.course.title.en, price: order.course.price } : null,
      order.package ? { name: order.package.title.en, price: order.package.price } : null,
      order.coursePackage ? { name: order.coursePackage.title.en, price: order.coursePackage.price } : null,
    ]
      .filter(Boolean)
      .forEach((item: any) => {
        doc.text(`- ${item.name}: $${item.price}`);
        doc.moveDown(0.5);
      });
  }

  private renderPaymentSummary(doc: any, order: any, { primaryColor }: any) {
    doc.moveDown(1).fontSize(16).fillColor(primaryColor).text('Payment Summary', { underline: true }).moveDown(0.5).fontSize(12).fillColor('black');
    [
      { label: 'Total Price', value: `$${order.totalOrderPrice}` },
      { label: 'Payment Method', value: order.paymentMethodType },
      { label: 'Payment Status', value: order.isPaid ? 'Paid' : 'Pending' },
      { label: 'Payment Date', value: order.paidAt ? moment(order.paidAt).format('MMMM Do, YYYY') : 'N/A' },
    ].forEach((detail) => {
      doc.fillColor(primaryColor).text(`${detail.label}:`, { continued: true }).fontSize(12);
      doc.fillColor('black').text(` ${detail.value}`);
      doc.moveDown(0.5);
    });
    doc.moveDown(3);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke(primaryColor);
  }

  private renderFooter(doc: any, { primaryColor }: any) {
    doc.moveDown(2).fontSize(10).fillColor(primaryColor).text('Â© 2024 Nexgen Academy. All Rights Reserved.', { align: 'center' });
    doc.moveDown(0.5);
  }
}
