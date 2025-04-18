function generateTimestampId() {
  const now = new Date();

  // Get individual components
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

  // Combine components to form the ID
  return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
}

module.exports = generateTimestampId;
