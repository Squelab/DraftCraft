const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

// Formats map to FantasyCalc PPR query parameter (1 = PPR, 0.5 = Half PPR, 0 = Standard)
const FORMATS = {
  'PPR': 1,
  'Half PPR': 0.5,
  'Standard': 0
};

async function fetchPlayerData(formatName, pprValue) {
  try {
    console.log(`Fetching ${formatName} data from FantasyCalc API...`);
    const url = `https://api.fantasycalc.com/values/current?isDynasty=false&numQbs=1&numTeams=12&ppr=${pprValue}`;
    
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });

    const apiPlayers = response.data;
    if (!Array.isArray(apiPlayers) || apiPlayers.length === 0) {
      throw new Error(`Invalid or empty response for ${formatName}`);
    }

    // Map FantasyCalc response to your application's schema
    const mappedPlayers = apiPlayers.map((item, index) => {
      const playerObj = item.player || {};
      const rank = item.overallRank || (index + 1);
      
      return {
        id: `adp_${rank}`,
        name: playerObj.name || 'Unknown',
        team: playerObj.maybeTeam || playerObj.mTeam || 'FA',
        position: playerObj.position || 'FLEX',
        overallRank: rank,
        positionRank: item.positionRank || rank,
        adp: parseFloat(item.adp) || rank,
        risk: 'Medium',
        notes: ''
      };
    });

    console.log(`✅ ${formatName}: ${mappedPlayers.length} players fetched`);
    return {
      players: mappedPlayers,
      toggles: {
        adp: true,
        tiers: false,
        risk: true,
        notes: true
      }
    };
  } catch (error) {
    console.error(`❌ Error fetching ${formatName} data:`, error.message);
    throw error;
  }
}

async function uploadToFirestore(format, data) {
  try {
    console.log(`Uploading ${format} to Firestore...`);
    
    const docRef = db.collection('expert-consensus').doc(format.toLowerCase().replace(/\s+/g, '-'));
    
    const firestoreData = {
      format: format,
      players: data.players,
      toggles: data.toggles,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      count: data.players.length,
      source: 'fantasycalc-api'
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
    
    for (const [formatName, pprValue] of Object.entries(FORMATS)) {
      try {
        const data = await fetchPlayerData(formatName, pprValue);
        await uploadToFirestore(formatName, data);
        
        results.push({
          format: formatName,
          success: true,
          count: data.players.length
        });
        
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

if (require.main === module) {
  main();
}
