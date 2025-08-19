import { connect } from 'puppeteer-real-browser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to import xlsx, fallback if not available
let XLSX;
try {
  XLSX = (await import('xlsx')).default;
  console.log('✅ XLSX library loaded successfully');
} catch (error) {
  console.log('⚠️ XLSX library not found. Install with: npm install xlsx');
  console.log('📊 Will generate CSV file instead of Excel');
}

console.log('🔍 Starting website validation process...');

// Read result.json
if (!fs.existsSync('result.json')) {
  console.log('❌ result.json not found. Please run the main script first.');
  process.exit(1);
}

const resultData = JSON.parse(fs.readFileSync('result.json', 'utf8'));
console.log(`📋 Found ${resultData.length} records to validate`);

// Create browser instance
const { browser, page } = await connect({
  headless: false,
  fingerprint: true,
  turnstile: true,
  tf: true,
  connectOption: {
    defaultViewport: null
  },
  customConfig: {},
  skipTarget: [],
  disableXvfb: false,
  ignoreAllFlags: false
});

console.log('🌐 Browser ready for website validation...');

// Files for incremental saving
const validSitesFile = 'valid_websites_temp.json';
const allValidationFile = 'all_validation_temp.json';

// Initialize temp files
const validationSummary = {
  total_processed: 0,
  valid_sites: 0,
  hello_world_sites: 0,
  invalid_sites: 0,
  error_sites: 0,
  start_time: new Date().toISOString()
};

// Initialize files
fs.writeFileSync(validSitesFile, JSON.stringify([], null, 2));
fs.writeFileSync(allValidationFile, JSON.stringify({
  summary: validationSummary,
  valid_sites: [],
  hello_world_sites: [],
  invalid_sites: [],
  error_sites: []
}, null, 2));

// Helper function to append to JSON file
function appendToJsonFile(filename, newData, arrayKey) {
  try {
    const existingData = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (arrayKey) {
      existingData[arrayKey].push(newData);
    } else {
      existingData.push(newData);
    }
    fs.writeFileSync(filename, JSON.stringify(existingData, null, 2));
  } catch (error) {
    console.log(`❌ Error updating ${filename}: ${error.message}`);
  }
}

// Helper function to update summary
function updateSummary(category) {
  try {
    const validationData = JSON.parse(fs.readFileSync(allValidationFile, 'utf8'));
    validationData.summary[category]++;
    validationData.summary.total_processed++;
    fs.writeFileSync(allValidationFile, JSON.stringify(validationData, null, 2));
  } catch (error) {
    console.log(`❌ Error updating summary: ${error.message}`);
  }
}

// Function to check if a website is valid
async function validateWebsite(record, index) {
  const { name, website_url, email } = record;

  console.log(`\n🌐 Checking ${index + 1}/${resultData.length}: ${name}`);
  console.log(`   URL: ${website_url}`);

  if (!website_url || website_url === 'N/A' || website_url === null) {
    console.log('   ❌ No website URL provided');
    const invalidRecord = { ...record, validation_reason: 'No URL provided' };
    appendToJsonFile(allValidationFile, invalidRecord, 'invalid_sites');
    updateSummary('invalid_sites');
    return;
  }

  try {
    // Ensure URL has protocol
    let url = website_url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    console.log(`   🔍 Testing: ${url}`);

    // Set timeout for page load
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 15000); // 15 second timeout
    });

    // Navigate to the website
    const navigationPromise = page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    await Promise.race([navigationPromise, timeoutPromise]);

    // Wait a bit for content to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check page content
    const pageAnalysis = await page.evaluate(() => {
      const title = document.title || '';
      const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
      const hasContent = bodyText.length > 100; // More than 100 characters suggests real content

      // Check for "hello world" or similar placeholder content
      const isHelloWorld = bodyText.includes('hello world') ||
        bodyText.includes('coming soon') ||
        bodyText.includes('under construction') ||
        bodyText.includes('placeholder') ||
        title.toLowerCase().includes('hello world') ||
        (bodyText.length < 50 && bodyText.includes('hello'));

      // Check if it's a parking page or domain for sale
      const isParkingPage = bodyText.includes('domain for sale') ||
        bodyText.includes('this domain') ||
        bodyText.includes('parked domain') ||
        bodyText.includes('buy this domain');

      return {
        title: title,
        bodyLength: bodyText.length,
        hasContent: hasContent,
        isHelloWorld: isHelloWorld,
        isParkingPage: isParkingPage,
        url: window.location.href,
        firstWords: bodyText.substring(0, 200)
      };
    });

    console.log(`   📊 Analysis: Title="${pageAnalysis.title}", Content length=${pageAnalysis.bodyLength}`);
    console.log(`   📝 First content: "${pageAnalysis.firstWords.substring(0, 100)}..."`);

    // Categorize the site
    if (pageAnalysis.isParkingPage) {
      console.log('   🅿️ PARKING PAGE - Domain for sale');
      const invalidRecord = {
        ...record,
        validation_reason: 'Parking page/Domain for sale',
        final_url: pageAnalysis.url,
        page_title: pageAnalysis.title
      };
      appendToJsonFile(allValidationFile, invalidRecord, 'invalid_sites');
      updateSummary('invalid_sites');
    } else if (pageAnalysis.isHelloWorld) {
      console.log('   👋 HELLO WORLD - Placeholder content');
      const helloWorldRecord = {
        ...record,
        validation_reason: 'Hello World/Placeholder content',
        final_url: pageAnalysis.url,
        page_title: pageAnalysis.title
      };
      appendToJsonFile(allValidationFile, helloWorldRecord, 'hello_world_sites');
      updateSummary('hello_world_sites');
    } else if (pageAnalysis.hasContent) {
      console.log('   ✅ VALID - Real website with content');
      // Store only essential data for valid sites
      const validRecord = {
        name: record.name || 'N/A',
        website_url: pageAnalysis.url || record.website_url,
        email: record.email || 'N/A'
      };
      appendToJsonFile(validSitesFile, validRecord);

      // Store detailed data for full validation report
      const detailedRecord = {
        ...record,
        validation_reason: 'Valid website',
        final_url: pageAnalysis.url,
        page_title: pageAnalysis.title
      };
      appendToJsonFile(allValidationFile, detailedRecord, 'valid_sites');
      updateSummary('valid_sites');
    } else {
      console.log('   ⚠️ MINIMAL CONTENT - Insufficient content');
      const invalidRecord = {
        ...record,
        validation_reason: 'Minimal content',
        final_url: pageAnalysis.url,
        page_title: pageAnalysis.title
      };
      appendToJsonFile(allValidationFile, invalidRecord, 'invalid_sites');
      updateSummary('invalid_sites');
    }

  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);

    // Try HTTP if HTTPS failed
    if (website_url.startsWith('https://')) {
      try {
        const httpUrl = website_url.replace('https://', 'http://');
        console.log(`   🔄 Retrying with HTTP: ${httpUrl}`);

        await page.goto(httpUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 10000
        });

        const httpAnalysis = await page.evaluate(() => {
          const title = document.title || '';
          const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
          return {
            title: title,
            bodyLength: bodyText.length,
            hasContent: bodyText.length > 100,
            url: window.location.href
          };
        });

        if (httpAnalysis.hasContent) {
          console.log('   ✅ VALID via HTTP');
          // Store only essential data for valid sites
          const validRecord = {
            name: record.name || 'N/A',
            website_url: httpAnalysis.url || record.website_url,
            email: record.email || 'N/A'
          };
          appendToJsonFile(validSitesFile, validRecord);

          // Store detailed data for full validation report
          const detailedRecord = {
            ...record,
            validation_reason: 'Valid website (HTTP)',
            final_url: httpAnalysis.url,
            page_title: httpAnalysis.title
          };
          appendToJsonFile(allValidationFile, detailedRecord, 'valid_sites');
          updateSummary('valid_sites');
        } else {
          console.log('   ⚠️ MINIMAL CONTENT via HTTP');
          const invalidRecord = {
            ...record,
            validation_reason: 'Minimal content (HTTP)',
            final_url: httpAnalysis.url,
            page_title: httpAnalysis.title
          };
          appendToJsonFile(allValidationFile, invalidRecord, 'invalid_sites');
          updateSummary('invalid_sites');
        }

      } catch (httpError) {
        console.log(`   ❌ HTTP also failed: ${httpError.message}`);
        const errorRecord = {
          ...record,
          validation_reason: `Connection error: ${error.message}`,
          final_url: website_url,
          page_title: 'N/A'
        };
        appendToJsonFile(allValidationFile, errorRecord, 'error_sites');
        updateSummary('error_sites');
      }
    } else {
      const errorRecord = {
        ...record,
        validation_reason: `Connection error: ${error.message}`,
        final_url: website_url,
        page_title: 'N/A'
      };
      appendToJsonFile(allValidationFile, errorRecord, 'error_sites');
      updateSummary('error_sites');
    }
  }

  // Small delay between requests
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Process all websites
console.log('🚀 Starting website validation...');

for (let i = 0; i < resultData.length; i++) {
  await validateWebsite(resultData[i], i);
}

// Close browser
await browser.close();
console.log('🔒 Browser closed');

// Read final validation data from temp files
let validSites = [];
let allValidationData = {};

try {
  validSites = JSON.parse(fs.readFileSync(validSitesFile, 'utf8'));
  allValidationData = JSON.parse(fs.readFileSync(allValidationFile, 'utf8'));
} catch (error) {
  console.log(`❌ Error reading validation files: ${error.message}`);
  process.exit(1);
}

// Update final summary
allValidationData.summary.end_time = new Date().toISOString();
const duration = new Date(allValidationData.summary.end_time) - new Date(allValidationData.summary.start_time);
allValidationData.summary.duration_minutes = Math.round(duration / 60000);

// Generate reports
console.log('\n📊 VALIDATION SUMMARY:');
console.log(`   ✅ Valid websites: ${allValidationData.summary.valid_sites}`);
console.log(`   👋 Hello World sites: ${allValidationData.summary.hello_world_sites}`);
console.log(`   ❌ Invalid sites: ${allValidationData.summary.invalid_sites}`);
console.log(`   🚫 Error sites: ${allValidationData.summary.error_sites}`);
console.log(`   📊 Total processed: ${allValidationData.summary.total_processed}`);
console.log(`   ⏱️ Duration: ${allValidationData.summary.duration_minutes} minutes`);

// Save valid sites to Excel/CSV
if (validSites.length > 0) {
  console.log('\n💾 Saving valid websites...');

  // Prepare data for export (data is already simplified)
  const exportData = validSites.map(site => ({
    Name: site.name,
    'Website URL': site.website_url,
    Email: site.email
  }));

  if (XLSX) {
    // Create Excel file
    try {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Valid Websites');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const excelFilename = `valid_websites_${timestamp}.xlsx`;

      XLSX.writeFile(workbook, excelFilename);
      console.log(`📊 Excel file saved: ${excelFilename}`);
    } catch (excelError) {
      console.log(`❌ Excel creation failed: ${excelError.message}`);
      console.log('📄 Falling back to CSV...');
    }
  }

  // Always create CSV as backup
  const csvHeaders = 'Name,Website URL,Email\n';
  const csvRows = exportData.map(row =>
    `"${row.Name}","${row['Website URL']}","${row.Email}"`
  ).join('\n');

  const csvContent = csvHeaders + csvRows;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const csvFilename = `valid_websites_${timestamp}.csv`;

  fs.writeFileSync(csvFilename, csvContent);
  console.log(`📄 CSV file saved: ${csvFilename}`);
}

// Save detailed validation results
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const resultsFilename = `website_validation_results_${timestamp}.json`;

fs.writeFileSync(resultsFilename, JSON.stringify(allValidationData, null, 2));
console.log(`📋 Detailed results saved: ${resultsFilename}`);

// Show some sample valid sites
if (validSites.length > 0) {
  console.log('\n✅ Sample valid websites:');
  validSites.slice(0, 5).forEach((site, index) => {
    console.log(`   ${index + 1}. ${site.name} | ${site.website_url} | ${site.email}`);
  });
}

// Show sample Hello World sites for index.html reference
if (allValidationData.hello_world_sites.length > 0) {
  console.log('\n👋 Hello World sites (for index.html structure):');
  allValidationData.hello_world_sites.slice(0, 3).forEach((site, index) => {
    console.log(`   ${index + 1}. ${site.name} | ${site.final_url}`);
  });
}

// Clean up temporary files
console.log('\n🧹 Cleaning up temporary files...');
try {
  if (fs.existsSync(validSitesFile)) {
    fs.unlinkSync(validSitesFile);
    console.log(`   ✅ Deleted: ${validSitesFile}`);
  }
  if (fs.existsSync(allValidationFile)) {
    fs.unlinkSync(allValidationFile);
    console.log(`   ✅ Deleted: ${allValidationFile}`);
  }
} catch (cleanupError) {
  console.log(`   ⚠️ Cleanup warning: ${cleanupError.message}`);
}

console.log('\n🎉 Website validation completed!');
console.log('📊 Valid websites exported to Excel/CSV with: Name, Website URL, Email');
console.log('📋 Detailed validation report saved to JSON file');
console.log('🧹 Temporary files cleaned up successfully');
