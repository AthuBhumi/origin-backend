const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.db');

async function cleanPublicData() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }

      console.log('\n🧹 Cleaning Public Database (Portfolio & Enquiries)...\n');

      try {
        db.serialize(() => {
          // Delete all enquiries
          db.run('DELETE FROM enquiries', (err) => {
            if (err) console.error('Error deleting enquiries:', err);
            else console.log('✅ Deleted all enquiries');
          });

          // Delete all portfolio projects
          db.run('DELETE FROM portfolio', (err) => {
            if (err) console.error('Error deleting portfolio:', err);
            else console.log('✅ Deleted all portfolio projects');
          });

          // Delete all products
          db.run('DELETE FROM products', (err) => {
            if (err) console.error('Error deleting products:', err);
            else console.log('✅ Deleted all products');
          });

          setTimeout(() => {
            db.close((err) => {
              if (err) {
                console.error('Error closing database:', err);
                reject(err);
              } else {
                console.log('\n═══════════════════════════════════════');
                console.log('🎉 PUBLIC DATA CLEANED SUCCESSFULLY');
                console.log('═══════════════════════════════════════');
                console.log('✅ All enquiries removed');
                console.log('✅ All portfolio projects removed');
                console.log('✅ All products removed');
                console.log('═══════════════════════════════════════\n');
                console.log('Your website is now clean and ready!');
                console.log('Start adding real data through admin panel.\n');
                resolve();
              }
            });
          }, 500);
        });

      } catch (error) {
        console.error('Error during cleaning:', error);
        db.close();
        reject(error);
      }
    });
  });
}

// Run the cleaner
if (require.main === module) {
  cleanPublicData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Cleaning failed:', err);
      process.exit(1);
    });
}

module.exports = { cleanPublicData };
