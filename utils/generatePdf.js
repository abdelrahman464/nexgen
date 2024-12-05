const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateOrderPDF = async (order, outputDirectory = './uploads/order') =>
  new Promise((resolve, reject) => {
    try {
      // Ensure the output directory exists
      if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(outputDirectory, { recursive: true });
      }

      // Define the output file path
      const outputPath = path.join(outputDirectory, `order-${order._id}.pdf`);

      // Create a new PDF document
      const doc = new PDFDocument();

      // Pipe the document to a file
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Add order details to the PDF
      doc.fontSize(18).text('Order Summary', { align: 'center' });
      doc.moveDown();

      doc.fontSize(14).text(`Order ID: ${order._id}`);
      doc.text(`Customer Name: ${order.user.name}`);
      doc.text(`Email: ${order.user.email}`);
      doc.text(`Phone: ${order.user.phone}`);
      doc.moveDown();

      // Add course and package information
      if (order.course) {
        doc.text(`Course: ${order.course.title.en}`);
      }
      if (order.package) {
        doc.text(`Package: ${order.package.title.en}`);
      }
      if (order.coursePackage) {
        doc.text(`Course Package: ${order.coursePackage.title.en}`);
      }

      doc.moveDown();
      doc.text(`Total Price: $${order.totalOrderPrice}`);
      doc.text(`Payment Method: ${order.paymentMethodType}`);
      doc.text(`Paid: ${order.isPaid ? 'Yes' : 'No'}`);
      if (order.paidAt) {
        doc.text(`Paid At: ${order.paidAt}`);
      }

      // Finalize the document
      doc.end();

      // Resolve the path when the stream finishes
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });

module.exports = { generateOrderPDF };
