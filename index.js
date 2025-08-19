import { connect } from 'puppeteer-real-browser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables with explicit path
console.log('Loading environment variables...');
const result = dotenv.config({ path: path.join(__dirname, '.env') });
if (result.error) {
  console.log('Error loading .env file:', result.error);
} else {
  console.log('✅ Environment variables loaded successfully');
}

// Use optimal puppeteer-real-browser configuration for Cloudflare bypass
const { browser, page } = await connect({
  headless: false,
  fingerprint: true,
  turnstile: true,
  tf: true,  // Enable TurnStile bypass
  connectOption: {
    defaultViewport: null
  },
  customConfig: {},
  skipTarget: [],
  disableXvfb: false,
  ignoreAllFlags: false
});

// Let puppeteer-real-browser handle stealth configuration
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
  
  // Wait for puppeteer-real-browser to handle it
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
  // Apollo-specific selectors based on actual HTML structure
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
  
  // Clear any existing text in the email field and fill email
  await page.focus(emailSelector);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.type(emailSelector, email);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Clear any existing text in the password field and fill password
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
  
  // Wait a moment for the dashboard to fully load
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Make API request immediately after successful login
  console.log('🚀 Making API request immediately after login...');
  
  // Wait briefly for session to be fully established
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 🚀 PRIMARY APPROACH: Direct API Request (No DOM Manipulation)
  console.log('🔥 Making direct API request to Apollo.io...');
  
  try {
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
    
    // Make API request to search for people with filters
    const apiResponse = await page.evaluate(async (filters) => {
      try {
        // Build the payload to match your successful request exactly
        const payload = {
          "sort_ascending": false,
          "sort_by_field": "recommendations_score",
          "page": 1,
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
          "fields": ["id","name","contact_job_change_event","call_opted_out","first_name","last_name","title","account","organization_id","intent_strength","organization_name","account.id","account.organization_id","account.domain","account.logo_url","account.name","account.facebook_url","account.linkedin_url","account.twitter_url","account.crm_record_url","account.website_url","contact_emails","email","email_status","free_domain","email_needs_tickling","email_status_unavailable_reason","email_true_status","email_domain_catchall","failed_email_verify_request","flagged_datum","phone_numbers","sanitized_phone","direct_dial_status","direct_dial_enrichment_failed_at","label_ids","linkedin_url","emailer_campaign_ids","twitter_url","facebook_url","crm_record_url","city","state","country","account.estimated_num_employees","account.industries","account.keywords"],
          "ui_finder_random_seed": Math.random().toString(36).substr(2, 10),
          "typed_custom_fields": [],
          "cacheKey": Date.now()
        };
        
        // Add filters to payload exactly like your example
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
          // Use the exact industry tag ID from your example
          payload.organization_industry_tag_ids = ["5567cddb7369644d250c0000"];
        }
        
        if (filters.companyKeywords) {
          payload.q_organization_keyword_tags = [filters.companyKeywords];
          payload.included_organization_keyword_fields = ["tags", "name"];
        }
        
        console.log('🚀 Making API request with filters...');
        console.log('📋 Final payload:', JSON.stringify(payload, null, 2));
        
        // Get CSRF token from page
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 
                         document.cookie.match(/X-CSRF-TOKEN=([^;]+)/)?.[1] || '';
        
        console.log('🔑 CSRF Token found:', csrfToken ? 'Yes' : 'No');
        
        // Make the API request with headers matching your successful request
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
          console.log('✅ API request successful');
          console.log(`Found ${data.people?.length || 0} people`);
          console.log(`Total available: ${data.pagination?.total_entries || 'Unknown'}`);
          
          // Save response data to JSON file immediately
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `apollo_response_${timestamp}.json`;
          
          console.log(`💾 Saving response data to: ${filename}`);
          
          return { 
            success: true, 
            count: data.people?.length || 0, 
            total: data.pagination?.total_entries || 0,
            status: response.status,
            data: data,  // Return the full response data
            filename: filename
          };
        } else {
          console.log('❌ API request failed:', response.status, response.statusText);
          const errorText = await response.text();
          console.log('📄 Response headers:', Object.fromEntries(response.headers.entries()));
          console.log('📄 Error response body:', errorText);
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
    });
    
    if (apiResponse.success) {
      console.log(`🎉 API Request Successful! Found ${apiResponse.count} people matching filters`);
      
      // Save response data to JSON file using Node.js
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `apollo_response_${timestamp}.json`;
      const filePath = path.join(process.cwd(), filename);
      
      try {
        fs.writeFileSync(filePath, JSON.stringify(apiResponse.data, null, 2));
        console.log(`💾 Response data saved to: ${filename}`);
        console.log(`📁 Full path: ${filePath}`);
      } catch (saveError) {
        console.log(`❌ Could not save file: ${saveError.message}`);
      }
      
      // Extract and save structured data (id, name, website_url)
      console.log('\n🔄 Extracting structured data...');
      const extractedData = [];
      
      // Process people array
      if (apiResponse.data.people && apiResponse.data.people.length > 0) {
        console.log(`📊 Processing ${apiResponse.data.people.length} people...`);
        apiResponse.data.people.forEach((person, index) => {
          const extractedItem = {
            id: person.id || 'N/A',
            name: person.name || 'N/A',
            website_url: person.organization?.website_url || 'N/A'
          };
          extractedData.push(extractedItem);
          
          // Log first few entries
          if (index < 3) {
            console.log(`   People ${index + 1}. ${extractedItem.name} | ${extractedItem.website_url}`);
          }
        });
      }
      
      // Process contacts array
      if (apiResponse.data.contacts && apiResponse.data.contacts.length > 0) {
        console.log(`📊 Processing ${apiResponse.data.contacts.length} contacts...`);
        apiResponse.data.contacts.forEach((contact, index) => {
          const extractedItem = {
            id: contact.id || 'N/A',
            name: contact.name || 'N/A',
            website_url: contact.account?.website_url || 'N/A'
          };
          extractedData.push(extractedItem);
          
          // Log first few entries
          if (index < 3) {
            console.log(`   Contact ${index + 1}. ${extractedItem.name} | ${extractedItem.website_url}`);
          }
        });
      }
      
      // Save extracted data
      if (extractedData.length > 0) {
        const extractedFilename = `extracted_data_${timestamp}.json`;
        const extractedFilePath = path.join(process.cwd(), extractedFilename);
        
        try {
          fs.writeFileSync(extractedFilePath, JSON.stringify(extractedData, null, 2));
          console.log(`✅ Extracted data saved to: ${extractedFilename}`);
          console.log(`📁 Full path: ${extractedFilePath}`);
          console.log(`📊 Total extracted records: ${extractedData.length}`);
          console.log(`   • Records with website_url: ${extractedData.filter(item => item.website_url !== 'N/A').length}`);
          console.log(`   • Records with valid name: ${extractedData.filter(item => item.name !== 'N/A').length}`);
          console.log(`   • Records with valid id: ${extractedData.filter(item => item.id !== 'N/A').length}`);
        } catch (extractError) {
          console.log(`❌ Could not save extracted data: ${extractError.message}`);
        }
      } else {
        console.log('⚠️ No data to extract from people or contacts arrays');
      }
      
      console.log('📊 Response Data Summary:');
      console.log(`   • Total Results: ${apiResponse.count}`);
      console.log(`   • Total Available: ${apiResponse.total}`);
      console.log(`   • Response Status: ${apiResponse.status}`);
      console.log(`   • Saved to: ${filename}`);
      
      // Display sample of retrieved data if available
      if (apiResponse.data && apiResponse.data.people && apiResponse.data.people.length > 0) {
        console.log('📋 Sample Results (first 3 people):');
        const samplePeople = apiResponse.data.people.slice(0, 3);
        samplePeople.forEach((person, index) => {
          console.log(`   ${index + 1}. ${person.first_name} ${person.last_name}`);
          console.log(`      Title: ${person.title || 'N/A'}`);
          console.log(`      Company: ${person.organization_name || 'N/A'}`);
          console.log(`      Email: ${person.email || 'N/A'}`);
          console.log(`      Email Status: ${person.email_status || 'N/A'}`);
          console.log('   ---');
        });
        
        // Optional: Save full data to file
        console.log('💾 Full data available in apiResponse.data');
        console.log('   You can process or save this data as needed');
      }
      
      console.log('✅ API Request Complete - Data Retrieved Successfully');
      console.log('🎯 Mission accomplished! Closing browser in 5 seconds...');
      
      // Wait a moment then close browser and exit
      await new Promise(resolve => setTimeout(resolve, 5000));
      await browser.close();
      console.log('👋 Browser closed. Script completed successfully!');
      process.exit(0);
      
    } else {
      console.log(`❌ API request failed: ${apiResponse.error}`);
      if (apiResponse.details) {
        console.log(`   Error details: ${apiResponse.details}`);
      }
      console.log('💡 Check your .env filters or network connectivity');
      
      // Close browser on failure
      await new Promise(resolve => setTimeout(resolve, 3000));
      await browser.close();
      process.exit(1);
    }
    
  } catch (apiError) {
    console.log('❌ Error with API request:', apiError.message);
    console.log('💡 This might be a session or authentication issue');
    
    // Close browser on error
    await new Promise(resolve => setTimeout(resolve, 3000));
    await browser.close();
    process.exit(1);
  }
  
  // DOM manipulation approach disabled - focusing on API requests only
  console.log('💭 API request attempt completed. DOM manipulation disabled.');
  console.log('🔄 Keeping browser session alive for manual inspection...');

} catch (error) {
  console.log('Login process encountered an issue:', error.message);
  console.log('You may already be logged in or the page structure has changed.');
}

// Script keeps running to maintain browser session
console.log('🎯 Script completed. Browser session maintained.');
