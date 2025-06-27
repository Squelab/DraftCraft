// scripts/firestore-uploader.js
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

// Your API endpoints
const API_BASE_URL = 'https://fantasyranker-adp-api.onrender.com/api/players';
const FORMATS = {
  'PPR': 'ppr',
  'Half PPR': 'half', 
  'Standard': 'standard'
};

async function fetchPlayerData(format) {
  try {
    console.log(`Fetching ${format} data...`);
    const response = await axios.get(`${API_BASE_URL}/${FORMATS[format]}`, {
      timeout: 30000 // 30 second timeout
    });
    
    if (response.data && response.data.players) {
      console.log(`✅ ${format}: ${response.data.players.length} players fetched`);
      return response.data;
    } else {
      throw new Error(`Invalid response format for ${format}`);
    }
  } catch (error) {
    console.error(`❌ Error fetching ${format} data:`, error.message);
    throw error;
  }
}

async function uploadToFirestore(format, data) {
  try {
    console.log(`Uploading ${format} to Firestore...`);
    
    // Store in collection 'consensus-data' with document name as format
    const docRef = db.collection('consensus-data').doc(format.toLowerCase().replace(' ', '-'));
    
    const firestoreData = {
      format: format,
      players: data.players,
      toggles: data.toggles || {
        adp: false,
        tiers: false,
        risk: true,
        notes: true
      },
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      count: data.players.length,
      source: 'fantasyranker-adp-api'
    };
    
    await docRef.set(firestoreData);
    console.log(`✅ ${format}: ${data.players.length} players uploaded to Firestore`);
    
  } catch (error) {
    console.error(`❌ Error uploading ${format} to Firestore:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting ADP data update...');
  
  try {
    const results = [];
    
    // Process each format
    for (const [formatName, formatCode] of Object.entries(FORMATS)) {
      try {
        // Fetch data from API
        const data = await fetchPlayerData(formatName);
        
        // Upload to Firestore
        await uploadToFirestore(formatName, data);
        
        results.push({
          format: formatName,
          success: true,
          count: data.players.length
        });
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Failed to process ${formatName}:`, error.message);
        results.push({
          format: formatName,
          success: false,
          error: error.message
        });
      }
    }
    
    // Summary
    console.log('\n📊 Summary:');
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.format}: ${result.count} players updated`);
      } else {
        console.log(`❌ ${result.format}: Failed - ${result.error}`);
      }
    });
    
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    
    if (successful === total) {
      console.log(`\n🎉 All ${total} formats updated successfully!`);
      process.exit(0);
    } else {
      console.log(`\n⚠️  ${successful}/${total} formats updated successfully`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
