import fs from 'fs';
import path from 'path';

console.log('🔄 Extracting and restructuring Apollo response data...');

// Read from the progress file (contains all collected data)
const progressFilePath = 'apollo_restart_progress.json';

try {
  if (!fs.existsSync(progressFilePath)) {
    throw new Error('Progress file not found. Please run the scraping script first.');
  }

  const progressData = JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
  const apolloData = progressData.allData;

  console.log(`📋 Processing data from: ${progressFilePath}`);
  console.log(`   • People: ${apolloData.people?.length || 0}`);
  console.log(`   • Contacts: ${apolloData.contacts?.length || 0}`);

  // Create restructured array
  const extractedData = [];

  // Process people array
  if (apolloData.people && apolloData.people.length > 0) {
    console.log(`\n🔍 Extracting data from ${apolloData.people.length} people...`);
    apolloData.people.forEach((person, index) => {
      const extractedItem = {
        id: person.id || 'N/A',
        name: person.name || 'N/A',
        website_url: person.organization?.website_url || 'N/A'
      };

      extractedData.push(extractedItem);

      // Log first few entries for verification
      if (index < 3) {
        console.log(`   People ${index + 1}. ${extractedItem.name} | ${extractedItem.website_url} | ${extractedItem.id}`);
      }
    });
  }

  // Process contacts array
  if (apolloData.contacts && apolloData.contacts.length > 0) {
    console.log(`\n🔍 Extracting data from ${apolloData.contacts.length} contacts...`);
    apolloData.contacts.forEach((contact, index) => {
      const extractedItem = {
        id: contact.id || 'N/A',
        name: contact.name || 'N/A',
        website_url: contact.account?.website_url || 'N/A'
      };

      extractedData.push(extractedItem);

      // Log first few entries for verification
      if (index < 3) {
        console.log(`   Contact ${index + 1}. ${extractedItem.name} | ${extractedItem.website_url} | ${extractedItem.id}`);
      }
    });
  }

  if (extractedData.length === 0) {
    throw new Error('No people or contacts data found in the response');
  }

  console.log(`\n✅ Extracted ${extractedData.length} records`);

  // Save the restructured data as result.json
  const outputFilename = 'result.json';

  fs.writeFileSync(outputFilename, JSON.stringify(extractedData, null, 2));

  console.log(`💾 Restructured data saved to: ${outputFilename}`);
  console.log(`📁 Full path: ${path.resolve(outputFilename)}`);

  // Show sample of the extracted data
  console.log('\n📋 Sample of extracted data structure:');
  console.log(JSON.stringify(extractedData.slice(0, 3), null, 2));

  // Show summary statistics
  console.log('\n📊 Summary:');
  console.log(`   • Total records: ${extractedData.length}`);
  console.log(`   • Records with website_url: ${extractedData.filter(item => item.website_url !== 'N/A').length}`);
  console.log(`   • Records with valid name: ${extractedData.filter(item => item.name !== 'N/A').length}`);
  console.log(`   • Records with valid id: ${extractedData.filter(item => item.id !== 'N/A').length}`);

} catch (error) {
  console.error('❌ Error processing data:', error.message);

  // Check if progress file exists and show available files
  if (!fs.existsSync(progressFilePath)) {
    console.log('📁 Available JSON files:');
    const files = fs.readdirSync('.').filter(file => file.endsWith('.json'));
    files.forEach(file => console.log(`   • ${file}`));
  }
}
