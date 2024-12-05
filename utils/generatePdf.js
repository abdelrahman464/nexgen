const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateOrderPDF = async (order, outputDirectory = './uploads/orders') =>
  new Promise((resolve, reject) => {
    try {
      // Ensure the output directory exists
      if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(outputDirectory, { recursive: true });
      }

      // Define the output file path
      const outputPath = path.join(outputDirectory, `order-${order._id}.pdf`);

      // Create a new PDF document
      const doc = new PDFDocument({ margin: 50 });

      // Define paths
      const logoPath = path.join(__dirname, 'iconicLogo.png'); // Logo in the same directory

      // Define colors
      const primaryColor = '#2C3E50'; // Dark Blue
      const secondaryColor = '#1ABC9C'; // Teal

      // Pipe the document to a file
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Add the logo on the top-left with larger size
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 20, { width: 140, height: 140 }); 
      } else {
        console.error('Logo file not found at:', logoPath);
      }

      // Add a header
      doc
        .fillColor(primaryColor)
        .fontSize(20)
        .text('Order Summary', { align: 'center' })
        .moveDown(2); // Add extra space below the header

      // Add a line separator
      doc.moveTo(50, 150).lineTo(550, 150).stroke(secondaryColor).moveDown(2);

      // Add order details with bold labels
      doc.fontSize(12).fillColor(primaryColor);

      // Helper function to add bold labels
      const addDetail = (label, value) => {
        doc
          .font('Helvetica-Bold')
          .text(`${label}:`, { continued: true })
          .font('Helvetica')
          .text(` ${value}`)
          .moveDown();
      };

      addDetail('Order ID', order._id);
      addDetail('Customer Name', order.user.name);
      addDetail('Email', order.user.email);
      addDetail('Phone', order.user.phone);

      // Add course and package details
      if (order.course) {
        addDetail('Course', order.course.title.en);
      }
      if (order.package) {
        addDetail('Package', order.package.title.en);
      }
      if (order.coursePackage) {
        addDetail('Course Package', order.coursePackage.title.en);
      }

      // Add payment and pricing details
      addDetail('Total Price', `$${order.totalOrderPrice}`);
      addDetail('Payment Method', order.paymentMethodType);
      addDetail('Paid', order.isPaid ? 'Yes' : 'No');

      if (order.paidAt) {
        const paidAtFormatted = new Date(order.paidAt).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        addDetail('Paid At', paidAtFormatted);
      }

      // Add a footer with a thank-you message
      doc
        .moveDown(2)
        .fillColor(secondaryColor)
        .fontSize(16)
        .text('Thank you for your order!', {
          align: 'center',
          underline: true,
        });

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
