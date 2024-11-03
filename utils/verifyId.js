// verifyID.js
const Onfido = require('@onfido/api');

const onfido = new Onfido({
  apiToken: 'YOUR_ONFIDO_API_KEY',
});

async function verifyID(idDocument) {
  try {
    const applicant = await onfido.applicant.create({
      firstName: 'UserFirstName', // Provide user's first name
      lastName: 'UserLastName',   // Provide user's last name
    });

    const document = await onfido.document.upload({
      applicantId: applicant.id,
      file: idDocument,
      type: 'passport', // Specify document type
    });

    const check = await onfido.check.create({
      applicantId: applicant.id,
      reportNames: ['document'],
    });

    return { isVerified: check.result === 'clear' };
  } catch (error) {
    console.error('ID verification failed:', error);
    return { isVerified: false };
  }
}

module.exports = verifyID;
