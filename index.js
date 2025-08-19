import { connect } from 'puppeteer-real-browser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
console.log('Loading environment variables...');
const result = dotenv.config({ path: path.join(__dirname, '.env') });
if (result.error) {
  console.log('Error loading .env file:', result.error);
} else {
  console.log('✅ Environment variables loaded successfully');
}

// Helper function to update result.json
function updateResultJson(newRecords) {
  const resultPath = 'result.json';
  let existingData = [];

  // Read existing result.json if it exists
  if (fs.existsSync(resultPath)) {
    try {
      const existingContent = fs.readFileSync(resultPath, 'utf8');
      existingData = JSON.parse(existingContent);
    } catch (error) {
      console.log('⚠️ Could not read existing result.json, starting fresh');
    }
  }

  // Add new records to existing data
  const updatedData = existingData.concat(newRecords);

  // Remove duplicates based on id
  const uniqueData = updatedData.filter((item, index, arr) =>
    arr.findIndex(t => t.id === item.id) === index
  );

  // Save updated data
  try {
    fs.writeFileSync(resultPath, JSON.stringify(uniqueData, null, 2));
    console.log(`✅ Updated result.json with ${newRecords.length} new records (total: ${uniqueData.length})`);
    return uniqueData.length;
  } catch (error) {
    console.log(`❌ Could not update result.json: ${error.message}`);
    return existingData.length;
  }
}

// Use optimal puppeteer-real-browser configuration
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

console.log('Using puppeteer-real-browser built-in stealth features...');

console.log('Navigating to Apollo...');

// Add human-like delay before navigation
await new Promise(resolve => setTimeout(resolve, 2000));

// Navigate to Apollo login page
await page.goto("https://app.apollo.io/", {
  waitUntil: 'networkidle0',
  timeout: 60000
});

console.log('Page loaded, waiting for Cloudflare bypass...');

// Give puppeteer-real-browser time to handle Cloudflare automatically
await new Promise(resolve => setTimeout(resolve, 10000));

// Simple Cloudflare check
const isCloudflarePresent = await page.evaluate(() => {
  return document.title.includes('Just a moment') ||
    document.body.innerText.includes('Checking your browser') ||
    document.querySelector('.cf-browser-verification') !== null;
});

if (isCloudflarePresent) {
  console.log('🛡️ Cloudflare detected, waiting for automatic bypass...');

  try {
    await page.waitForFunction(() => {
      return !document.title.includes('Just a moment') &&
        !document.body.innerText.includes('Checking your browser');
    }, { timeout: 60000 });
    console.log('✅ Cloudflare bypass completed!');
  } catch (error) {
    console.log('⚠️ Cloudflare bypass may need manual intervention');
  }
} else {
  console.log('✅ No Cloudflare protection detected');
}

console.log('Final page title:', await page.title());
console.log('Current URL:', page.url());

// Check if we're on the login page and perform login
try {
  const emailSelector = 'input[name="email"][type="email"]';
  const passwordSelector = 'input[name="password"][type="password"]';
  const loginButtonSelector = 'button[type="submit"]';

  // Wait for email input to be visible
  await page.waitForSelector(emailSelector, { timeout: 10000 });

  // Get credentials from environment variables
  const email = process.env.APOLLO_EMAIL;
  const password = process.env.APOLLO_PASSWORD;

  // Load all filter values from .env
  const emailStatus = process.env.EMAIL_STATUS;
  const jobTitles = process.env.JOB_TITLE;
  const location = process.env.LOCATION;
  const employees = process.env.EMPLOYEES;
  const industryKeywords = process.env.INDUSTRY_KEYWORDS;
  const companyKeywords = process.env.COMPANY_KEYWORDS;

  if (!email || !password) {
    console.log('Error: Please set APOLLO_EMAIL and APOLLO_PASSWORD in your .env file');
    await browser.close();
    process.exit(1);
  }

  console.log('Filling login credentials...');

  // Clear and fill email
  await page.focus(emailSelector);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.type(emailSelector, email);
  await new Promise(resolve => setTimeout(resolve, 500));

  // Clear and fill password
  await page.focus(passwordSelector);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.type(passwordSelector, password);
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('Submitting login form...');

  // Click the login button
  await page.click(loginButtonSelector);

  console.log('Login form submitted, waiting for navigation...');

  // Wait for navigation after login
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

  console.log('Successfully logged in to Apollo!');
  console.log('Current URL:', page.url());

  // Wait for dashboard to load
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Start pagination process
  console.log('🚀 Starting pagination process...');

  // Display filter values
  console.log('📋 Filter values from .env:');
  console.log(`   • Email Status: ${emailStatus}`);
  console.log(`   • Job Titles: ${jobTitles}`);
  console.log(`   • Location: ${location}`);
  console.log(`   • Employees: ${employees}`);
  console.log(`   • Industry Keywords: ${industryKeywords}`);
  console.log(`   • Company Keywords: ${companyKeywords}`);

  // Parse job titles if provided
  let parsedJobTitles = [];
  if (jobTitles) {
    const cleanJobTitles = jobTitles.replace(/[\[\]]/g, '').split(',').map(title => title.trim());
    parsedJobTitles = cleanJobTitles.map(title => title === 'fonder' ? 'founder' : title);
  }

  // Check for existing progress
  const progressFile = 'apollo_scraping_progress.json';
  const progressPath = path.join(process.cwd(), progressFile);

  let startPage = 1;
  let totalPages = 18; // Default, will be updated from API response

  if (fs.existsSync(progressPath)) {
    try {
      const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
      startPage = progress.lastCompletedPage + 1;
      totalPages = progress.totalPages || 18;

      // Check existing result.json
      let existingRecords = 0;
      if (fs.existsSync('result.json')) {
        const resultData = JSON.parse(fs.readFileSync('result.json', 'utf8'));
        existingRecords = resultData.length;
      }

      console.log(`📤 Resuming from page ${startPage} (found ${existingRecords} existing records in result.json)`);
    } catch (error) {
      console.log('⚠️ Could not read progress file, starting fresh');
    }
  }

  console.log(`🔄 Processing pages ${startPage} to ${totalPages}...`);

  // Process each page
  for (let currentPage = startPage; currentPage <= totalPages; currentPage++) {
    console.log(`\n📄 Processing page ${currentPage} of ${totalPages}...`);

    try {
      // Make API request for current page
      const apiResponse = await page.evaluate(async (filters, pageNumber) => {
        try {
          // Build the payload
          const payload = {
            "sort_ascending": false,
            "sort_by_field": "recommendations_score",
            "page": pageNumber,
            "display_mode": "explorer_mode",
            "per_page": 25,
            "open_factor_names": [],
            "num_fetch_result": 9,
            "context": "people-index-page",
            "show_suggestions": false,
            "include_account_engagement_stats": false,
            "include_contact_engagement_stats": false,
            "finder_version": 2,
            "search_session_id": Math.random().toString(36).substr(2, 8) + "-" + Math.random().toString(36).substr(2, 4) + "-" + Math.random().toString(36).substr(2, 4) + "-" + Math.random().toString(36).substr(2, 4) + "-" + Math.random().toString(36).substr(2, 12),
            "fields": ["id", "name", "contact_job_change_event", "call_opted_out", "first_name", "last_name", "title", "account", "organization_id", "intent_strength", "organization_name", "account.id", "account.organization_id", "account.domain", "account.logo_url", "account.name", "account.facebook_url", "account.linkedin_url", "account.twitter_url", "account.crm_record_url", "account.website_url", "contact_emails", "email", "email_status", "free_domain", "email_needs_tickling", "email_status_unavailable_reason", "email_true_status", "email_domain_catchall", "failed_email_verify_request", "flagged_datum", "phone_numbers", "sanitized_phone", "direct_dial_status", "direct_dial_enrichment_failed_at", "label_ids", "linkedin_url", "emailer_campaign_ids", "twitter_url", "facebook_url", "crm_record_url", "city", "state", "country", "account.estimated_num_employees", "account.industries", "account.keywords"],
            "ui_finder_random_seed": Math.random().toString(36).substr(2, 10),
            "typed_custom_fields": [],
            "cacheKey": Date.now()
          };

          // Add filters to payload
          if (filters.emailStatus) {
            payload.contact_email_status_v2 = [filters.emailStatus.toLowerCase()];
          }

          if (filters.jobTitles && filters.jobTitles.length > 0) {
            payload.person_titles = filters.jobTitles;
          }

          if (filters.location) {
            payload.person_locations = [filters.location];
          }

          if (filters.employees) {
            payload.organization_num_employees_ranges = [filters.employees.replace('-', ',')];
          }

          if (filters.industryKeywords) {
            payload.organization_industry_tag_ids = ["5567cddb7369644d250c0000"];
          }

          if (filters.companyKeywords) {
            payload.q_organization_keyword_tags = [filters.companyKeywords];
            payload.included_organization_keyword_fields = ["tags", "name"];
          }

          console.log(`🚀 Making API request for page ${pageNumber}...`);

          // Get CSRF token from page
          const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
            document.cookie.match(/X-CSRF-TOKEN=([^;]+)/)?.[1] || '';

          // Make the API request
          const response = await fetch('https://app.apollo.io/api/v1/mixed_people/search', {
            method: 'POST',
            headers: {
              'Accept': '*/*',
              'Accept-Encoding': 'gzip, deflate, br, zstd',
              'Accept-Language': 'en-US,en;q=0.9',
              'Content-Type': 'application/json',
              'Origin': 'https://app.apollo.io',
              'Priority': 'u=1, i',
              'Referer': 'https://app.apollo.io/',
              'Sec-Ch-Ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
              'Sec-Ch-Ua-Mobile': '?0',
              'Sec-Ch-Ua-Platform': '"Windows"',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'same-origin',
              'User-Agent': navigator.userAgent,
              'X-Accept-Language': 'en',
              'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`✅ API request successful for page ${pageNumber}`);
            console.log(`Found ${data.people?.length || 0} people on this page`);
            console.log(`Total available: ${data.pagination?.total_entries || 'Unknown'}`);
            console.log(`Total pages: ${data.pagination?.total_pages || 'Unknown'}`);

            return {
              success: true,
              count: data.people?.length || 0,
              total: data.pagination?.total_entries || 0,
              totalPages: data.pagination?.total_pages || 0,
              currentPage: pageNumber,
              status: response.status,
              data: data
            };
          } else {
            console.log('❌ API request failed:', response.status, response.statusText);
            const errorText = await response.text();
            return { success: false, error: `${response.status} ${response.statusText}`, details: errorText };
          }

        } catch (error) {
          console.log('❌ API request error:', error.message);
          return { success: false, error: error.message };
        }
      }, {
        emailStatus,
        jobTitles: parsedJobTitles,
        location,
        employees,
        industryKeywords,
        companyKeywords
      }, currentPage);

      if (apiResponse.success) {
        console.log(`🎉 Page ${currentPage} successful! Found ${apiResponse.count} people`);

        // Update total pages from first response
        if (currentPage === startPage && apiResponse.totalPages) {
          totalPages = apiResponse.totalPages;
          console.log(`📊 Total pages to process: ${totalPages}`);
        }

        // Extract data from current page
        const currentPageExtracted = [];

        // Process people from current page
        if (apiResponse.data.people && apiResponse.data.people.length > 0) {
          apiResponse.data.people.forEach((person) => {
            currentPageExtracted.push({
              id: person.id || null,
              name: person.name || null,
              website_url: person.organization?.website_url || null
            });
          });
        }

        // Process contacts from current page
        if (apiResponse.data.contacts && apiResponse.data.contacts.length > 0) {
          apiResponse.data.contacts.forEach((contact) => {
            currentPageExtracted.push({
              id: contact.id || null,
              name: contact.name || null,
              website_url: contact.account?.website_url || null
            });
          });
        }

        // Update result.json immediately
        if (currentPageExtracted.length > 0) {
          updateResultJson(currentPageExtracted);
        }

        // Save progress after each successful page
        try {
          const progressData = {
            lastCompletedPage: currentPage,
            totalPages: totalPages,
            timestamp: new Date().toISOString()
          };
          fs.writeFileSync(progressPath, JSON.stringify(progressData, null, 2));
          console.log(`💾 Progress saved (page ${currentPage} completed)`);
        } catch (saveError) {
          console.log(`⚠️ Could not save progress: ${saveError.message}`);
        }

        // Add delay between requests to be respectful
        if (currentPage < totalPages) {
          console.log('⏳ Waiting 2 seconds before next request...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } else {
        console.log(`❌ API request failed for page ${currentPage}: ${apiResponse.error}`);
        if (apiResponse.details) {
          console.log(`   Error details: ${apiResponse.details}`);

          // Check if it's a plan limitation error
          if (apiResponse.details.includes('upgrade_plan') || apiResponse.details.includes('paying plan')) {
            console.log('🚫 PLAN LIMITATION DETECTED:');
            console.log('   • You\'ve hit Apollo\'s free plan search limit');
            console.log('   • Consider upgrading to a paid plan or using a corporate email');
            console.log('   • Stopping pagination to avoid further errors');
            break; // Exit the pagination loop
          }

          // Check if it's a rate limit
          if (apiResponse.details.includes('rate limit') || apiResponse.details.includes('too many requests')) {
            console.log('⏳ RATE LIMIT DETECTED: Waiting 30 seconds before retrying...');
            await new Promise(resolve => setTimeout(resolve, 30000));
            currentPage--; // Retry the same page
            continue;
          }
        }
        console.log('⚠️ Skipping this page and continuing...');
      }

    } catch (pageError) {
      console.log(`❌ Error processing page ${currentPage}: ${pageError.message}`);
      console.log('⚠️ Continuing to next page...');
    }
  }

  // Final summary
  console.log('\n🎉 Pagination completed!');

  // Show final result.json stats
  try {
    const resultData = JSON.parse(fs.readFileSync('result.json', 'utf8'));
    console.log(`📊 Final result.json stats:`);
    console.log(`   • Total records: ${resultData.length}`);
    console.log(`   • Records with website_url: ${resultData.filter(item => item.website_url !== null).length}`);
    console.log(`   • Records with valid name: ${resultData.filter(item => item.name !== null).length}`);
    console.log(`   • Records with valid id: ${resultData.filter(item => item.id !== null).length}`);
  } catch (error) {
    console.log('⚠️ Could not read result.json for final stats');
  }

  // Clean up progress file on successful completion
  try {
    if (fs.existsSync(progressPath)) {
      fs.unlinkSync(progressPath);
      console.log('🧹 Progress file cleaned up');
    }
  } catch (cleanupError) {
    console.log(`⚠️ Could not clean up progress file: ${cleanupError.message}`);
  }

  console.log('\n✅ All data saved to result.json!');
  console.log('🔄 Now adding each person to My Prospects...');

  // Add each person to My Prospects
  await addPeopleToProspects(page);

  console.log('🔄 Browser session kept open for additional requests...');

  // Keep the script running and browser open
  console.log('💡 Browser will remain open. Press Ctrl+C to close when done.');

} catch (error) {
  console.log('Login process encountered an issue:', error.message);
  console.log('You may already be logged in or the page structure has changed.');
}

// Function to add people to My Prospects
async function addPeopleToProspects(page) {
  try {
    // Read result.json
    if (!fs.existsSync('result.json')) {
      console.log('❌ result.json not found. No people to add to prospects.');
      return;
    }

    const resultData = JSON.parse(fs.readFileSync('result.json', 'utf8'));
    console.log(`📋 Found ${resultData.length} people to add to My Prospects`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < resultData.length; i++) {
      const person = resultData[i];
      console.log(`\n👤 Adding person ${i + 1}/${resultData.length}: ${person.name} (ID: ${person.id})`);

      try {
        const response = await page.evaluate(async (personId) => {
          try {
            // Get CSRF token from page
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
              document.cookie.match(/X-CSRF-TOKEN=([^;]+)/)?.[1] || '';

            console.log(`🚀 Adding person ID ${personId} to My Prospects...`);

            // Make the add to prospects API request
            const response = await fetch('https://app.apollo.io/api/v1/mixed_people/add_to_my_prospects', {
              method: 'POST',
              headers: {
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8,af;q=0.7',
                'Content-Type': 'application/json',
                'Origin': 'https://app.apollo.io',
                'Priority': 'u=1, i',
                'Referer': 'https://app.apollo.io/',
                'Sec-Ch-Ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': navigator.userAgent,
                'X-Accept-Language': 'en',
                'X-CSRF-Token': csrfToken
              },
              body: JSON.stringify({
                "entity_ids": [personId],
                "analytics_context": "Searcher: Individual Add Button",
                "skip_fetching_people": true,
                "cta_name": "Access email",
                "cacheKey": Date.now()
              })
            });

            if (response.ok) {
              const data = await response.json();
              console.log(`✅ Successfully added person ID ${personId} to My Prospects`);

              // Extract email from response if available
              let extractedEmail = null;

              // Try contacts array first (this is where the email is actually located)
              if (data.contacts && data.contacts.length > 0) {
                const contactData = data.contacts[0];
                extractedEmail = contactData.email || contactData.contact_emails?.[0]?.email || null;
              }

              // Fallback to people array if contacts not found
              if (!extractedEmail && data.people && data.people.length > 0) {
                const personData = data.people[0];
                extractedEmail = personData.email || personData.contact_emails?.[0]?.email || null;
              }

              return { success: true, status: response.status, data: data, email: extractedEmail };
            } else {
              console.log(`❌ Failed to add person ID ${personId}:`, response.status, response.statusText);
              const errorText = await response.text();
              return { success: false, error: `${response.status} ${response.statusText}`, details: errorText };
            }

          } catch (error) {
            console.log(`❌ Error adding person ID ${personId}:`, error.message);
            return { success: false, error: error.message };
          }
        }, person.id);

        if (response.success) {
          console.log(`✅ ${person.name} added to My Prospects successfully!`);

          // Update the person's data with extracted email
          if (response.email) {
            person.email = response.email;
            console.log(`📧 Email extracted: ${response.email}`);
          } else {
            person.email = null;
            console.log(`📧 No email found in response`);
          }

          successCount++;
        } else {
          console.log(`❌ Failed to add ${person.name}: ${response.error}`);
          if (response.details) {
            console.log(`   Details: ${response.details}`);
          }
          person.email = null; // Set email to null if request failed
          errorCount++;

          // Check for rate limiting or other issues
          if (response.details && (response.details.includes('rate limit') || response.details.includes('too many requests'))) {
            console.log('⏳ Rate limit detected. Waiting 10 seconds before continuing...');
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }

        // Add delay between requests to be respectful
        if (i < resultData.length - 1) {
          console.log('⏳ Waiting 1 second before next request...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (personError) {
        console.log(`❌ Error processing ${person.name}: ${personError.message}`);
        errorCount++;
      }
    }

    console.log('\n🎉 Finished adding people to My Prospects!');
    console.log(`📊 Results:`);
    console.log(`   • Successfully added: ${successCount}`);
    console.log(`   • Failed: ${errorCount}`);
    console.log(`   • Total processed: ${resultData.length}`);

    // Save updated data with emails back to result.json
    try {
      fs.writeFileSync('result.json', JSON.stringify(resultData, null, 2));
      console.log(`💾 Updated result.json with email data!`);

      // Show email extraction statistics
      const emailsExtracted = resultData.filter(person => person.email !== null).length;
      console.log(`📧 Email extraction stats:`);
      console.log(`   • Emails extracted: ${emailsExtracted}`);
      console.log(`   • No emails found: ${resultData.length - emailsExtracted}`);

      // Show sample of updated data
      console.log(`\n📋 Sample updated records (first 3 with emails):`);
      const samplesWithEmails = resultData.filter(person => person.email !== null).slice(0, 3);
      samplesWithEmails.forEach((person, index) => {
        console.log(`   ${index + 1}. ${person.name} | ${person.email} | ${person.website_url}`);
      });

    } catch (saveError) {
      console.log(`❌ Could not save updated result.json: ${saveError.message}`);
    }

  } catch (error) {
    console.log(`❌ Error in addPeopleToProspects: ${error.message}`);
  }
}

// Keep script running
process.stdin.resume();