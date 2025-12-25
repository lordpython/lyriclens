
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables (similar to runTest.ts, just in case)
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
}
dotenv.config();

// Dynamic import to verify value
async function runTest() {
    console.log('🧪 Testing Image Model Configuration...');

    const { MODELS } = await import('../services/shared/apiClient.js');
    const EXPECTED_MODEL = "imagen-4.0-fast-generate-001";

    if (MODELS.IMAGE === EXPECTED_MODEL) {
        console.log(`✅ MODELS.IMAGE is correctly set to "${MODELS.IMAGE}"`);
        process.exit(0);
    } else {
        console.error(`❌ MODELS.IMAGE is "${MODELS.IMAGE}", but expected "${EXPECTED_MODEL}"`);
        process.exit(1);
    }
}

runTest().catch(console.error);
