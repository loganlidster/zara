# Crypto Event Generation - Configuration Verification

## Script Location
`cloudshell_crypto/crypto-event-generation.js`

## Verified Configuration

### Thresholds (Line 59)
```javascript
const thresholds = [0.3, 0.6, 0.8, 1.0, 1.4, 1.8, 2.0, 2.4, 2.8, 3.0, 3.5, 4.0, 5.0];
```
- **Count**: 13 values
- **Combinations**: 13×13 = 169
- **Optimized for**: 0.3% round-trip fees (0.15% each way)
- **Minimum net profit**: 0.2% after fees

### Date Range (Lines 42-43)
```javascript
const START_DATE = process.env.START_DATE || '2024-10-01';
const END_DATE = process.env.END_DATE || '2025-11-02';
```
- **Start**: October 1, 2024
- **End**: November 2, 2025
- **Duration**: 13 months

### Symbols (Line 46)
```javascript
const CRYPTO_SYMBOLS = ['ADA', 'AVAX', 'BCH', 'CUSD', 'DOGE', 'ETH', 'HBAR', 'HYPE', 'LEO', 'LINK', 'LTC', 'SOL', 'SUI', 'TON', 'TRX', 'TUSD', 'XLM', 'XMR', 'XRP'];
```
- **Count**: 19 cryptos
- **Excluded**: SHIB (numeric overflow)

## How Cloud Run Uses This

1. **Block 2** builds Docker image from this file:
   ```bash
   gcloud builds submit --tag gcr.io/tradiac-testing/crypto-event-generator
   ```

2. **Block 3** executes jobs using the built image:
   ```bash
   gcloud run jobs execute crypto-event-job --set-env-vars METHOD=EQUAL_MEAN
   gcloud run jobs execute crypto-event-job --set-env-vars METHOD=WINSORIZED
   ```

3. Jobs read hardcoded values from the script (no env vars needed for dates/thresholds)

## Expected Output

- **EQUAL_MEAN**: ~8.5M events (169 combos × 19 symbols × ~2,700 events)
- **WINSORIZED**: ~8.5M events (169 combos × 19 symbols × ~2,700 events)
- **Total**: ~17M events

## Verification Complete ✅

All configuration values are correctly set in the script and will be used by Cloud Run when deployed.