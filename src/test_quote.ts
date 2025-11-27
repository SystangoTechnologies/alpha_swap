import { CowBot } from './cowSdk';
import { SupportedChainId } from '@cowprotocol/cow-sdk';

const bot = new CowBot(SupportedChainId.MAINNET);

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

async function test() {
    console.log('Testing getQuote...');
    try {
        // Sell 1 WETH for USDC
        const quote = await bot.getQuote(WETH, USDC, '1', 'sell', 18, 6);
        console.log('Quote received:');
        console.log(`Buy Amount: ${quote.quoteResults.quoteResponse.quote.buyAmount} (Raw)`);
        console.log(`Buy Amount: ${parseInt(quote.quoteResults.quoteResponse.quote.buyAmount) / 1e6} USDC`);
        console.log(`Estimated Price: ${parseInt(quote.quoteResults.quoteResponse.quote.buyAmount) / 1e6} USDC/WETH`);
    } catch (error) {
        console.error('Error fetching quote:', error);
    }
}

test();
