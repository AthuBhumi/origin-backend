const { cleanAdminData } = require('./cleanAdminData');
const { cleanPublicData } = require('./cleanPublicData');

async function cleanAllData() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  CLEANING ALL DUMMY DATA FROM SYSTEM  ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Clean admin panel
    console.log('📊 Step 1: Cleaning Admin Panel...');
    await cleanAdminData();
    
    // Clean public data
    console.log('\n📊 Step 2: Cleaning Public Data...');
    await cleanPublicData();

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   ✅ ALL DATA CLEANED SUCCESSFULLY!   ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log('Your system is now clean and professional!');
    console.log('');
    console.log('What\'s left:');
    console.log('✅ Clean admin panel with one super admin');
    console.log('✅ No dummy clients, projects, or team members');
    console.log('✅ No test enquiries or portfolio items');
    console.log('✅ No sample products');
    console.log('');
    console.log('Next steps:');
    console.log('1. Login to admin panel: http://localhost:3000/admin/login');
    console.log('2. Email: admin@company.com');
    console.log('3. Password: admin123');
    console.log('4. Start adding your real data!\n');

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  cleanAllData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Cleanup failed:', err);
      process.exit(1);
    });
}

module.exports = { cleanAllData };
