require('dotenv').config();
const Simulator = require('./core/simulator');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 8) {
    console.log('Usage: node src/index.js <symbol> <startDate> <endDate> <method> <buyPct> <sellPct> <session> <capital>');
    console.log('Example: node src/index.js BTDR 2025-09-24 2025-09-24 EQUAL_MEAN 0.5 1.1 RTH 10000');
    process.exit(1);
  }

  const [symbol, startDate, endDate, method, buyPct, sellPct, session, capital] = args;

  const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  };

  const simulator = new Simulator(dbConfig);

  const results = await simulator.runSimulation({
    symbol,
    startDate,
    endDate,
    method,
    buyPct: parseFloat(buyPct),
    sellPct: parseFloat(sellPct),
    session,
    initialCapital: parseFloat(capital)
  });

  if (results) {
    console.log('\n✅ Simulation complete!');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});